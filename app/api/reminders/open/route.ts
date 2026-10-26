import { requireOrigin, requireSession } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { audit } from "@/lib/finance";
import { errorResponse, rateLimit } from "@/lib/http";
import {
  lockRemindableAppointment,
  claimManualReminder,
} from "@/lib/manual-reminder-store";
import { whatsappLink } from "@/lib/manual-whatsapp";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const s = await requireSession(["owner", "receptionist"], true);
    await rateLimit("manual-wa-open:" + s.user_id, 60, 60);
    const form = await request.formData();
    const input = z
      .object({
        appointmentId: z.uuid(),
        version: z.coerce.number().int().nonnegative(),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(Object.fromEntries(form));
    const href = await transaction(async (c) => {
      await c.query("SELECT set_config('app.user_id',$1,true)", [s.user_id]);
      const a = await lockRemindableAppointment(
        c,
        s,
        input.appointmentId,
        input.version,
      );
      await claimManualReminder(c, s, a.id, a.schedule_version, true);
      await audit(c, s.tenant_id, "manual_reminder_opened", a.id);
      return whatsappLink(a.phone, input.message)!;
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: href,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    const failure = errorResponse(e);
    const body = await failure.json();
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (ch) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[ch]!,
      );
    return new Response(
      `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confira o lembrete — Elares Beauty</title><style>body{font:16px/1.6 Arial,sans-serif;background:#f5f6f8;color:#263142;margin:0;padding:24px;display:grid;place-items:center;min-height:85vh}main{max-width:460px;padding:32px;background:white;border:1px solid #e5e9ef;border-radius:18px}img{width:175px}h1{font-size:25px;line-height:1.2;margin:30px 0 16px}p{color:#657184}a{display:inline-block;margin-top:18px;color:#6D28D9}</style></head><body><main><img src="/brand/elares-beauty-dark.svg" alt="Elares Beauty"><h1>Confira o lembrete antes de continuar.</h1><p>${escape(String(body.error || "Não foi possível preparar a conversa."))}</p><p>Nenhuma mensagem foi enviada. Feche esta aba e atualize a central, ou volte ao sistema.</p><a href="/">Voltar ao Elares Beauty</a></main></body></html>`,
      {
        status: failure.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy":
            "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        },
      },
    );
  }
}

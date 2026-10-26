import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrigin } from "@/lib/auth";
import { errorResponse, HttpError, rateLimit } from "@/lib/http";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const { token } = z
      .object({ token: z.string().regex(/^[0-9a-f]{64}$/) })
      .parse(await request.json());
    const hash = createHash("sha256").update(token).digest("hex");
    await rateLimit("tv-pair:" + hash, 20, 900);
    const device = (
      await db.query(
        "SELECT id,expires_at FROM tv_devices WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()",
        [hash],
      )
    ).rows[0];
    if (!device)
      throw new HttpError("Acesso da TV inválido, expirado ou revogado.", 401);
    (await cookies()).set("elares_beauty_tv", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/tv",
      secure: new URL(request.url).protocol === "https:",
      maxAge: Math.max(
        0,
        Math.floor((+new Date(device.expires_at) - Date.now()) / 1000),
      ),
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

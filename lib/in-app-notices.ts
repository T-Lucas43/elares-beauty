import { createHash } from "node:crypto";
import { time } from "./domain";
export type AppNotice = {
  key: string;
  kind: "cut" | "reminder" | "central";
  title: string;
  message: string;
  appointmentId?: string;
  version?: number;
};
export type NoticeAppointment = {
  id: string;
  schedule_version: number;
  customer: string;
  professional_name: string;
  service_name: string;
  starts_at: string;
};
export function buildInAppNotices(
  soon: NoticeAppointment[],
  reminders: NoticeAppointment[],
  role: string,
  now = Date.now(),
): AppNotice[] {
  const notices: AppNotice[] = soon.flatMap((a) => {
    const remaining = +new Date(a.starts_at) - now;
    if (remaining <= 0 || remaining > 10 * 60000) return [];
    const minutes = Math.max(1, Math.ceil(remaining / 60000));
    return [
      {
        key: `cut:${a.id}:${a.schedule_version}`,
        kind: "cut" as const,
        title:
          role === "barber"
            ? `Seu corte começa em ${minutes} min`
            : `${a.professional_name}: corte em ${minutes} min`,
        message: `${a.customer} · ${a.service_name} · ${time(a.starts_at)}`,
        appointmentId: a.id,
        version: a.schedule_version,
      },
    ];
  });
  if (role === "barber") {
    for (const a of reminders)
      notices.push({
        key: `wa:${a.id}:${a.schedule_version}`,
        kind: "reminder",
        title: "Lembrete do cliente pendente",
        message: `${a.customer} · ${time(a.starts_at)}. Solicite o envio pelo WhatsApp do salão.`,
        appointmentId: a.id,
        version: a.schedule_version,
      });
  } else if (reminders.length) {
    const hash = createHash("sha256")
      .update(
        reminders
          .map((a) => a.id + ":" + a.schedule_version)
          .sort()
          .join(","),
      )
      .digest("hex")
      .slice(0, 16);
    notices.push({
      key: `central:${hash}`,
      kind: "central",
      title: "Central do WhatsApp",
      message: `${reminders.length} ${reminders.length === 1 ? "lembrete aguarda" : "lembretes aguardam"} a equipe. Abra a central para enviar pelo número do salão.`,
    });
  }
  return notices;
}

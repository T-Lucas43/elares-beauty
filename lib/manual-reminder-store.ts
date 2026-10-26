import type { PoolClient } from "pg";
import type { Session } from "./auth";
import { HttpError } from "./http";
import { whatsappPhone } from "./manual-whatsapp";

export async function lockRemindableAppointment(
  c: PoolClient,
  s: Session,
  id: string,
  version: number,
) {
  const a = (
    await c.query(
      "SELECT a.id,a.professional_id,a.schedule_version,a.consent,a.status,a.starts_at,a.source,a.phone,a.customer,p.name professional_name,COALESCE(a.service_name_snapshot,se.name) service_name,t.name shop_name FROM appointments a JOIN professionals p ON p.id=a.professional_id AND p.tenant_id=a.tenant_id JOIN services se ON se.id=a.service_id AND se.tenant_id=a.tenant_id JOIN tenants t ON t.id=a.tenant_id WHERE a.tenant_id=$1 AND a.id=$2 FOR UPDATE OF a",
      [s.tenant_id, id],
    )
  ).rows[0];
  if (!a) throw new HttpError("Agendamento não encontrado.", 404);
  if (s.role === "barber" && a.professional_id !== s.professional_id)
    throw new HttpError(
      "Você pode solicitar apenas seus próprios lembretes.",
      403,
    );
  if (a.schedule_version !== version)
    throw new HttpError(
      "O agendamento foi alterado. Atualize a central antes de continuar.",
      409,
    );
  if (
    !a.consent ||
    !whatsappPhone(a.phone) ||
    a.source !== "booking" ||
    !["scheduled", "confirmed"].includes(a.status) ||
    +new Date(a.starts_at) <= Date.now()
  )
    throw new HttpError(
      "Este agendamento não permite um lembrete. Confira o telefone, a autorização e o horário.",
      409,
    );
  return a;
}

export async function claimManualReminder(
  c: PoolClient,
  s: Session,
  appointmentId: string,
  version: number,
  rejectCompleted = false,
) {
  if (s.role === "barber")
    throw new HttpError("O envio é realizado pela equipe do salão.", 403);
  await c.query(
    "INSERT INTO manual_reminder_tasks(tenant_id,appointment_id,schedule_version) VALUES($1,$2,$3) ON CONFLICT(appointment_id,schedule_version) DO NOTHING",
    [s.tenant_id, appointmentId, version],
  );
  const task = (
    await c.query(
      "SELECT * FROM manual_reminder_tasks WHERE tenant_id=$1 AND appointment_id=$2 AND schedule_version=$3 FOR UPDATE",
      [s.tenant_id, appointmentId, version],
    )
  ).rows[0];
  if (task.state === "done") {
    if (rejectCompleted)
      throw new HttpError(
        "A equipe já informou o envio deste lembrete. Atualize a central antes de repetir.",
        409,
      );
    return;
  }
  if (
    task.state === "opened" &&
    task.opened_by !== s.user_id &&
    task.opened_at &&
    +new Date(task.opened_at) > Date.now() - 10 * 60000
  )
    throw new HttpError(
      "Outra pessoa da equipe está preparando este lembrete. Atualize a central e confirme com ela antes de reenviar.",
      409,
    );
  await c.query(
    "UPDATE manual_reminder_tasks SET state='opened',opened_by=$1,opened_at=now() WHERE tenant_id=$2 AND appointment_id=$3 AND schedule_version=$4",
    [s.user_id, s.tenant_id, appointmentId, version],
  );
}

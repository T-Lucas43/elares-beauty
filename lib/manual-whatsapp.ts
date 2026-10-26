export type ManualReminder = {
  id: string;
  customer: string;
  phone: string;
  professional_id: string;
  professional_name: string;
  service_name: string;
  starts_at: string;
  consent: boolean;
  due: boolean;
  schedule_version: number;
  reminder_state: "pending" | "opened" | "done" | null;
  requested_at: string | null;
  requested_by_name?: string | null;
  opened_at: string | null;
  done_at: string | null;
};

// Booking currently collects Brazilian numbers with DDD. Never guess another
// country's prefix, and never allow input to change the destination host.
export function whatsappPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^[1-9]{2}\d{8,9}$/.test(digits)) return "55" + digits;
  if (/^55[1-9]{2}\d{8,9}$/.test(digits)) return digits;
  return null;
}

export function whatsappLink(phone: string, message: string): string | null {
  const number = whatsappPhone(phone);
  return number && message.trim()
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : null;
}

export function reminderMessage(
  appointment: Pick<
    ManualReminder,
    "customer" | "professional_name" | "service_name" | "starts_at"
  >,
  shop: string,
): string {
  const date = new Date(appointment.starts_at);
  const day = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const hour = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `Olá, ${appointment.customer}! Passando para lembrar do seu agendamento na ${shop}.\n\n✂️ ${appointment.service_name}\n👤 Profissional: ${appointment.professional_name}\n📅 ${day} às ${hour}\n\nSe precisar remarcar ou cancelar, fale com o salão. Até lá!`;
}

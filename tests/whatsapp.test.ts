import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyWebhook,
  sendWhatsApp,
  DeliveryError,
  buildWhatsAppPayload,
  type NotificationData,
} from "../lib/whatsapp";
const task: NotificationData = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  appointment_id: "123e4567-e89b-42d3-a456-426614174001",
  kind: "confirmation",
  phone: "11999990000",
  customer: "Cliente de teste",
  service_name: "Corte",
  professional_name: "Profissional QA",
  starts_at: "2026-11-01T12:00:00Z",
  manage_cipher: null,
  slug: "teste",
};
test("webhook verifica HMAC sobre corpo bruto e rejeita alterações", () => {
  const body = '{"object":"whatsapp_business_account"}';
  const secret = "test-secret";
  const sig =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWebhook(body, sig, secret), true);
  assert.equal(verifyWebhook(body + " ", sig, secret), false);
  assert.equal(verifyWebhook(body, null, secret), false);
});
test("modelo usa seis parâmetros, Brasil e URL HTTPS", () => {
  const body = buildWhatsAppPayload(
    task,
    "confirmacao_qa",
    "https://example.com",
  );
  assert.equal(body.to, "5511999990000");
  assert.equal(body.template.components[0].parameters.length, 6);
  assert.throws(() =>
    buildWhatsAppPayload(task, "confirmacao_qa", "http://localhost"),
  );
});
test("timeout é incerto; 429 admite retry; falha 5xx exige conciliação, sem envio real", async () => {
  Object.assign(process.env, {
    WHATSAPP_ACCESS_TOKEN: "test-token",
    WHATSAPP_PHONE_NUMBER_ID: "123456",
    WHATSAPP_API_VERSION: "v25.0",
    WHATSAPP_TEMPLATE_CONFIRMATION: "confirmacao_qa",
    APP_URL: "https://example.com",
  });
  const timeout = (async () => {
    throw Error("timeout");
  }) as typeof fetch;
  await assert.rejects(
    () => sendWhatsApp(task, timeout),
    (e: unknown) => e instanceof DeliveryError && e.uncertain && !e.retryable,
  );
  const rateLimited = (async () =>
    new Response(JSON.stringify({ error: { code: 4 } }), {
      status: 429,
    })) as typeof fetch;
  await assert.rejects(
    () => sendWhatsApp(task, rateLimited),
    (e: unknown) => e instanceof DeliveryError && e.retryable && !e.uncertain,
  );
  const failure = (async () =>
    new Response("{}", { status: 500 })) as typeof fetch;
  await assert.rejects(
    () => sendWhatsApp(task, failure),
    (e: unknown) => e instanceof DeliveryError && e.uncertain && !e.retryable,
  );
});

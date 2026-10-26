import { readFile } from "node:fs/promises";
import { db, transaction } from "../lib/db";
import { localDay, commission } from "../lib/domain";
import { createHash } from "node:crypto";
import { migrate } from "./migrate";
import { setupAuth } from "./auth-setup";
import {seedDemo} from './demo-seed';
await migrate();
await transaction(async (c) => {
  await c.query(
    "INSERT INTO tenants VALUES ('demo','Elares Beauty','elares-beauty') ON CONFLICT DO NOTHING",
  );
  for (const p of [
    ["rafa", "Marina Costa", "Corte, escova e coloração", "#7C3AED", 4500],
    ["bruno", "Bianca Almeida", "Hidratação e cuidados capilares", "#6D28D9", 5000],
    ["leo", "Luiza Santos", "Manicure e design de sobrancelhas", "#A855F7", 4000],
  ])
    await c.query(
      "INSERT INTO professionals(id,tenant_id,name,specialty,color,commission_bps) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [p[0], "demo", ...p.slice(1)],
    );
  for (const s of [
    [
      "corte",
      "Corte",
      "Seu estilo, com acabamento impecável.",
      6000,
      45,
    ],
    [
      "barba",
      "Escova",
      "Finalização e movimento para os cabelos.",
      4000,
      30,
    ],
    [
      "combo",
      "Hidratação",
      "A experiência completa para renovar o visual.",
      9000,
      75,
    ],
    [
      "acabamento",
      "Sobrancelhas",
      "Os pequenos detalhes fazem a diferença.",
      2500,
      15,
    ],
    ["coloracao", "Coloração", "Cor e cuidado profissional.", 18000, 90],
    ["manicure", "Manicure", "Cuidado e esmaltação das unhas.", 3500, 45],
  ])
    await c.query(
      "INSERT INTO services(id,tenant_id,name,description,price,duration) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [s[0], "demo", ...s.slice(1)],
    );
  const existing = await c.query("SELECT id FROM appointments LIMIT 1");
  if (!existing.rowCount) {
    const day = localDay();
    const rows = [
      ["rafa", "corte", "André Martins", "09:00", 45, 6000, 4500, "completed"],
      [
        "bruno",
        "combo",
        "Pedro Oliveira",
        "09:00",
        75,
        9000,
        5000,
        "completed",
      ],
      ["leo", "corte", "Matheus Silva", "10:00", 45, 6000, 4000, "completed"],
      ["rafa", "combo", "Lucas Ferreira", "11:00", 75, 9000, 4500, "confirmed"],
      ["bruno", "barba", "Gustavo Lima", "11:00", 30, 4000, 5000, "scheduled"],
      ["leo", "corte", "Felipe Rocha", "13:00", 45, 6000, 4000, "scheduled"],
      ["rafa", "corte", "Daniel Souza", "14:00", 45, 6000, 4500, "scheduled"],
      ["bruno", "combo", "Thiago Alves", "15:00", 75, 9000, 5000, "confirmed"],
    ];
    for (const [pid, sid, name, hour, duration, price, bps, status] of rows) {
      const start = new Date(`${day}T${hour}:00-03:00`);
      const end = new Date(+start + Number(duration) * 60000);
      await c.query(
        "INSERT INTO appointments(tenant_id,professional_id,service_id,customer,phone,starts_at,ends_at,price,commission_bps,commission,status,paid,payment_method,manage_hash,list_price,service_name_snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$8,(SELECT name FROM services WHERE id=$3))",
        [
          "demo",
          pid,
          sid,
          name,
          "11999990000",
          start,
          end,
          price,
          bps,
          commission(Number(price), Number(bps)),
          status,
          status === "completed" ? price : 0,
          status === "completed" ? "Pix" : null,
          createHash("sha256").update(crypto.randomUUID()).digest("hex"),
        ],
      );
    }
    await c.query(
      "INSERT INTO expenses(tenant_id,description,amount) VALUES ('demo','Materiais e produtos',4500)",
    );
  }
});
await db.query(
  "INSERT INTO working_schedules(tenant_id,professional_id,weekday) SELECT tenant_id,id,d FROM professionals CROSS JOIN generate_series(0,6) d ON CONFLICT DO NOTHING",
);
await db.query(
  "INSERT INTO payments(tenant_id,appointment_id,kind,service_amount,method,created_at,created_by) SELECT tenant_id,id,'receipt',paid,COALESCE(payment_method,'Pix'),starts_at,'legacy-seed' FROM appointments WHERE paid>0 AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.appointment_id=appointments.id)",
);
await setupAuth();
await seedDemo();
console.log("Banco preparado sem apagar dados existentes.");
await db.end();

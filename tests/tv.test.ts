import { test } from "node:test";
import assert from "node:assert/strict";
import { professionalQueue } from "../lib/tv";
test("TV mantém atendimentos e próximos separados por profissional", () => {
  const rows = [
    {
      id: "1",
      professional_id: "a",
      status: "in_progress",
      starts_at: "2026-10-25T12:00:00Z",
      ends_at: "2026-10-25T12:45:00Z",
    },
    {
      id: "2",
      professional_id: "b",
      status: "in_progress",
      starts_at: "2026-10-25T12:00:00Z",
      ends_at: "2026-10-25T13:00:00Z",
    },
    {
      id: "3",
      professional_id: "a",
      status: "confirmed",
      starts_at: "2026-10-25T13:00:00Z",
      ends_at: "2026-10-25T14:00:00Z",
    },
    {
      id: "4",
      professional_id: "b",
      status: "scheduled",
      starts_at: "2026-10-25T14:00:00Z",
      ends_at: "2026-10-25T15:00:00Z",
    },
  ];
  const now = new Date("2026-10-25T12:15:00Z");
  const a = professionalQueue(rows, "a", now);
  const b = professionalQueue(rows, "b", now);
  assert.equal(a.current?.id, "1");
  assert.equal(b.current?.id, "2");
  assert.equal(a.next[0].id, "3");
  assert.equal(b.next[0].id, "4");
  const predicted = professionalQueue(
    [{ ...rows[0], status: "confirmed" }],
    "a",
    now,
  );
  assert.equal(predicted.current, undefined);
  assert.equal(predicted.expected?.id, "1");
});

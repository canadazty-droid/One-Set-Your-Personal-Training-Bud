import { and, desc, eq, gte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

type Db = DrizzleD1Database<typeof schema>;

function validateWeight(value: unknown) {
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight < 30 || weight > 350) throw new Error("Weight must be between 30 and 350 kg");
  return Math.round(weight * 10) / 10;
}

export async function recordBodyWeight(db: Db, userEmail: string, weightInput: unknown, dateInput?: string, source = "manual") {
  const email = userEmail.toLowerCase();
  const weightKg = validateWeight(weightInput);
  const date = dateInput ? new Date(`${dateInput}T12:00:00.000Z`) : new Date();
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 5 * 60 * 1000) throw new Error("Weight date is invalid");
  const day = date.toISOString().slice(0, 10);
  const id = `${email}:${day}`;
  await db.insert(schema.bodyWeightEntries).values({ id, userEmail: email, recordedAt: date.getTime(), weightKg, source: source.slice(0, 30) })
    .onConflictDoUpdate({ target: schema.bodyWeightEntries.id, set: { recordedAt: date.getTime(), weightKg, source: source.slice(0, 30) } });
  return { id, date: day, weightKg, source };
}

export async function getBodyWeightTrend(db: Db, userEmail: string, days = 90) {
  const email = userEmail.toLowerCase();
  const since = Date.now() - Math.min(365, Math.max(7, days)) * 86400000;
  const rows = await db.select().from(schema.bodyWeightEntries).where(and(eq(schema.bodyWeightEntries.userEmail, email), gte(schema.bodyWeightEntries.recordedAt, since)))
    .orderBy(desc(schema.bodyWeightEntries.recordedAt)).limit(100);
  const entries = rows.map(row => ({ id: row.id, date: new Date(row.recordedAt).toISOString().slice(0, 10), weightKg: row.weightKg, source: row.source }));
  const latest = entries[0] || null;
  const previous = entries[1] || null;
  return { entries, latest, previous, changeKg: latest && previous ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10 : null };
}

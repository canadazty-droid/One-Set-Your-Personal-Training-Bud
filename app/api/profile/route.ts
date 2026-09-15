import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { userProfiles } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { getFormUser } from "../../../lib/form/auth";
import { getProfile, getTrainingGoals, upsertProfile } from "../../../lib/form/profile";
import { recordBodyWeight } from "../../../lib/form/weight";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const db = getDb();
  const existing = await db.select({ email: userProfiles.userEmail }).from(userProfiles).where(eq(userProfiles.userEmail, user.email.toLowerCase())).limit(1);
  const profile = await getProfile(db, user.email);
  return NextResponse.json({ profile, profileExists: existing.length > 0, goals: getTrainingGoals(profile) });
}

export async function PUT(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profile = await upsertProfile(getDb(), user.email, {
    displayName: typeof body.displayName === "string" ? body.displayName : user.displayName,
    trainingGoal: body.trainingGoal as never,
    weeklyDays: typeof body.weeklyDays === "number" ? body.weeklyDays : undefined,
    equipment: body.equipment as never,
    level: body.level as never,
    weightUnit: body.weightUnit === "kg" ? "kg" : body.weightUnit === "lb" ? "lb" : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    advancedProfile: body.advancedProfile,
    gender: typeof body.gender === "string" ? body.gender : undefined,
    age: typeof body.age === "number" ? body.age : undefined,
    heightCm: typeof body.height_cm === "number" ? body.height_cm : typeof body.heightCm === "number" ? body.heightCm : undefined,
    weightKg: typeof body.weight_kg === "number" ? body.weight_kg : typeof body.weightKg === "number" ? body.weightKg : undefined,
    sessionLengthMinutes: typeof body.session_length_minutes === "number" ? body.session_length_minutes : typeof body.sessionLengthMinutes === "number" ? body.sessionLengthMinutes : undefined,
    injuriesOrLimitations: typeof body.injuries_or_limitations === "string" ? body.injuries_or_limitations : undefined,
    preferredTrainingStyle: typeof body.preferred_training_style === "string" ? body.preferred_training_style : undefined,
  });
  if (typeof body.weight_kg === "number" || typeof body.weightKg === "number") {
    await recordBodyWeight(getDb(), user.email, body.weight_kg ?? body.weightKg, undefined, "profile");
  }
  return NextResponse.json({ profile, goals: getTrainingGoals(profile) });
}

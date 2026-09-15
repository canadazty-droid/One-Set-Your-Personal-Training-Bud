import { NextResponse } from "next/server";
import { getFormUser } from "../../../../../lib/form/auth";
import { getProfile } from "../../../../../lib/form/profile";
import { getDb } from "../../../../../db";
import { generateWorkoutFromIntent, parseWorkoutIntent } from "../../../../../packages/workout-domain/index.mjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: { input?: string; intent?: Record<string, unknown> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const profile = await getProfile(getDb(), user.email);
  const intent = body.intent && typeof body.intent === "object" ? body.intent : parseWorkoutIntent(body.input || "");
  return NextResponse.json({ workout: generateWorkoutFromIntent(intent, profile, Date.now()), intent });
}

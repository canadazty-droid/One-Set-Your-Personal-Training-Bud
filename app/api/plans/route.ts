import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { getFormUser } from "../../../lib/form/auth";
import { createWorkoutPlan, getActiveWorkoutPlan, listWorkoutPlans, updateWorkoutPlan } from "../../../lib/form/plans";
import { getProfile } from "../../../lib/form/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const db = getDb();
  const [activePlan, plans] = await Promise.all([
    getActiveWorkoutPlan(db, user.email),
    listWorkoutPlans(db, user.email),
  ]);
  return NextResponse.json({ activePlan, plans });
}

export async function POST(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profile = await getProfile(getDb(), user.email);
  try {
    const plan = await createWorkoutPlan(
      getDb(),
      user.email,
      typeof body.name === "string" ? body.name : "Workout Plan",
      body.schedule ?? body.days ?? body,
      typeof body.equipment === "string" ? body.equipment : profile.equipment,
      body.activate !== false,
    );
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid plan" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.planId !== "string") {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }
  const profile = await getProfile(getDb(), user.email);
  try {
    const plan = await updateWorkoutPlan(
      getDb(),
      user.email,
      body.planId,
      {
        name: typeof body.name === "string" ? body.name : undefined,
        schedule: body.schedule ?? body.days,
        activate: typeof body.activate === "boolean" ? body.activate : undefined,
      },
      typeof body.equipment === "string" ? body.equipment : profile.equipment,
    );
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}

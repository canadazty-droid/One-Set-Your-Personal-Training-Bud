import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { getFormUser } from "../../../../lib/form/auth";
import { generateAndSaveFourWeekPlan } from "../../../../lib/form/fitness-os";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const plan = await generateAndSaveFourWeekPlan(getDb(), user.email);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Plan generation failed" }, { status: 400 });
  }
}

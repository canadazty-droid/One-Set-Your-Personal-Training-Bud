import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { getFormUser } from "../../../../lib/form/auth";
import { getActiveWorkoutPlan, getTodaySession } from "../../../../lib/form/plans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const requestedDay = Number(new URL(request.url).searchParams.get("day"));
  const localDay = Number.isInteger(requestedDay) && requestedDay >= 0 && requestedDay <= 6
    ? requestedDay
    : new Date().getDay();
  const activePlan = await getActiveWorkoutPlan(getDb(), user.email);
  const today = getTodaySession(activePlan, localDay);
  return NextResponse.json({ activePlan, today });
}

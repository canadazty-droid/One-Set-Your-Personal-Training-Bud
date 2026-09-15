import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { getFormUser } from "../../../lib/form/auth";
import { getExerciseHistory } from "../../../lib/form/workouts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const exercise = url.searchParams.get("exercise") || undefined;
  const history = await getExerciseHistory(getDb(), user.email, exercise);
  return NextResponse.json({ history });
}

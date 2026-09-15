import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { getFormUser } from "../../../lib/form/auth";
import { resolveExerciseId } from "../../../lib/form/exercise-resolver";
import { completeWorkout, getRecentWorkouts, logSet, logWorkout, startWorkout } from "../../../lib/form/workouts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const workouts = await getRecentWorkouts(getDb(), user.email, 30, new URL(request.url).searchParams.get("all") === "1");
  return NextResponse.json({ workouts });
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

  try {
    if (body.action === "start_workout") {
      const result = await startWorkout(getDb(), user.email, {
        id: typeof body.workoutId === "string" ? body.workoutId : undefined,
        focus: body.focus as never,
        planId: typeof body.planId === "string" ? body.planId : undefined,
        source: typeof body.source === "string" ? body.source : undefined,
        startedAt: typeof body.startedAt === "number" ? body.startedAt : undefined,
      });
      return NextResponse.json(result, { status: 201 });
    }
    if (body.action === "log_set") {
      const exerciseInput = typeof body.exerciseId === "string" ? body.exerciseId : typeof body.exercise === "string" ? body.exercise : "";
      const exerciseId = resolveExerciseId(exerciseInput) || (exerciseInput && /^[A-Za-z0-9_-]{1,100}$/.test(exerciseInput) ? exerciseInput : null);
      if (!exerciseId) {
        return NextResponse.json({ error: "Could not resolve exercise" }, { status: 400 });
      }
      const result = await logSet(getDb(), user.email, {
        workoutId: typeof body.workoutId === "string" ? body.workoutId : undefined,
        exerciseId,
        setNumber: Number(body.setNumber) || 1,
        weightKg: typeof body.weightLb === "number" ? Number(body.weightLb) * 0.453592 : Number(body.weightKg) || 0,
        reps: Number(body.reps) || 1,
        focus: body.focus as never,
        rpe: typeof body.rpe === "number" ? body.rpe : undefined,
        rir: typeof body.rir === "number" ? body.rir : undefined,
        durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : undefined,
        distanceMeters: typeof body.distanceMeters === "number" ? body.distanceMeters : undefined,
        setType: typeof body.setType === "string" ? body.setType : undefined,
        source: typeof body.source === "string" ? body.source : undefined,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (body.action === "complete_workout") {
      if (typeof body.workoutId !== "string") {
        return NextResponse.json({ error: "workoutId is required" }, { status: 400 });
      }
      const workout = await completeWorkout(getDb(), user.email, body.workoutId, {
        duration: typeof body.duration === "number" ? body.duration : undefined,
        rating: body.rating as never,
      });
      return NextResponse.json({ workout });
    }

    const workout = await logWorkout(getDb(), user.email, body);
    return NextResponse.json({ workout }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workout log failed" }, { status: 400 });
  }
}

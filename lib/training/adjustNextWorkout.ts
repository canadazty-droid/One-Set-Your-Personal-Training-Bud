import { getWorkoutLogs } from "../storage/log-store";
import { adjustNextWorkout as applyAdjustment, describeAdjustment } from "./adjustment-rules.mjs";

export type AdjustedWorkout<Exercise = unknown> = {
  workoutId: string; focusArea: string; estimatedMinutes: number;
  intensity: "light" | "normal" | "hard"; exercises: Exercise[]; adjustmentReason: string;
};

export async function adjustNextWorkout<Exercise = unknown>(userId: string, base: { workoutId?: string; focusArea?: string; estimatedMinutes?: number; intensity?: "light" | "normal" | "hard"; exercises?: Exercise[] } = {}): Promise<AdjustedWorkout<Exercise>> {
  const stored = await getWorkoutLogs(userId);
  const logs = stored.map(item => ({ ...(item.payload || {}), date: item.workoutDate, completed: item.completed, perceivedDifficulty: item.perceivedDifficulty, energyLevel: item.energyLevel, sorenessLevel: item.sorenessLevel }));
  const adjusted = applyAdjustment({ durationMinutes: base.estimatedMinutes || 45, focus: base.focusArea || "full", intensity: base.intensity || "normal" }, logs);
  let exercises = [...(base.exercises || [])] as Array<Exercise & { sets?: number }>;
  if (adjusted.exerciseDelta < 0) exercises.splice(Math.max(0, exercises.length + adjusted.exerciseDelta));
  if (adjusted.setDelta) exercises = exercises.map(exercise => typeof exercise.sets === "number" ? { ...exercise, sets: Math.max(1, exercise.sets + adjusted.setDelta) } : exercise);
  return { workoutId: base.workoutId || crypto.randomUUID(), focusArea: adjusted.focus, estimatedMinutes: adjusted.durationMinutes, intensity: adjusted.intensity, exercises: exercises as Exercise[], adjustmentReason: describeAdjustment(adjusted.adjustmentReason, "zh") };
}

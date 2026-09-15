export type WorkoutIntensity = "light" | "normal" | "hard";

export type WorkoutExerciseSeed = {
  id: string;
  name: string;
  nameZh?: string;
  reps: string;
  restSeconds: number;
  notes: string;
};

export type GeneratedWorkoutExercise = WorkoutExerciseSeed & {
  sets: number;
};

export type GeneratedWorkout = {
  id: string;
  userId: string;
  workoutName: string;
  focusArea: string;
  estimatedMinutes: number;
  intensity: WorkoutIntensity;
  exercises: GeneratedWorkoutExercise[];
  adjustmentReason: string;
  createdAt: string;
};

type GenerateWorkoutInput = {
  userId: string;
  focusArea: string;
  estimatedMinutes: number;
  intensity?: WorkoutIntensity;
  goal: "strength" | "muscle" | "fatloss" | "general";
  novice: boolean;
  exercises: WorkoutExerciseSeed[];
  setDelta?: number;
  adjustmentReason?: string;
  now?: Date;
};

const baseSetCount = (duration: number, goal: GenerateWorkoutInput["goal"], novice: boolean) => {
  if (duration <= 25 || novice) return 2;
  if (goal === "strength") return duration >= 55 ? 4 : 3;
  if (goal === "muscle") return duration >= 45 ? 4 : 3;
  if (goal === "fatloss") return duration >= 55 ? 3 : 2;
  return duration >= 55 ? 4 : 3;
};

export function generateWorkout(input: GenerateWorkoutInput): GeneratedWorkout {
  const estimatedMinutes = Math.max(15, Math.min(90, Math.round(input.estimatedMinutes / 5) * 5));
  const intensity = input.intensity || "normal";
  const sets = Math.max(1, baseSetCount(estimatedMinutes, input.goal, input.novice) + (input.setDelta || 0));
  const now = input.now || new Date();
  const id = globalThis.crypto?.randomUUID?.() || `workout-${now.getTime()}`;

  return {
    id,
    userId: input.userId,
    workoutName: `${input.focusArea.replaceAll("_", " ")} workout`,
    focusArea: input.focusArea,
    estimatedMinutes,
    intensity,
    exercises: input.exercises.map((exercise, index) => ({
      ...exercise,
      sets: Math.max(1, sets + ((input.setDelta || 0) > 0 && index > 1 ? -1 : 0)),
    })),
    adjustmentReason: input.adjustmentReason || "",
    createdAt: now.toISOString(),
  };
}

export type WorkoutIntent = { rawInput?: string; durationMinutes?: number; muscleGroups: string[]; energy: "low" | "normal" | "high"; intensity: "light" | "normal" | "hard"; excludedExercises: string[] };
export function parseWorkoutIntent(rawInput?: string): WorkoutIntent;
export function generateWorkoutFromIntent(intent?: Partial<WorkoutIntent>, profile?: Record<string, unknown>, seed?: number): Record<string, any>;
export function parseImportedPlan(rawInput?: string): { name: string; exercises: Array<Record<string, any>>; confidence: string; warnings: string[] };
export function parseNaturalLanguageLog(rawInput?: string): { entries: Array<Record<string, any>>; warnings: string[]; confidence: string };
export function summarizeCompletedWorkout(workout: Record<string, any>, completedSets?: Array<Record<string, any>>, previousVolume?: number): Record<string, any>;
export const EXERCISES: Record<string, Array<Record<string, any>>>;
export const GROUP_LABELS: Record<string, string>;

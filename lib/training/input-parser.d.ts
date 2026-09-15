export type WorkoutRequest = {
  durationMinutes?: number;
  focusAreas?: string[];
  intensity?: "light" | "normal" | "hard";
  excludedExercises?: string[];
  rawInput?: string;
};
export function parseWorkoutInput(input?: string): WorkoutRequest;
export function mapFocusAreas(focusAreas?: string[], fallback?: string): string;

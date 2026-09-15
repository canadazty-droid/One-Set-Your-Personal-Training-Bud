export type WorkoutRequest = {
  durationMinutes?: number;
  focusAreas?: string[];
  intensity?: "light" | "normal" | "hard";
  excludedExercises?: string[];
  rawInput?: string;
};

export { mapFocusAreas, parseWorkoutInput } from "./input-parser.mjs";

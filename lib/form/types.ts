export type Focus = "full" | "upper" | "lower" | "pushpull" | "core";
export type Equipment = "gym" | "dumbbell" | "bodyweight";
export type Level = "beginner" | "intermediate" | "advanced";
export type TrainingGoal = "strength" | "muscle" | "fatloss" | "general";
export type SessionRating = "easy" | "right" | "hard" | "pain";

export type AdvancedTrainingProfile = {
  experience: "new" | "some" | "regular" | "advanced";
  weeklyDays: number;
  recovery: "low" | "normal" | "high";
  painAreas: Array<"knees" | "shoulders" | "back" | "hips">;
  heightCm: string;
  weightKg: string;
};

export type PlanExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weightKg?: number | null;
  restSeconds?: number;
};

export type PlanDay = {
  dayLabel: string;
  dayOfWeek: number;
  name: string;
  focus: Focus;
  exercises: PlanExercise[];
};

export type WorkoutPlanSchedule = {
  days: PlanDay[];
};

export type UserProfile = {
  email: string;
  displayName: string | null;
  trainingGoal: TrainingGoal;
  weeklyDays: number;
  equipment: Equipment;
  level: Level;
  weightUnit: "kg" | "lb";
  notes: string;
  advancedProfile: AdvancedTrainingProfile;
  gender: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sessionLengthMinutes: number;
  injuriesOrLimitations: string;
  preferredTrainingStyle: string;
  updatedAt: string;
};

export type WorkoutSummary = {
  id: string;
  date: string;
  focus: Focus;
  duration: number;
  exercises: number;
  sets: number;
  totalVolume: number;
  rating: SessionRating;
  perceivedDifficulty?: number | null;
  energyLevel?: number | null;
  sorenessLevel?: number | null;
  notes?: string;
  completed?: boolean;
  performances: Array<{
    exerciseId: string;
    setNumber: number;
    weightKg: number;
    reps: number;
    notes?: string;
    rpe?: number | null;
    rir?: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    setType?: string;
    completedAt?: string | null;
    source?: string;
  }>;
};

export type ExerciseHistoryEntry = {
  exerciseId: string;
  name: string;
  sessions: number;
  latest: { date: string; weightKg: number; reps: number; setNumber: number } | null;
  trend: Array<{ date: string; bestWeightKg: number; bestReps: number }>;
};

export type PersonalRecord = {
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
  date: string;
  estimatedOneRepMax?: number;
};

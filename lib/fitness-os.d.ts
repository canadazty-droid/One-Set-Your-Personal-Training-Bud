export type FitnessProfileInput = Record<string, unknown>;
export type FitnessCycle = {
  plan_version: number;
  start_date: string;
  end_date: string;
  goal: string;
  weekly_training_days: number;
  adjustment_reason: string;
  weeks: Array<Record<string, any>>;
};
export function normalizeFitnessProfile(input?: FitnessProfileInput): Record<string, any>;
export function generateFourWeekPlan(profile: FitnessProfileInput, options?: Record<string, unknown>): FitnessCycle;
export function buildWeeklyReview(logs?: Array<Record<string, any>>, scheduledWorkoutCount?: number, options?: Record<string, unknown>): Record<string, any>;
export function adjustPlanVersion(plan: FitnessCycle, review: Record<string, any>): FitnessCycle;

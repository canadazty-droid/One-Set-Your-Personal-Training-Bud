import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { adjustPlanVersion, buildWeeklyReview } from "../fitness-os.mjs";
import { generateVersionBTrainingPlan } from "../training/plan-generator.mjs";
import { createWorkoutPlan, getActiveWorkoutPlan } from "./plans";
import { getProfile } from "./profile";

type Db = DrizzleD1Database<typeof schema>;

function engineProfile(profile: Awaited<ReturnType<typeof getProfile>>) {
  const advanced = profile.advancedProfile;
  const goalMap = { fatloss: "fat_loss", muscle: "muscle_gain", strength: "strength", general: "recomposition" } as const;
  return {
    name: profile.displayName || profile.email.split("@")[0] || "Athlete",
    gender: profile.gender || "unspecified",
    age: profile.age || 30,
    height_cm: profile.heightCm || Number(advanced.heightCm) || 170,
    weight_kg: profile.weightKg || Number(advanced.weightKg) || 70,
    goal: goalMap[profile.trainingGoal],
    training_experience: profile.level,
    weekly_training_days: profile.weeklyDays,
    session_length_minutes: profile.sessionLengthMinutes || 45,
    available_equipment: profile.equipment,
    injuries_or_limitations: profile.injuriesOrLimitations || advanced.painAreas.join(", ") || "none",
    preferred_training_style: profile.preferredTrainingStyle || "balanced",
    current_energy_level: profile.advancedProfile.recovery === "low" ? 4 : profile.advancedProfile.recovery === "high" ? 8 : 6,
    current_soreness_level: profile.advancedProfile.painAreas.length ? 8 : 3,
  };
}

function weekToSchedule(cycle: any) {
  const firstWeek = cycle.weeks[0];
  return {
    days: firstWeek.days.map((day: any) => ({
      dayLabel: day.day_label,
      dayOfWeek: day.day_of_week,
      name: `${day.focus_area[0].toUpperCase()}${day.focus_area.slice(1)} · Week 1`,
      focus: day.focus_area === "push" || day.focus_area === "pull" ? "pushpull" : day.focus_area,
      exercises: day.exercises.map((exercise: any) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.rest_seconds,
      })),
    })),
  };
}

export async function generateAndSaveFourWeekPlan(db: Db, userEmail: string) {
  const profile = await getProfile(db, userEmail);
  const existing = await db.select({ planVersion: schema.workoutPlans.planVersion }).from(schema.workoutPlans)
    .where(eq(schema.workoutPlans.userEmail, userEmail.toLowerCase())).orderBy(desc(schema.workoutPlans.planVersion)).limit(1);
  const cycle = generateVersionBTrainingPlan(engineProfile(profile), { version: (existing[0]?.planVersion || 0) + 1 });
  return createWorkoutPlan(db, userEmail, `4-Week ${cycle.goal.replaceAll("_", " ")} Plan`, weekToSchedule(cycle), profile.equipment, true, {
    planVersion: cycle.plan_version,
    startDate: cycle.start_date,
    endDate: cycle.end_date,
    goal: cycle.goal,
    weeklyTrainingDays: cycle.weekly_training_days,
    adjustmentReason: cycle.adjustment_reason,
    cycle,
  });
}

export async function createOrGetWeeklyReview(db: Db, userEmail: string, weekEndInput?: string) {
  const email = userEmail.toLowerCase();
  const end = weekEndInput ? new Date(`${weekEndInput}T23:59:59.999Z`) : new Date();
  if (Number.isNaN(end.getTime())) throw new Error("Invalid week end date");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  start.setUTCHours(0, 0, 0, 0);
  const weekStart = start.toISOString().slice(0, 10);
  const weekEnd = end.toISOString().slice(0, 10);
  const existing = await db.select().from(schema.weeklyReviews).where(and(
    eq(schema.weeklyReviews.userEmail, email), eq(schema.weeklyReviews.weekStart, weekStart), eq(schema.weeklyReviews.weekEnd, weekEnd),
  )).limit(1);
  if (existing.length) return serializeReview(existing[0]);
  const [plan, rows] = await Promise.all([
    getActiveWorkoutPlan(db, email),
    db.select().from(schema.workouts).where(and(
      eq(schema.workouts.userEmail, email), gte(schema.workouts.completedAt, start.getTime()), lte(schema.workouts.completedAt, end.getTime()),
    )),
  ]);
  const logs = rows.map(row => ({
    workout_date: new Date(row.completedAt).toISOString(),
    completed: row.status === "completed",
    completed_exercises: row.exerciseCount,
    actual_sets: row.setCount,
    energy_level: row.energyLevel ?? 5,
    soreness_level: row.sorenessLevel ?? 5,
  }));
  const review = buildWeeklyReview(logs, plan?.weeklyTrainingDays || 3, { weekStart, weekEnd });
  const id = crypto.randomUUID();
  await db.insert(schema.weeklyReviews).values({
    id, userEmail: email, planId: plan?.id || null, weekStart, weekEnd,
    completionRate: review.completion_rate, averageEnergy: review.average_energy,
    averageSoreness: review.average_soreness, missedWorkouts: review.missed_workouts,
    bestPerformedDay: review.best_performed_day, riskFlagsJson: JSON.stringify(review.risk_flags),
    nextWeekAdjustment: review.next_week_adjustment, createdAt: Date.now(),
  });
  return { id, planId: plan?.id || null, ...review };
}

export async function adjustAndSaveNextPlan(db: Db, userEmail: string) {
  const active = await getActiveWorkoutPlan(db, userEmail);
  if (!active || !active.cycle || typeof active.cycle !== "object") throw new Error("Generate a four-week plan first");
  const review = await createOrGetWeeklyReview(db, userEmail);
  const cycle = adjustPlanVersion(active.cycle as any, review);
  const profile = await getProfile(db, userEmail);
  return createWorkoutPlan(db, userEmail, `${active.name} · v${cycle.plan_version}`, weekToSchedule(cycle), profile.equipment, true, {
    planVersion: cycle.plan_version,
    parentPlanId: active.id,
    startDate: cycle.start_date,
    endDate: cycle.end_date,
    goal: cycle.goal,
    weeklyTrainingDays: cycle.weekly_training_days,
    adjustmentReason: cycle.adjustment_reason,
    cycle,
  });
}

function serializeReview(row: typeof schema.weeklyReviews.$inferSelect) {
  return {
    id: row.id, planId: row.planId, week_start: row.weekStart, week_end: row.weekEnd,
    completion_rate: row.completionRate, average_energy: row.averageEnergy,
    average_soreness: row.averageSoreness, missed_workouts: row.missedWorkouts,
    best_performed_day: row.bestPerformedDay, risk_flags: JSON.parse(row.riskFlagsJson),
    next_week_adjustment: row.nextWeekAdjustment,
    created_at: new Date(row.createdAt).toISOString(),
  };
}

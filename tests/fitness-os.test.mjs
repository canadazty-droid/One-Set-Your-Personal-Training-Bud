import test from "node:test";
import assert from "node:assert/strict";
import { adjustPlanVersion, buildWeeklyReview, generateFourWeekPlan, normalizeFitnessProfile } from "../lib/fitness-os.mjs";

const profile = {
  name: "Paul", gender: "male", age: 35, height_cm: 178, weight_kg: 80,
  goal: "muscle_gain", training_experience: "beginner", weekly_training_days: 4,
  session_length_minutes: 45, available_equipment: "gym", injuries_or_limitations: "none", preferred_training_style: "hypertrophy",
};

test("onboarding validation rejects incomplete profiles", () => {
  assert.throws(() => normalizeFitnessProfile({ name: "" }), /Missing or invalid profile fields/);
});

test("rule engine creates four progressive weeks", () => {
  const plan = generateFourWeekPlan(profile, { startDate: "2026-08-19", version: 2 });
  assert.equal(plan.plan_version, 2);
  assert.equal(plan.weeks.length, 4);
  assert.ok(plan.weeks.every(week => week.days.length === 4));
  assert.ok(plan.weeks[2].days[0].exercises[0].sets > plan.weeks[0].days[0].exercises[0].sets);
  assert.ok(plan.weeks[3].days[0].exercises[0].sets < plan.weeks[2].days[0].exercises[0].sets);
});

test("weekly review follows completion and recovery rules", () => {
  const low = buildWeeklyReview([{ completed: true, energy_level: 4, soreness_level: 8 }], 4);
  assert.equal(low.completion_rate, 25);
  assert.ok(low.risk_flags.includes("low_completion"));
  assert.ok(low.risk_flags.includes("high_soreness"));
  assert.equal(low.next_week_adjustment, "reduce_intensity_and_add_recovery");
  const strong = buildWeeklyReview(Array.from({ length: 4 }, (_, index) => ({ completed: true, energy_level: 8, soreness_level: 3, workout_date: `2026-08-${10 + index}` })), 4);
  assert.equal(strong.next_week_adjustment, "increase_volume_5");
});

test("adjustment creates a new version and preserves the original", () => {
  const original = generateFourWeekPlan(profile, { startDate: "2026-08-19", version: 1 });
  const originalSets = original.weeks[0].days[0].exercises[0].sets;
  const next = adjustPlanVersion(original, { next_week_adjustment: "reduce_volume_15" });
  assert.equal(next.plan_version, 2);
  assert.notEqual(next.start_date, original.start_date);
  assert.equal(original.weeks[0].days[0].exercises[0].sets, originalSets);
  assert.ok(next.weeks[0].days[0].exercises[0].sets <= originalSets);
});

test("goal rules add cardio for fat loss and compounds for gym strength", () => {
  const fatLoss = generateFourWeekPlan({ ...profile, goal: "fat_loss" });
  assert.match(fatLoss.weeks[0].days[0].exercises.at(-1).name, /Air Bike|March/);
  const strength = generateFourWeekPlan({ ...profile, goal: "strength", training_experience: "intermediate" });
  assert.match(strength.weeks[0].days[0].exercises[0].name, /Barbell/);
  assert.equal(strength.weeks[0].days[0].exercises[0].reps, "4-6");
});

test("strong weeks add visible volume and repeated misses reschedule days", () => {
  const original = generateFourWeekPlan(profile, { startDate: "2026-08-19" });
  const next = adjustPlanVersion(original, { next_week_adjustment: "increase_volume_5", missed_workouts: 2 });
  assert.equal(next.weeks[0].days[0].exercises[0].sets, original.weeks[0].days[0].exercises[0].sets + 1);
  assert.notEqual(next.weeks[0].days[1].day_of_week, original.weeks[0].days[1].day_of_week);
  assert.match(next.weeks[0].days[0].notes, /Rescheduled/);
});

test("schema persists plan details, recovery logs, reviews, weight history, and audit fields", async () => {
  const fs = await import("node:fs/promises");
  const [schema, migration, auditMigration, dashboard, workouts, mcp, planShortcut, logShortcut, home] = await Promise.all([
    fs.readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0008_weight_and_plan_details.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../drizzle/0009_audit_fields.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../lib/form/workouts.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../mcp/server.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/plan/page.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/log/page.tsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const table of ["trainingDays", "planExercises", "bodyWeightEntries", "weeklyReviews"]) assert.match(schema, new RegExp(table));
  for (const table of ["training_days", "plan_exercises", "body_weight_entries"]) assert.ok(migration.includes(`CREATE TABLE \`${table}\``));
  assert.match(dashboard, /BODY WEIGHT TREND/);
  assert.match(dashboard, /\/api\/weight/);
  assert.match(workouts, /completed \? "completed" : "missed"/);
  assert.match(auditMigration, /user_profiles.*created_at/s);
  assert.match(auditMigration, /workout_sets.*notes/s);
  assert.match(mcp, /validateToolArguments/);
  assert.match(planShortcut, /redirect\("\/training-plan"\)/);
  assert.match(logShortcut, /redirect\("\/workout-log"\)/);
  assert.match(home, /\/onboarding/);
});

test("MCP exposes the seven required Fitness OS tools", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../mcp/server.mjs", import.meta.url), "utf8"));
  for (const name of ["get_user_profile", "update_user_profile", "generate_training_plan", "get_today_workout", "log_workout", "get_weekly_review", "adjust_next_week_plan"]) {
    assert.match(source, new RegExp(`name: \\"${name}\\"`));
  }
});

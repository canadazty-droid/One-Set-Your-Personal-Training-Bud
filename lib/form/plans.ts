import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { getExerciseName, parseRepRange, resolveExerciseId } from "./exercise-resolver";
import type { Focus, PlanDay, PlanExercise, WorkoutPlanSchedule } from "./types";

type Db = DrizzleD1Database<typeof schema>;

const focuses = new Set<Focus>(["full", "upper", "lower", "pushpull", "core"]);

type IncomingExercise = {
  exerciseId?: unknown;
  name?: unknown;
  sets?: unknown;
  reps?: unknown;
  repsMin?: unknown;
  repsMax?: unknown;
  weightKg?: unknown;
  weightLb?: unknown;
  restSeconds?: unknown;
};

type IncomingDay = {
  dayLabel?: unknown;
  dayOfWeek?: unknown;
  name?: unknown;
  focus?: unknown;
  exercises?: unknown;
};

function boundedInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

const dayNames:Record<string,number>={sunday:0,sun:0,"周日":0,"星期日":0,monday:1,mon:1,"周一":1,"星期一":1,tuesday:2,tue:2,"周二":2,"星期二":2,wednesday:3,wed:3,"周三":3,"星期三":3,thursday:4,thu:4,"周四":4,"星期四":4,friday:5,fri:5,"周五":5,"星期五":5,saturday:6,sat:6,"周六":6,"星期六":6};
const localizedDayNames: Record<string, number> = {
  sunday: 0, sun: 0, "周日": 0, "星期日": 0, "星期天": 0,
  monday: 1, mon: 1, "周一": 1, "星期一": 1,
  tuesday: 2, tue: 2, "周二": 2, "星期二": 2,
  wednesday: 3, wed: 3, "周三": 3, "星期三": 3,
  thursday: 4, thu: 4, "周四": 4, "星期四": 4,
  friday: 5, fri: 5, "周五": 5, "星期五": 5,
  saturday: 6, sat: 6, "周六": 6, "星期六": 6,
};
function inferDayOfWeek(value:unknown,index:number){
  const numeric=Number(value);if(Number.isInteger(numeric)&&numeric>=0&&numeric<=6)return numeric;
  const label=typeof value==="string"?value.trim().toLowerCase():"";
  const match=Object.entries(localizedDayNames).find(([name])=>label===name||label.startsWith(`${name} `));
  return match?match[1]:(index<5?[1,2,4,5,6][index]:index%7);
}

function normalizeDay(day: IncomingDay, equipment: string, index: number): PlanDay | null {
  const exercisesRaw = Array.isArray(day.exercises) ? day.exercises.slice(0, 20) as IncomingExercise[] : [];
  const exercises: PlanExercise[] = [];
  for (const item of exercisesRaw) {
    const name = typeof item.name === "string" ? item.name : typeof item.exerciseId === "string" ? item.exerciseId : "";
    const exerciseId = typeof item.exerciseId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(item.exerciseId)
      ? item.exerciseId
      : resolveExerciseId(name, equipment);
    if (!exerciseId) continue;
    const reps = parseRepRange(item.reps, {
      min: boundedInt(item.repsMin, 1, 100, 8),
      max: boundedInt(item.repsMax, 1, 100, 12),
    });
    const weightKg = typeof item.weightKg === "number"
      ? boundedNumber(item.weightKg, 0, 1000, 0)
      : typeof item.weightLb === "number"
        ? boundedNumber(item.weightLb, 0, 2200, 0) * 0.453592
        : null;
    exercises.push({
      exerciseId,
      name: name || getExerciseName(exerciseId),
      sets: boundedInt(item.sets, 1, 10, 3),
      repsMin: reps.min,
      repsMax: reps.max,
      weightKg,
      restSeconds: boundedInt(item.restSeconds, 15, 300, 60),
    });
  }
  if (!exercises.length) return null;
  const focus = typeof day.focus === "string" && focuses.has(day.focus as Focus) ? day.focus as Focus : "full";
  return {
    dayLabel: typeof day.dayLabel === "string" && day.dayLabel.trim() ? day.dayLabel.trim().slice(0, 40) : `Day ${index + 1}`,
    dayOfWeek: inferDayOfWeek(day.dayOfWeek ?? day.dayLabel, index),
    name: typeof day.name === "string" && day.name.trim() ? day.name.trim().slice(0, 60) : focus.toUpperCase(),
    focus,
    exercises,
  };
}

export function normalizeSchedule(input: unknown, equipment = "gym"): WorkoutPlanSchedule {
  const daysRaw = input && typeof input === "object"
    ? Array.isArray((input as { days?: unknown }).days)
      ? (input as { days: IncomingDay[] }).days
      : Array.isArray(input)
        ? input as IncomingDay[]
        : []
    : [];
  const days = daysRaw.map((day, index) => normalizeDay(day, equipment, index)).filter((day): day is PlanDay => Boolean(day));
  if (!days.length) throw new Error("At least one valid training day with exercises is required");
  return { days };
}

export async function createWorkoutPlan(
  db: Db,
  userEmail: string,
  name: string,
  scheduleInput: unknown,
  equipment = "gym",
  activate = true,
  metadata?: {
    planVersion?: number;
    parentPlanId?: string | null;
    startDate?: string;
    endDate?: string;
    goal?: string;
    weeklyTrainingDays?: number;
    adjustmentReason?: string;
    cycle?: unknown;
  },
) {
  const email = userEmail.toLowerCase();
  const schedule = normalizeSchedule(scheduleInput, equipment);
  const id = crypto.randomUUID();
  const now = Date.now();
  if (activate) {
    await db.update(schema.workoutPlans).set({ active: false, updatedAt: now }).where(eq(schema.workoutPlans.userEmail, email));
  }
  await db.insert(schema.workoutPlans).values({
    id,
    userEmail: email,
    name: name.trim().slice(0, 120) || "Workout Plan",
    scheduleJson: JSON.stringify(schedule),
    active: activate,
    planVersion: metadata?.planVersion ?? 1,
    parentPlanId: metadata?.parentPlanId ?? null,
    startDate: metadata?.startDate ?? null,
    endDate: metadata?.endDate ?? null,
    goal: metadata?.goal ?? "recomposition",
    weeklyTrainingDays: metadata?.weeklyTrainingDays ?? schedule.days.length,
    adjustmentReason: metadata?.adjustmentReason ?? "Initial plan",
    cycleJson: JSON.stringify(metadata?.cycle ?? {}),
    createdAt: now,
    updatedAt: now,
  });
  const cycleWeeks = metadata?.cycle && typeof metadata.cycle === "object" && Array.isArray((metadata.cycle as { weeks?: unknown }).weeks)
    ? (metadata.cycle as { weeks: Array<Record<string, unknown>> }).weeks
    : [];
  const dayRows: Array<typeof schema.trainingDays.$inferInsert> = [];
  const exerciseRows: Array<typeof schema.planExercises.$inferInsert> = [];
  for (const [weekIndex, week] of cycleWeeks.entries()) {
    const weekNumber = boundedInt(week.week_number, 1, 52, weekIndex + 1);
    const days = Array.isArray(week.days) ? week.days as Array<Record<string, unknown>> : [];
    for (const [dayIndex, day] of days.entries()) {
      const trainingDayId = `${id}-w${weekNumber}-d${dayIndex + 1}`;
      dayRows.push({ id: trainingDayId, planId: id, weekNumber, dayNumber: boundedInt(day.day_number, 1, 7, dayIndex + 1), dayOfWeek: boundedInt(day.day_of_week, 0, 6, dayIndex + 1), focusArea: String(day.focus_area || "full").slice(0, 40), notes: String(day.notes || "").slice(0, 1000) });
      const exercises = Array.isArray(day.exercises) ? day.exercises as Array<Record<string, unknown>> : [];
      exercises.forEach((exercise, exerciseIndex) => exerciseRows.push({
        id: `${trainingDayId}-e${exerciseIndex + 1}`, trainingDayId, name: String(exercise.name || `Exercise ${exerciseIndex + 1}`).slice(0, 120),
        sets: boundedInt(exercise.sets, 1, 20, 3), reps: String(exercise.reps || "8-12").slice(0, 30), restSeconds: boundedInt(exercise.rest_seconds, 15, 600, 60), notes: String(exercise.notes || "").slice(0, 1000),
      }));
    }
  }
  if (dayRows.length && exerciseRows.length) {
    await db.insert(schema.trainingDays).values(dayRows);
    for (let index = 0; index < exerciseRows.length; index += 10) {
      await db.insert(schema.planExercises).values(exerciseRows.slice(index, index + 10));
    }
  }
  return getWorkoutPlan(db, email, id);
}

export async function updateWorkoutPlan(
  db: Db,
  userEmail: string,
  planId: string,
  patch: { name?: string; schedule?: unknown; activate?: boolean },
  equipment = "gym",
) {
  const email = userEmail.toLowerCase();
  const existing = await db.select().from(schema.workoutPlans)
    .where(and(eq(schema.workoutPlans.id, planId), eq(schema.workoutPlans.userEmail, email)))
    .limit(1);
  if (!existing.length) throw new Error("Plan not found");
  const now = Date.now();
  const schedule = patch.schedule ? normalizeSchedule(patch.schedule, equipment) : JSON.parse(existing[0].scheduleJson) as WorkoutPlanSchedule;
  if (patch.activate) {
    await db.update(schema.workoutPlans).set({ active: false, updatedAt: now }).where(eq(schema.workoutPlans.userEmail, email));
  }
  await db.update(schema.workoutPlans).set({
    name: patch.name?.trim().slice(0, 120) || existing[0].name,
    scheduleJson: JSON.stringify(schedule),
    active: patch.activate ?? existing[0].active,
    updatedAt: now,
  }).where(eq(schema.workoutPlans.id, planId));
  return getWorkoutPlan(db, email, planId);
}

export async function getWorkoutPlan(db: Db, userEmail: string, planId: string) {
  const email = userEmail.toLowerCase();
  const row = await db.select().from(schema.workoutPlans)
    .where(and(eq(schema.workoutPlans.id, planId), eq(schema.workoutPlans.userEmail, email)))
    .limit(1);
  if (!row.length) return null;
  return serializePlan(row[0]);
}

export async function getActiveWorkoutPlan(db: Db, userEmail: string) {
  const email = userEmail.toLowerCase();
  const rows = await db.select().from(schema.workoutPlans)
    .where(and(eq(schema.workoutPlans.userEmail, email), eq(schema.workoutPlans.active, true)))
    .orderBy(desc(schema.workoutPlans.updatedAt))
    .limit(1);
  if (!rows.length) return null;
  return serializePlan(rows[0]);
}

export async function listWorkoutPlans(db: Db, userEmail: string) {
  const email = userEmail.toLowerCase();
  const rows = await db.select().from(schema.workoutPlans)
    .where(eq(schema.workoutPlans.userEmail, email))
    .orderBy(desc(schema.workoutPlans.updatedAt))
    .limit(20);
  return rows.map(serializePlan);
}

export function getTodaySession(plan: ReturnType<typeof serializePlan> | null, dateOrDay: Date | number = new Date()) {
  if (!plan) return null;
  const dayOfWeek = typeof dateOrDay === "number"
    ? Math.min(6, Math.max(0, Math.round(dateOrDay)))
    : dateOrDay.getDay();
  const exact = plan.schedule.days.find(day => day.dayOfWeek === dayOfWeek);
  const matched = exact ?? [...plan.schedule.days].sort((a,b)=>((a.dayOfWeek-dayOfWeek+7)%7||7)-((b.dayOfWeek-dayOfWeek+7)%7||7))[0];
  if (!matched) return null;
  const daysUntil=exact?0:((matched.dayOfWeek-dayOfWeek+7)%7||7);
  return {
    planId: plan.id,
    planName: plan.name,
    dayLabel: matched.dayLabel,
    dayName: matched.name,
    focus: matched.focus,
    exercises: matched.exercises,
    isRestDay:!exact,
    daysUntil,
  };
}

function serializePlan(row: typeof schema.workoutPlans.$inferSelect) {
  let cycle: unknown = null;
  try { cycle = JSON.parse(row.cycleJson); } catch { cycle = null; }
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    planVersion: row.planVersion,
    parentPlanId: row.parentPlanId,
    startDate: row.startDate,
    endDate: row.endDate,
    goal: row.goal,
    weeklyTrainingDays: row.weeklyTrainingDays,
    adjustmentReason: row.adjustmentReason,
    cycle,
    schedule: JSON.parse(row.scheduleJson) as WorkoutPlanSchedule,
  };
}

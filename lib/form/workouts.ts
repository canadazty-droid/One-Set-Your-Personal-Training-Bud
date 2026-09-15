import { and, desc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { getExerciseName, resolveExerciseId } from "./exercise-resolver";
import type { ExerciseHistoryEntry, Focus, PersonalRecord, SessionRating, WorkoutSummary } from "./types";

type Db = DrizzleD1Database<typeof schema>;

const focuses = new Set<Focus>(["full", "upper", "lower", "pushpull", "core"]);
const sessionRatings = new Set<SessionRating>(["easy", "right", "hard", "pain"]);

type IncomingSet = {
  exerciseId?: unknown;
  setNumber?: unknown;
  weightKg?: unknown;
  reps?: unknown;
  notes?: unknown;
  rpe?: unknown;
  rir?: unknown;
  durationSeconds?: unknown;
  distanceMeters?: unknown;
  setType?: unknown;
  completed?: unknown;
  completedAt?: unknown;
  source?: unknown;
};

const setTypes = new Set(["warmup", "working", "failure", "drop"]);
const sources = new Set(["mini_program", "web", "cli", "mcp", "imported_plan", "natural_language_log"]);
const validWorkoutId = (value: unknown): value is string => typeof value === "string" && (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^(?:oneset|workout)-\d+-?[0-9a-f]*$/i.test(value));

function boundedInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function estimateOneRepMax(weightKg: number, reps: number) {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export async function getRecentWorkouts(db: Db, userEmail: string, limit = 30, includeIncomplete = false): Promise<WorkoutSummary[]> {
  const email = userEmail.toLowerCase();
  const rows = await db.select().from(schema.workouts)
    .where(includeIncomplete ? eq(schema.workouts.userEmail, email) : and(eq(schema.workouts.userEmail, email), eq(schema.workouts.status, "completed")))
    .orderBy(desc(schema.workouts.completedAt))
    .limit(limit);
  const workoutIds = rows.map(row => row.id);
  const sets = workoutIds.length
    ? await db.select().from(schema.workoutSets).where(inArray(schema.workoutSets.workoutId, workoutIds))
    : [];
  const setsByWorkout = new Map<string, typeof sets>();
  for (const set of sets) {
    const current = setsByWorkout.get(set.workoutId) || [];
    current.push(set);
    setsByWorkout.set(set.workoutId, current);
  }
  return rows.map(row => ({
    id: row.id,
    date: new Date(row.completedAt).toISOString(),
    focus: focuses.has(row.focus as Focus) ? row.focus as Focus : "full",
    duration: row.durationMinutes,
    exercises: row.exerciseCount,
    sets: row.setCount,
    totalVolume: row.totalVolumeKg,
    rating: sessionRatings.has(row.sessionRating as SessionRating) ? row.sessionRating as SessionRating : "right",
    perceivedDifficulty: row.perceivedDifficulty,
    energyLevel: row.energyLevel,
    sorenessLevel: row.sorenessLevel,
    notes: row.notes,
    completed: row.status === "completed",
    performances: (setsByWorkout.get(row.id) || [])
      .sort((a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.setNumber - b.setNumber)
      .map(set => ({
        exerciseId: set.exerciseId,
        setNumber: set.setNumber,
        weightKg: set.weightKg,
        reps: set.reps,
        notes: set.notes,
        rpe: set.rpe,
        rir: set.rir,
        durationSeconds: set.durationSeconds,
        distanceMeters: set.distanceMeters,
        setType: set.setType,
        completedAt: set.completedAt ? new Date(set.completedAt).toISOString() : null,
        source: set.source,
      })),
  }));
}

export async function getExerciseHistory(db: Db, userEmail: string, exerciseQuery?: string, limit = 12): Promise<ExerciseHistoryEntry[]> {
  const workouts = await getRecentWorkouts(db, userEmail, 60);
  const byExercise = new Map<string, ExerciseHistoryEntry>();

  for (const workout of workouts) {
    const seenInWorkout = new Set<string>();
    for (const set of workout.performances) {
      if (exerciseQuery) {
        const query = exerciseQuery.toLowerCase();
        const name = getExerciseName(set.exerciseId).toLowerCase();
        if (!set.exerciseId.toLowerCase().includes(query) && !name.includes(query)) continue;
      }
      if (!byExercise.has(set.exerciseId)) {
        byExercise.set(set.exerciseId, {
          exerciseId: set.exerciseId,
          name: getExerciseName(set.exerciseId),
          sessions: 0,
          latest: null,
          trend: [],
        });
      }
      const entry = byExercise.get(set.exerciseId)!;
      if (!seenInWorkout.has(set.exerciseId)) {
        entry.sessions += 1;
        seenInWorkout.add(set.exerciseId);
      }
      if (!entry.latest || new Date(workout.date).getTime() >= new Date(entry.latest.date).getTime()) {
        entry.latest = {
          date: workout.date,
          weightKg: set.weightKg,
          reps: set.reps,
          setNumber: set.setNumber,
        };
      }
      const existingTrend = entry.trend.find(item => item.date === workout.date);
      const bestWeightKg = set.weightKg;
      const bestReps = set.reps;
      if (existingTrend) {
        if (bestWeightKg > existingTrend.bestWeightKg || (bestWeightKg === existingTrend.bestWeightKg && bestReps > existingTrend.bestReps)) {
          existingTrend.bestWeightKg = bestWeightKg;
          existingTrend.bestReps = bestReps;
        }
      } else {
        entry.trend.push({ date: workout.date, bestWeightKg, bestReps });
      }
    }
  }

  return [...byExercise.values()]
    .map(entry => ({ ...entry, trend: entry.trend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-limit) }))
    .sort((a, b) => (b.latest?.date || "").localeCompare(a.latest?.date || ""));
}

export async function getPersonalRecords(db: Db, userEmail: string): Promise<PersonalRecord[]> {
  const workouts = await getRecentWorkouts(db, userEmail, 120);
  const bestByExercise = new Map<string, PersonalRecord>();

  for (const workout of workouts) {
    for (const set of workout.performances) {
      const current = bestByExercise.get(set.exerciseId);
      const score = set.weightKg * (1 + set.reps / 30);
      const currentScore = current ? current.weightKg * (1 + current.reps / 30) : -1;
      if (!current || score > currentScore) {
        bestByExercise.set(set.exerciseId, {
          exerciseId: set.exerciseId,
          name: getExerciseName(set.exerciseId),
          weightKg: set.weightKg,
          reps: set.reps,
          date: workout.date,
          estimatedOneRepMax: estimateOneRepMax(set.weightKg, set.reps),
        });
      }
    }
  }

  return [...bestByExercise.values()].sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps);
}

export async function logWorkout(
  db: Db,
  userEmail: string,
  body: Record<string, unknown>,
) {
  const email = userEmail.toLowerCase();
  const focus = typeof body.focus === "string" && focuses.has(body.focus as Focus) ? body.focus as Focus : "full";
  const duration = boundedInt(body.duration, 0, 300, 0);
  const rating = typeof body.rating === "string" && sessionRatings.has(body.rating as SessionRating) ? body.rating as SessionRating : "right";
  const completed = body.completed !== false;
  const perceivedDifficulty = boundedInt(body.perceived_difficulty ?? body.perceivedDifficulty, 1, 10, 5);
  const energyLevel = boundedInt(body.energy_level ?? body.energyLevel, 1, 10, 5);
  const sorenessLevel = boundedInt(body.soreness_level ?? body.sorenessLevel, 1, 10, 5);
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  const planId = typeof body.plan_id === "string" ? body.plan_id : typeof body.planId === "string" ? body.planId : null;
  const rawSets = Array.isArray(body.performances) ? body.performances.slice(0, 200) as IncomingSet[] : [];
  const performances = rawSets.flatMap(item => {
    if (typeof item.exerciseId !== "string") return [];
    const exerciseId = resolveExerciseId(item.exerciseId) || (/^[A-Za-z0-9_-]{1,100}$/.test(item.exerciseId) ? item.exerciseId : null);
    if (!exerciseId) return [];
    return [{
      exerciseId,
      setNumber: boundedInt(item.setNumber, 1, 20, 1),
      weightKg: boundedNumber(item.weightKg, 0, 1000, 0),
      reps: boundedInt(item.reps, 1, 500, 1),
      notes: typeof item.notes === "string" ? item.notes.trim().slice(0, 500) : "",
      rpe: item.rpe == null ? null : boundedNumber(item.rpe, 1, 10, 5),
      rir: item.rir == null ? null : boundedNumber(item.rir, 0, 10, 2),
      durationSeconds: item.durationSeconds == null ? null : boundedInt(item.durationSeconds, 1, 86400, 60),
      distanceMeters: item.distanceMeters == null ? null : boundedNumber(item.distanceMeters, 0, 1000000, 0),
      setType: typeof item.setType === "string" && setTypes.has(item.setType) ? item.setType : "working",
      completed: item.completed !== false,
      completedAt: typeof item.completedAt === "number" ? item.completedAt : Date.now(),
      source: typeof item.source === "string" && sources.has(item.source) ? item.source : "web",
    }];
  });
  const exerciseCount = completed ? boundedInt(body.exercises, 1, 50, Math.max(1, new Set(performances.map(set => set.exerciseId)).size)) : 0;

  const requestedId = validWorkoutId(body.id) ? body.id : null;
  const id = requestedId || crypto.randomUUID();
  const requestedDate = typeof body.date === "string" ? Date.parse(body.date) : NaN;
  const completedAt = Number.isFinite(requestedDate) && requestedDate <= Date.now() + 5 * 60 * 1000 && requestedDate >= Date.now() - 365 * 24 * 60 * 60 * 1000
    ? requestedDate
    : Date.now();
  const totalVolume = Math.round(performances.reduce((sum, set) => sum + set.weightKg * set.reps, 0) * 10) / 10;
  const source = typeof body.source === "string" && sources.has(body.source) ? body.source : "web";
  const startedAt = typeof body.startedAt === "number" ? body.startedAt : null;

  const existing = requestedId
    ? await db.select().from(schema.workouts).where(and(eq(schema.workouts.id, id), eq(schema.workouts.userEmail, email))).limit(1)
    : [];
  if (existing.length) {
    await db.delete(schema.workoutSets).where(eq(schema.workoutSets.workoutId, id));
    if (performances.length) await db.insert(schema.workoutSets).values(performances.map((set, index) => ({ id: `${id}-${index + 1}`, workoutId: id, ...set })));
    await db.update(schema.workouts).set({ completedAt, focus, durationMinutes: completed ? duration : 0, exerciseCount, setCount: performances.length, totalVolumeKg: totalVolume, sessionRating: rating, status: completed ? "completed" : "missed", planId, perceivedDifficulty, energyLevel, sorenessLevel, notes, source, startedAt }).where(and(eq(schema.workouts.id, id), eq(schema.workouts.userEmail, email)));
  } else {
    await db.insert(schema.workouts).values({
      id,
      userEmail: email,
      createdAt: Date.now(),
      completedAt,
      focus,
      durationMinutes: completed ? duration : 0,
      exerciseCount,
      setCount: performances.length,
      totalVolumeKg: totalVolume,
      sessionRating: rating,
      status: completed ? "completed" : "missed",
      planId,
      perceivedDifficulty,
      energyLevel,
      sorenessLevel,
      notes,
      source,
      startedAt,
      });
    if (performances.length) await db.insert(schema.workoutSets).values(performances.map((set, index) => ({ id: `${id}-${index + 1}`, workoutId: id, ...set })));
  }

  return {
    id,
    date: new Date(completedAt).toISOString(),
    focus,
    duration,
    exercises: exerciseCount,
    sets: performances.length,
    totalVolume,
    rating,
    perceivedDifficulty,
    energyLevel,
    sorenessLevel,
    notes,
    completed,
    performances,
  };
}

export async function logSet(
  db: Db,
  userEmail: string,
  input: {
    workoutId?: string;
    exerciseId: string;
    setNumber: number;
    weightKg: number;
    reps: number;
    focus?: Focus;
    rpe?: number;
    rir?: number;
    durationSeconds?: number;
    distanceMeters?: number;
    setType?: string;
    source?: string;
  },
) {
  const email = userEmail.toLowerCase();
  const workoutId = validWorkoutId(input.workoutId)
    ? input.workoutId
    : crypto.randomUUID();
  const existing = await db.select().from(schema.workouts).where(and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userEmail, email))).limit(1);

  if (!existing.length) {
    await db.insert(schema.workouts).values({
      id: workoutId,
      userEmail: email,
      createdAt: Date.now(),
      completedAt: Date.now(),
      focus: input.focus && focuses.has(input.focus) ? input.focus : "full",
      durationMinutes: 0,
      exerciseCount: 1,
      setCount: 0,
      totalVolumeKg: 0,
      sessionRating: "right",
      status: "in_progress",
      source: input.source && sources.has(input.source) ? input.source : "web",
      startedAt: Date.now(),
    });
  }

  const setId = `${workoutId}-${input.exerciseId}-${input.setNumber}`;
  const weightKg = boundedNumber(input.weightKg, 0, 1000, 0);
  const reps = boundedInt(input.reps, 1, 500, 1);
  await db.insert(schema.workoutSets).values({
    id: setId,
    workoutId,
    exerciseId: input.exerciseId,
    setNumber: boundedInt(input.setNumber, 1, 20, 1),
    weightKg,
    reps,
    rpe: input.rpe == null ? null : boundedNumber(input.rpe, 1, 10, 5),
    rir: input.rir == null ? null : boundedNumber(input.rir, 0, 10, 2),
    durationSeconds: input.durationSeconds == null ? null : boundedInt(input.durationSeconds, 1, 86400, 60),
    distanceMeters: input.distanceMeters == null ? null : boundedNumber(input.distanceMeters, 0, 1000000, 0),
    setType: input.setType && setTypes.has(input.setType) ? input.setType : "working",
    completed: true,
    completedAt: Date.now(),
    source: input.source && sources.has(input.source) ? input.source : "web",
  }).onConflictDoUpdate({
    target: schema.workoutSets.id,
    set: { weightKg, reps, rpe: input.rpe == null ? null : boundedNumber(input.rpe, 1, 10, 5), rir: input.rir == null ? null : boundedNumber(input.rir, 0, 10, 2), durationSeconds: input.durationSeconds == null ? null : boundedInt(input.durationSeconds, 1, 86400, 60), distanceMeters: input.distanceMeters == null ? null : boundedNumber(input.distanceMeters, 0, 1000000, 0), setType: input.setType && setTypes.has(input.setType) ? input.setType : "working", completed: true, completedAt: Date.now(), source: input.source && sources.has(input.source) ? input.source : "web" },
  });

  const sets = await db.select().from(schema.workoutSets).where(eq(schema.workoutSets.workoutId, workoutId));
  const totalVolume = Math.round(sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0) * 10) / 10;
  const exerciseCount = new Set(sets.map(set => set.exerciseId)).size;
  await db.update(schema.workouts).set({
    setCount: sets.length,
    exerciseCount,
    totalVolumeKg: totalVolume,
  }).where(eq(schema.workouts.id, workoutId));

  return { workoutId, set: { exerciseId: input.exerciseId, setNumber: input.setNumber, weightKg, reps, rpe: input.rpe ?? null, rir: input.rir ?? null, durationSeconds: input.durationSeconds ?? null, distanceMeters: input.distanceMeters ?? null, setType: input.setType || "working", completedAt: new Date().toISOString(), source: input.source || "web" }, totalVolume, setCount: sets.length };
}

export async function startWorkout(
  db: Db,
  userEmail: string,
  input: { id?: string; focus?: Focus; planId?: string; source?: string; startedAt?: number },
) {
  const email = userEmail.toLowerCase();
  const id = validWorkoutId(input.id) ? input.id : crypto.randomUUID();
  const existing = await db.select().from(schema.workouts).where(and(eq(schema.workouts.id, id), eq(schema.workouts.userEmail, email))).limit(1);
  if (existing.length) return { workoutId: id, status: existing[0].status, startedAt: existing[0].startedAt || existing[0].createdAt };
  const startedAt = Number.isFinite(input.startedAt) ? Number(input.startedAt) : Date.now();
  await db.insert(schema.workouts).values({
    id, userEmail: email, createdAt: Date.now(), completedAt: startedAt, startedAt,
    focus: input.focus && focuses.has(input.focus) ? input.focus : "full", durationMinutes: 0,
    exerciseCount: 0, setCount: 0, totalVolumeKg: 0, sessionRating: "right", status: "in_progress",
    planId: input.planId || null, source: input.source && sources.has(input.source) ? input.source : "web",
  });
  return { workoutId: id, status: "in_progress", startedAt };
}

export async function completeWorkout(
  db: Db,
  userEmail: string,
  workoutId: string,
  patch: { duration?: number; rating?: SessionRating },
) {
  const email = userEmail.toLowerCase();
  const existing = await db.select().from(schema.workouts).where(and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userEmail, email))).limit(1);
  if (!existing.length) throw new Error("Workout not found");
  const duration = boundedInt(patch.duration, 1, 300, existing[0].durationMinutes || 1);
  const rating = patch.rating && sessionRatings.has(patch.rating) ? patch.rating : existing[0].sessionRating as SessionRating;
  await db.update(schema.workouts).set({
    durationMinutes: duration,
    sessionRating: rating,
    completedAt: Date.now(),
    status: "completed",
  }).where(eq(schema.workouts.id, workoutId));
  const workouts = await getRecentWorkouts(db, email, 1);
  return workouts[0] || null;
}

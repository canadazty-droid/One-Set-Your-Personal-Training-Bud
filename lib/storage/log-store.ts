import { appDateKey, isInLast7AppDays } from "../date/app-date.mjs";
import { trainingRecords } from "../training/record-quality.mjs";

export type WorkoutLog = {
  id: string;
  userId: string;
  workoutId: string;
  workoutDate: string;
  completed: boolean;
  perceivedDifficulty: number;
  energyLevel: number;
  sorenessLevel: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  payload?: Record<string, unknown>;
};

const LOGS_KEY = "one-set-workout-logs";
const LEGACY_LOGS_KEYS = ["oneset-workout-logs-v1"];
const LEGACY_LOCAL_USER_IDS = ["local-athlete"];
export const DEFAULT_USER_ID = "local-user";
export const PENDING_WORKOUTS_KEY = "purefitness-pending-workouts-v1";

const storage = () => typeof window === "undefined" ? null : window.localStorage;
const clamp = (value: unknown) => Math.max(1, Math.min(10, Math.round(Number(value) || 5)));
const dayKey = (value: string) => appDateKey(value);

function normalize(value: unknown): WorkoutLog | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<WorkoutLog>;
  if (typeof item.id !== "string" || typeof item.userId !== "string" || typeof item.workoutId !== "string" || typeof item.workoutDate !== "string") return null;
  if (!dayKey(item.workoutDate)) return null;
  return {
    id: item.id,
    userId: item.userId,
    workoutId: item.workoutId,
    workoutDate: item.workoutDate,
    completed: item.completed !== false,
    perceivedDifficulty: clamp(item.perceivedDifficulty),
    energyLevel: clamp(item.energyLevel),
    sorenessLevel: clamp(item.sorenessLevel),
    notes: typeof item.notes === "string" ? item.notes.slice(0, 500) : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : item.workoutDate,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    payload: item.payload && typeof item.payload === "object" ? item.payload : undefined,
  };
}

function readAll(strict = false): WorkoutLog[] {
  try {
    const store = storage();
    const raw = store?.getItem(LOGS_KEY) || LEGACY_LOGS_KEYS.map(key => store?.getItem(key)).find(Boolean);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    if (!Array.isArray(parsed)) throw new Error("Invalid workout history");
    const normalized = parsed.map(normalize);
    if (strict && normalized.some(item => !item)) throw new Error("Invalid workout history entry");
    return normalized.filter((item): item is WorkoutLog => Boolean(item));
  } catch {
    // Reading can degrade to an empty state, but saving must never overwrite
    // unreadable history with a new, apparently successful record.
    if (strict) throw new Error("Workout history could not be read safely");
    return [];
  }
}

function writeAll(logs: WorkoutLog[]) {
  const store = storage();
  if (!store) throw new Error("Workout storage is unavailable");
  const serialized = JSON.stringify(logs);
  store.setItem(LOGS_KEY, serialized);
  if (store.getItem(LOGS_KEY) !== serialized) throw new Error("Workout save could not be verified");
}

export async function saveWorkoutLog(log: WorkoutLog): Promise<void> {
  const normalized = normalize(log);
  if (!normalized) throw new Error("Invalid workout log");
  const logs = readAll(true);
  const index = logs.findIndex(item => item.userId === normalized.userId && dayKey(item.workoutDate) === dayKey(normalized.workoutDate));
  if (index >= 0) {
    normalized.id = logs[index].id;
    normalized.createdAt = logs[index].createdAt;
    normalized.updatedAt = new Date().toISOString();
    logs[index] = normalized;
  } else {
    logs.unshift(normalized);
  }
  writeAll(logs.sort((a, b) => new Date(b.workoutDate).getTime() - new Date(a.workoutDate).getTime()));
}

export async function getWorkoutLogs(userId: string): Promise<WorkoutLog[]> {
  const logs = readAll();
  if (userId !== DEFAULT_USER_ID) return trainingRecords(logs.filter(item => item.userId === userId)) as WorkoutLog[];

  const current = logs.filter(item => item.userId === userId);
  const legacy = logs.filter(item => LEGACY_LOCAL_USER_IDS.includes(item.userId));
  if (!legacy.length) return trainingRecords(current) as WorkoutLog[];

  const migrated = legacy.map(item => ({ ...item, userId: DEFAULT_USER_ID, updatedAt: new Date().toISOString() }));
  const merged = [...current, ...migrated]
    .filter((item, index, items) => items.findIndex(candidate => dayKey(candidate.workoutDate) === dayKey(item.workoutDate)) === index)
    .sort((a, b) => new Date(b.workoutDate).getTime() - new Date(a.workoutDate).getTime());
  try {
    writeAll([...merged, ...logs.filter(item => item.userId !== userId && !LEGACY_LOCAL_USER_IDS.includes(item.userId))]);
  } catch { /* Keep readable legacy records available even if migration cannot be saved. */ }
  return trainingRecords(merged) as WorkoutLog[];
}

export async function getLogsForLast7Days(userId: string): Promise<WorkoutLog[]> {
  const now = new Date();
  return (await getWorkoutLogs(userId)).filter(item => isInLast7AppDays(item.workoutDate, now));
}

export async function getTodayLog(userId: string): Promise<WorkoutLog | null> {
  const today = appDateKey();
  return (await getWorkoutLogs(userId)).find(item => dayKey(item.workoutDate) === today) || null;
}

export function readPendingWorkoutPayloads<T>(): T[] {
  try {
    const parsed = JSON.parse(storage()?.getItem(PENDING_WORKOUTS_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export function writePendingWorkoutPayloads<T>(items: T[]) {
  try {
    if (items.length) storage()?.setItem(PENDING_WORKOUTS_KEY, JSON.stringify(items.slice(0, 20)));
    else storage()?.removeItem(PENDING_WORKOUTS_KEY);
  } catch { /* The canonical local log is still retained when possible. */ }
}

/** Only acknowledge the exact version sent, never a newer same-day edit. */
export function isCurrentPendingWorkout<T>(snapshot: T, current: T[]): boolean {
  const serialized = JSON.stringify(snapshot);
  return current.some(item => JSON.stringify(item) === serialized);
}

export function remainingPendingWorkouts<T>(current: T[], sent: T[], failed: T[]): T[] {
  return current.filter(item => !isCurrentPendingWorkout(item, sent) || isCurrentPendingWorkout(item, failed));
}

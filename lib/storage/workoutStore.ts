const clientStorage = () => typeof window === "undefined" ? null : window.localStorage;
const GENERATED_WORKOUT_KEY = "oneset.generated-workout.v1";

export function getActiveWorkout<T>(key: string): T | null {
  try { const raw = clientStorage()?.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}

export function saveActiveWorkout<T>(key: string, workout: T): void {
  try { clientStorage()?.setItem(key, JSON.stringify(workout)); } catch { /* The live workout can continue in memory. */ }
}

export function clearActiveWorkout(key: string): void {
  try { clientStorage()?.removeItem(key); } catch { /* No-op when browser storage is blocked. */ }
}

export async function saveGeneratedWorkout<T>(workout: T): Promise<void> {
  saveActiveWorkout(GENERATED_WORKOUT_KEY, workout);
}

export async function getGeneratedWorkout<T>(): Promise<T | null> {
  return getActiveWorkout<T>(GENERATED_WORKOUT_KEY);
}

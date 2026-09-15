const PLAN_KEY = "oneset-four-week-plan-v1";
const READINESS_KEY = "oneset-readiness-v1";

const clientStorage = () => typeof window === "undefined" ? null : window.localStorage;

function read<T>(key: string): T | null {
  try { const raw = clientStorage()?.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}

function write<T>(key: string, value: T): void {
  try { clientStorage()?.setItem(key, JSON.stringify(value)); } catch { /* A blocked store should not prevent plan generation. */ }
}

export const getFourWeekPlan = <T>() => read<T>(PLAN_KEY);
export const saveFourWeekPlan = <T>(plan: T) => write(PLAN_KEY, plan);
export const getReadinessProfile = <T>() => read<T>(READINESS_KEY);
export const saveReadinessProfile = <T>(profile: T) => write(READINESS_KEY, profile);

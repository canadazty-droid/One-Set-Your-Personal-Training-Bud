const PROFILE_KEY = "purefitness-profile-v1";
const WELCOME_KEY = "one-set-welcome-seen-v1";

const clientStorage = () => typeof window === "undefined" ? null : window.localStorage;

export function getUserProfile<T>(): T | null {
  try {
    const raw = clientStorage()?.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function saveUserProfile<T>(profile: T): void {
  try { clientStorage()?.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* Keep the app usable if storage is unavailable. */ }
}

export function clearUserProfile(): void {
  try { clientStorage()?.removeItem(PROFILE_KEY); } catch { /* No-op when browser storage is blocked. */ }
}

export function hasSeenWelcome(): boolean {
  try { return clientStorage()?.getItem(WELCOME_KEY) === "true"; } catch { return false; }
}

export function markWelcomeSeen(): void {
  try { clientStorage()?.setItem(WELCOME_KEY, "true"); } catch { /* Entering the app must still work. */ }
}

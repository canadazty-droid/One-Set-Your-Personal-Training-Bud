const REVIEW_KEY = "oneset-weekly-review-v1";
const clientStorage = () => typeof window === "undefined" ? null : window.localStorage;

export function getWeeklyReview<T>(userId: string): T | null {
  try {
    const raw = clientStorage()?.getItem(REVIEW_KEY);
    const reviews = raw ? JSON.parse(raw) as Record<string, T> : {};
    return reviews[userId] || null;
  } catch { return null; }
}

export function saveWeeklyReview<T>(userId: string, review: T): void {
  try {
    const storage = clientStorage();
    if (!storage) return;
    const raw = storage.getItem(REVIEW_KEY);
    const reviews = raw ? JSON.parse(raw) as Record<string, T> : {};
    reviews[userId] = review;
    storage.setItem(REVIEW_KEY, JSON.stringify(reviews));
  } catch { /* Logs remain the source of truth if the cached review cannot be stored. */ }
}

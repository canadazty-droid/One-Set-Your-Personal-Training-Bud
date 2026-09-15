export const APP_TIME_ZONE = "America/Vancouver";

/** @param {Date|string|number} value */
const asDate = (value = new Date()) => value instanceof Date ? value : new Date(value);

/** @param {Date|string|number} [value] */
export function appDateKey(value = new Date()) {
  // A stored calendar date has no time zone to convert.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
  }
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueFor = type => parts.find(part => part.type === type)?.value || "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

/** Seven Pacific calendar days, including today; never include a future day.
 * @param {Date|string|number} value @param {Date|string|number} [now]
 */
export function isInLast7AppDays(value, now = new Date()) {
  const today = appDateKey(now);
  const day = appDateKey(value);
  if (!today || !day) return false;
  // UTC arithmetic is only on calendar labels, not on the original instants.
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return day >= start.toISOString().slice(0, 10) && day <= today;
}

/** @param {Date|string|number} left @param {Date|string|number} right */
export function isSameAppDay(left, right) {
  const leftKey = appDateKey(left);
  return Boolean(leftKey) && leftKey === appDateKey(right);
}

/** @param {"zh"|"en"} language @param {Date|string|number} [value] */
export function formatShortAppDate(language, value = new Date()) {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "2-digit",
  }).format(date).toUpperCase();
}

/** @param {"zh"|"en"} language @param {Date|string|number} [value] */
export function formatFullAppDate(language, value = new Date()) {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

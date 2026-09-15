import assert from "node:assert/strict";
import test from "node:test";
import { appDateKey, formatShortAppDate, isSameAppDay, isInLast7AppDays } from "../lib/date/app-date.mjs";
import { buildSevenDayReview } from "../lib/training/weekly-review.mjs";

test("uses Pacific Time for the product date", () => {
  const beforePacificMidnight = new Date("2026-09-04T06:59:00.000Z");
  const afterPacificMidnight = new Date("2026-09-04T07:01:00.000Z");

  assert.equal(appDateKey(beforePacificMidnight), "2026-09-03");
  assert.equal(appDateKey(afterPacificMidnight), "2026-09-04");
  assert.equal(formatShortAppDate("zh", afterPacificMidnight), "9月04日");
  assert.equal(formatShortAppDate("en", afterPacificMidnight), "SEP 04");
});

test("matches workout logs by the same Pacific calendar day", () => {
  assert.equal(isSameAppDay("2026-09-04T07:01:00.000Z", "2026-09-05T06:59:00.000Z"), true);
  assert.equal(isSameAppDay("2026-09-04T06:59:00.000Z", "2026-09-04T07:01:00.000Z"), false);
});

test("seven-day review includes the entire first Pacific day and excludes future days", () => {
  const now = new Date("2026-09-05T06:30:00Z"); // September 4, late evening
  const dates = ["2026-08-29T06:59:59Z", "2026-08-29T07:00:00Z", "2026-09-05T06:59:59Z", "2026-09-05T07:00:00Z"];
  assert.deepEqual(dates.map(date => isInLast7AppDays(date, now)), [false, true, true, false]);
  const logs = dates.map(date => ({date, completed:true, energyLevel:7, sorenessLevel:8, perceivedDifficulty:9}));
  const review = buildSevenDayReview(logs, 4, now);
  assert.equal(review.recent.length, 2);
  assert.equal(review.completionRate, 50);
  assert.equal(review.averageDifficulty, 9);
  assert.equal(review.averageEnergy, 7);
  assert.equal(review.averageSoreness, 8);
});

test("calendar-only records and daylight-saving transitions keep their calendar day", () => {
  assert.equal(appDateKey("2026-09-04"), "2026-09-04");
  assert.equal(appDateKey("2026-02-30"), "");
  assert.equal(isInLast7AppDays("2026-03-05T08:00:00Z", "2026-03-12T06:30:00Z"), true);
  assert.equal(isInLast7AppDays("2026-10-29T12:00:00Z", "2026-11-04T20:30:00Z"), true);
  assert.equal(isInLast7AppDays("invalid"), false);
});

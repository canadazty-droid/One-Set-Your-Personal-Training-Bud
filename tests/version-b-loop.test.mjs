import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseWorkoutInput, mapFocusAreas } from "../lib/training/input-parser.mjs";
import { adjustNextWorkout as applyAdjustment, describeAdjustment } from "../lib/training/adjustment-rules.mjs";
import { buildSevenDayReview } from "../lib/training/weekly-review.mjs";
import { generateVersionBTrainingPlan } from "../lib/training/plan-generator.mjs";

const now = new Date("2026-08-20T12:00:00Z");
const adjustNextWorkout = (request, logs) => applyAdjustment(request, logs.map((log, index) => ({date:`2026-08-${20-index}T10:00:00Z`, ...log})), now);
const base = { durationMinutes: 45, focus: "lower" };

test("parses a 30-minute chest and back request without an LLM", () => {
  const parsed = parseWorkoutInput("30 分钟，练胸和背");
  assert.equal(parsed.durationMinutes, 30);
  assert.deepEqual(parsed.focusAreas, ["chest", "back"]);
  assert.equal(mapFocusAreas(parsed.focusAreas), "pushpull");
});

test("parses light intent and explicit exercise exclusions", () => {
  const parsed = parseWorkoutInput("今天有点累，45 分钟练腿，不要深蹲");
  assert.equal(parsed.intensity, "light");
  assert.deepEqual(parsed.excludedExercises, ["squat"]);
  const adjusted = adjustNextWorkout({durationMinutes:45,focus:"lower",intensity:parsed.intensity}, []);
  assert.equal(adjusted.exerciseDelta, -1);assert.equal(adjusted.setDelta, -1);
});

test("defaults to full body and understands recovery and running exclusions", () => {
  const parsed = parseWorkoutInput("今天疲劳，30 分钟，不要跑步");
  assert.deepEqual(parsed.focusAreas, ["full_body"]);
  assert.equal(mapFocusAreas(parsed.focusAreas), "full");
  assert.equal(parsed.intensity, "light");
  assert.deepEqual(parsed.excludedExercises, ["running"]);
});

test("high soreness and low energy reduce the next workout", () => {
  const sore = adjustNextWorkout(base, [{ completed: true, focus: "lower", sorenessLevel: 8, energyLevel: 7, perceivedDifficulty: 6 }]);
  assert.equal(sore.focus, "upper");assert.equal(sore.setDelta, -1);
  const tired = adjustNextWorkout(base, [{ completed: true, focus: "upper", sorenessLevel: 3, energyLevel: 4, perceivedDifficulty: 6 }]);
  assert.equal(tired.intensity, "light");assert.equal(tired.durationMinutes, 30);
});

test("difficulty nine removes workout volume", () => {
  const difficult = adjustNextWorkout(base, [{completed:true,focus:"lower",sorenessLevel:4,energyLevel:7,perceivedDifficulty:9}]);
  assert.equal(difficult.exerciseDelta,-1);assert.equal(difficult.setDelta,-1);assert.equal(difficult.adjustmentReason,"difficulty:9");
});

test("three completed sessions progress while repeated misses shorten", () => {
  const strong = adjustNextWorkout(base, Array.from({length:3},()=>({completed:true,focus:"full",sorenessLevel:4,energyLevel:8,perceivedDifficulty:7})));
  assert.equal(strong.setDelta, 1);
  const missed = adjustNextWorkout(base, [{completed:false,focus:"lower",energyLevel:3},{completed:false,focus:"upper",energyLevel:3}]);
  assert.equal(missed.frequencySuggestion, "reduce_frequency");assert.equal(missed.durationMinutes, 30);
});

test("a first generated workout explains that adjustment needs real logs", () => {
  const adjusted = adjustNextWorkout({durationMinutes:30,focus:"pushpull"}, []);
  assert.equal(adjusted.intensity, "normal");
  assert.equal(adjusted.adjustmentReason, "baseline:no_logs");
  assert.equal(describeAdjustment(adjusted.adjustmentReason, "zh"), "先完成几次训练，系统会根据记录自动调整。");
});

test("high soreness produces the exact light recovery decision", () => {
  const adjusted = adjustNextWorkout(base, [{completed:true,focus:"lower",sorenessLevel:8,energyLevel:7,perceivedDifficulty:7}]);
  assert.equal(adjusted.intensity, "light");
  assert.equal(describeAdjustment(adjusted.adjustmentReason, "zh"), "因为你上次酸痛较高，这次改成轻量恢复训练。");
});

test("high soreness keeps an explicitly requested training focus", () => {
  const adjusted = adjustNextWorkout({...base,focus:"pushpull",preserveFocus:true}, [{completed:true,focus:"upper",sorenessLevel:8,energyLevel:7,perceivedDifficulty:7}]);
  assert.equal(adjusted.focus,"pushpull");
  assert.equal(adjusted.intensity,"light");
});

test("seven-day review is data-specific", () => {
  const logs = [
    {date:"2026-08-20T10:00:00Z",completed:true,energyLevel:4,sorenessLevel:8,perceivedDifficulty:10},
    {date:"2026-08-19T10:00:00Z",completed:false,energyLevel:4,sorenessLevel:8,perceivedDifficulty:9},
  ];
  const review = buildSevenDayReview(logs, 4, now);
  assert.equal(review.completionRate, 25);assert.equal(review.averageEnergy, 4);assert.equal(review.averageSoreness, 8);
  assert.equal(review.averageDifficulty,9.5);assert.ok(review.riskFlags.includes("low_completion"));assert.ok(review.riskFlags.includes("high_soreness"));assert.ok(review.riskFlags.includes("low_energy"));assert.ok(review.riskFlags.includes("high_difficulty"));
});

test("seven-day review handles an empty history", () => {
  const review=buildSevenDayReview([],3,now);
  assert.equal(review.completedWorkouts,0);assert.equal(review.completionRate,0);assert.deepEqual(review.riskFlags,[]);assert.deepEqual(review.recent,[]);
});

test("centralizes local workout logs and supports same-day updates", async () => {
  const source=await readFile(new URL("../lib/storage/log-store.ts",import.meta.url),"utf8");
  assert.match(source,/export async function saveWorkoutLog/);assert.match(source,/export async function getWorkoutLogs/);assert.match(source,/export async function getLogsForLast7Days/);assert.match(source,/export async function getTodayLog/);assert.match(source,/item\.userId === normalized\.userId && dayKey\(item\.workoutDate\) === dayKey\(normalized\.workoutDate\)/);assert.doesNotMatch(source,/item\.workoutId === normalized\.workoutId/);
});

test("ships a refreshable progress route and complete real-log fields", async () => {
  const [page, progress, store] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/log-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(progress, /OneSetApp initialTab="progress"/);
  assert.match(progress, /useEffect\(\(\) => setReady\(true\), \[\]\)/);
  assert.match(progress, /progress-route-loading/);
  assert.match(page, /最近 7 天/);
  assert.match(page, /training-log-metrics/);
  assert.match(page, /log\.perceivedDifficulty/);
  assert.match(page, /log\.energyLevel/);
  assert.match(page, /log\.sorenessLevel/);
  assert.match(store, /one-set-workout-logs/);
});

test("makes one-to-ten workout feedback precise on mobile", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /className="quick-log-stepper"/);
  assert.match(page, /setValue\(Math\.min\(10,value\+1\)\)/);
  assert.match(page, /setValue\(Math\.max\(1,value-1\)\)/);
  assert.match(styles, /\.quick-log-stepper\{display:grid;grid-template-columns:42px minmax\(0,1fr\) 42px/);
});

test("lets local dates hydrate safely across server and phone time zones", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<b suppressHydrationWarning>\{todayDate\}<\/b>/);
  assert.match(page, /<p suppressHydrationWarning>\{fullDate\(language\)\}<\/p>/);
  assert.match(page, /<i suppressHydrationWarning>\{day\.trained\?"✓":day\.today\?"•":""\}<\/i>/);
});

test("keeps the ONE SET brand and five mobile destinations readable", async () => {
  const [page,styles]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.doesNotMatch(page,/练练一下/);assert.match(page,/<div className="brand"><strong>练一下/);assert.doesNotMatch(page,/<div className="brand"><span[^>]*>练<\/span>/);assert.match(page,/档案\"\:\"PROFILE/);assert.match(styles,/repeat\(5,minmax\(0,1fr\)\)/);
});

test("assembles structured workouts outside the React page", async () => {
  const [page,generator]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../lib/training/workoutGenerator.ts",import.meta.url),"utf8")]);
  assert.match(page,/generateWorkout\(\{/);assert.match(page,/saveGeneratedWorkout\(generated\)/);
  assert.match(generator,/workoutName: string/);assert.match(generator,/restSeconds: number/);assert.match(generator,/adjustmentReason: string/);
});

test("onboarding saves locally and quick log captures recovery inputs", async () => {
  const [onboarding, page] = await Promise.all([readFile(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8"), readFile(new URL("../app/page.tsx", import.meta.url), "utf8")]);
  assert.match(onboarding, /saveFourWeekPlan/);assert.match(onboarding, /saveReadinessProfile/);assert.match(onboarding, /saveUserProfile/);assert.match(onboarding, /No sign-in required/);assert.match(onboarding, /current_soreness_level/);
  assert.match(page, /focus:options\?\.focus\?\?parsedRequest\.focus/);
  assert.match(page, /completed:feedback\.completed/);assert.match(page, /今天已完成/);assert.match(page, /完成训练/);assert.match(page, /保存记录/);assert.match(page, /perceivedDifficulty:feedback\.difficulty/);assert.match(page, /SevenDayReviewCard/);assert.match(page, /adjustNextWorkout/);
});

test("keeps finish workout and the editable log in one visible generated-plan flow", async () => {
  const [page, styles, store] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/storage/log-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /canLog=\{Boolean\(generatedWorkout\?\.exercises\.length\|\|todaySession\?\.exercises\.length\|\|planPersonalization\)\}/);
  assert.match(page, /canLog&&quickLogOpen&&<WorkoutFeedback/);
  assert.match(page, /inline-quick-log/);
  assert.doesNotMatch(page, /plan-quick-finish/);
  assert.match(styles, /\.inline-quick-log\{position:relative/);
  assert.match(page, /today-log-confirmation/);
  assert.match(store, /DEFAULT_USER_ID = "local-user"/);
  assert.match(store, /normalized\.updatedAt = new Date\(\)\.toISOString\(\)/);
});

test("progress reads the seven-day store directly and always labels risk status", async () => {
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(page,/getLogsForLast7Days\(DEFAULT_USER_ID\)/);
  assert.match(page,/暂未发现需要调整的风险/);
  assert.match(page,/<p className="risk-heading">\{zh\?"风险提醒":"Risk alerts"\}<\/p>/);
  assert.match(page,/<input aria-label=\{label\} type="range"/);
});

test("initial readiness reduces the first week of a four-week plan", () => {
  const plan = generateVersionBTrainingPlan({name:"Paul",gender:"unspecified",age:30,height_cm:175,weight_kg:75,goal:"muscle_gain",training_experience:"beginner",weekly_training_days:3,session_length_minutes:30,available_equipment:"gym",injuries_or_limitations:"none",preferred_training_style:"flexible",current_energy_level:3,current_soreness_level:2});
  assert.equal(plan.weeks.length, 4);assert.match(plan.adjustment_reason, /energy 3\/10/);assert.ok(plan.weeks[0].days.every(day=>day.exercises.every(exercise=>exercise.difficulty==="easy")));
});

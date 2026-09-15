import test from "node:test";
import assert from "node:assert/strict";
import { generateWorkoutFromIntent, parseImportedPlan, parseNaturalLanguageLog, parseWorkoutIntent } from "../packages/workout-domain/index.mjs";

test("parses low-energy chest and back request", () => {
  const intent = parseWorkoutIntent("今天有点累，40分钟，练胸和背");
  assert.equal(intent.durationMinutes, 40);
  assert.deepEqual(intent.muscleGroups, ["chest", "back"]);
  assert.equal(intent.intensity, "light");
  const workout = generateWorkoutFromIntent(intent, {}, 0);
  assert.equal(workout.durationMinutes, 40);
  assert.equal(workout.intensity, "light");
  assert.ok(workout.exercises.length >= 3);
});

test("parses imported Chinese plan into structured exercises", () => {
  const plan = parseImportedPlan("卧推4×8，上斜哑铃3×10，飞鸟3×12");
  assert.equal(plan.exercises.length, 3);
  assert.deepEqual(plan.exercises.map(item => item.sets), [4, 3, 3]);
});

test("parses one-sentence logging without inventing values", () => {
  const log = parseNaturalLanguageLog("卧推80公斤8 8 7，飞鸟20公斤12个三组");
  assert.equal(log.entries.length, 2);
  assert.deepEqual(log.entries[0].reps, [8, 8, 7]);
  assert.deepEqual(log.entries[1].reps, [12, 12, 12]);
  const incomplete = parseNaturalLanguageLog("卧推今天不错");
  assert.equal(incomplete.entries.length, 0);
  assert.equal(incomplete.confidence, "low");
});

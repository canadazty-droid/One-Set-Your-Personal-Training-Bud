import test from "node:test";
import assert from "node:assert/strict";
import {CORRECTION_CYCLE_KEY,correctionCycleState,normalizeCorrectionCycle,readCorrectionCycle,recordCorrectionRescan,recordCorrectionWorkout,startCorrectionCycle} from "../app/correction-cycle.mjs";

const storage=new Map();
globalThis.window={localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},dispatchEvent:()=>true};

test("persists a seven-day correction cycle from an observable baseline",()=>{
  storage.clear();
  const cycle=startCorrectionCycle({source:"form",metricKeys:["tracking","depth","tracking"],baselineScore:71,baselineScanId:"scan-1",createdAt:"2026-08-08T12:00:00.000Z"});
  assert.equal(cycle.status,"active");
  assert.deepEqual(cycle.metricKeys,["tracking","depth"]);
  assert.equal(cycle.targetWorkouts,3);
  assert.equal(cycle.dueAt,"2026-08-15T12:00:00.000Z");
  assert.deepEqual(readCorrectionCycle(),cycle);
  assert.ok(storage.get(CORRECTION_CYCLE_KEY));
});

test("makes the rescan ready after three corrective workouts",()=>{
  storage.clear();
  startCorrectionCycle({source:"posture",metricKeys:["shoulders"],baselineScore:68,baselineScanId:"posture-1",createdAt:"2026-08-08T12:00:00.000Z"});
  recordCorrectionWorkout("2026-08-09T12:00:00.000Z");recordCorrectionWorkout("2026-08-11T12:00:00.000Z");const cycle=recordCorrectionWorkout("2026-08-13T12:00:00.000Z");
  const state=correctionCycleState(cycle,new Date("2026-08-13T13:00:00.000Z").getTime());
  assert.equal(state.workoutsCompleted,3);
  assert.equal(state.rescanReady,true);
});

test("only a later matching scan completes the active correction cycle",()=>{
  storage.clear();
  startCorrectionCycle({source:"form",metricKeys:["tempo"],baselineScore:70,baselineScanId:"scan-1",createdAt:"2026-08-08T12:00:00.000Z"});
  assert.equal(recordCorrectionRescan({source:"posture",score:90,scanId:"posture-2",scannedAt:"2026-08-09T12:00:00.000Z"}).status,"active");
  assert.equal(recordCorrectionRescan({source:"form",score:70,scanId:"scan-1",scannedAt:"2026-08-09T12:00:00.000Z"}).status,"active");
  const complete=recordCorrectionRescan({source:"form",score:78,scanId:"scan-2",scannedAt:"2026-08-15T12:00:00.000Z"});
  const state=correctionCycleState(complete,new Date("2026-08-15T12:00:00.000Z").getTime());
  assert.equal(state.status,"completed");
  assert.equal(state.latestScore,78);
  assert.equal(state.improvement,8);
});

test("rejects malformed correction-cycle storage",()=>{
  storage.set(CORRECTION_CYCLE_KEY,"{bad json");
  assert.equal(readCorrectionCycle(),null);
  assert.equal(normalizeCorrectionCycle({id:"x",source:"form"}),null);
});

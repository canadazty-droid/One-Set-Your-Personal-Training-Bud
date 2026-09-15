import test, {beforeEach, after} from "node:test";
import assert from "node:assert/strict";
import {saveWorkoutLog,getWorkoutLogs,getTodayLog,getLogsForLast7Days,isCurrentPendingWorkout,remainingPendingWorkouts} from "../lib/storage/log-store.ts";

const key="one-set-workout-logs";
const originalWindow=globalThis.window;
let values;
beforeEach(()=>{
  values=new Map();
  globalThis.window={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
});
after(()=>{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow});
const log=(overrides={})=>({id:"test-log",userId:"local-user",workoutId:"test-workout",workoutDate:new Date().toISOString(),completed:true,perceivedDifficulty:9,energyLevel:7,sorenessLevel:8,notes:"runtime test",createdAt:new Date().toISOString(),...overrides});

test("real store saves, restores, and updates the same day without duplication",async()=>{
  await saveWorkoutLog(log());
  assert.equal((await getTodayLog("local-user")).sorenessLevel,8);
  assert.equal((await getLogsForLast7Days("local-user")).length,1);
  await saveWorkoutLog(log({id:"second-id",notes:"updated",energyLevel:3}));
  const restored=await getWorkoutLogs("local-user");
  assert.equal(restored.length,1);
  assert.equal(restored[0].id,"test-log");
  assert.equal(restored[0].notes,"updated");
  assert.equal(restored[0].energyLevel,3);
});

test("quarantined QA fixtures remain stored when real logs are saved or migrated",async()=>{
  const fixture=log({id:'fixture',workoutId:'fixture',workoutDate:'2026-09-04',userId:'local-athlete',notes:'production test 0904'});
  values.set(key,JSON.stringify([fixture]));
  assert.equal((await getWorkoutLogs('local-user')).length,0);
  assert.ok(JSON.parse(values.get(key)).some(item=>item.id==='fixture'));
  await saveWorkoutLog(log({workoutDate:'2026-09-10',notes:'real training'}));
  assert.equal((await getWorkoutLogs('local-user')).length,1);
  assert.ok(JSON.parse(values.get(key)).some(item=>item.id==='fixture'));
});

test("quota failures reject instead of reporting successful completion",async()=>{
  await saveWorkoutLog(log());
  const previous=values.get(key);
  window.localStorage.setItem=()=>{throw new Error("QuotaExceededError")};
  await assert.rejects(saveWorkoutLog(log({notes:"unsaved"})),/QuotaExceededError/);
  assert.equal(values.get(key),previous);
});

test("blocked or unavailable storage rejects a save",async()=>{
  Object.defineProperty(window,"localStorage",{get(){throw new Error("SecurityError")}});
  await assert.rejects(saveWorkoutLog(log()));
  delete globalThis.window;
  await assert.rejects(saveWorkoutLog(log()),/unavailable/);
});

test("corrupt history is never overwritten by saving a new log",async()=>{
  for(const corrupt of ["{broken", "{}", '[{"id":"incomplete"}]']){
    values.set(key,corrupt);
    await assert.rejects(saveWorkoutLog(log()),/read safely/);
    assert.equal(values.get(key),corrupt);
  }
});

test("silent storage write failures are detected and can be retried",async()=>{
  window.localStorage.setItem=()=>{};
  await assert.rejects(saveWorkoutLog(log()),/verified/);
  window.localStorage.setItem=(k,v)=>values.set(k,v);
  await saveWorkoutLog(log());
  assert.equal((await getTodayLog("local-user")).notes,"runtime test");
});

test("saving never silently truncates history at 120 records",async()=>{
  const history=Array.from({length:125},(_,i)=>log({id:`old-${i}`,workoutId:`old-${i}`,workoutDate:new Date(Date.UTC(2025,0,i+1,20)).toISOString()}));
  values.set(key,JSON.stringify(history));
  await saveWorkoutLog(log());
  assert.equal((await getWorkoutLogs("local-user")).length,126);
  assert.ok((await getWorkoutLogs("local-user")).some(item=>item.id==="old-0"));
});

test("legacy history stays readable when migration storage is blocked",async()=>{
  values.set(key,JSON.stringify([log({userId:"local-athlete"})]));
  window.localStorage.setItem=()=>{throw new Error("QuotaExceededError")};
  const restored=await getWorkoutLogs("local-user");
  assert.equal(restored.length,1);
  assert.equal(restored[0].userId,"local-user");
  assert.equal(JSON.parse(values.get(key))[0].userId,"local-athlete");
});

test("a delayed sync response never acknowledges a newer edit of the same workout",()=>{
  const sent={id:"same",notes:"old",sorenessLevel:4};
  const edited={...sent,notes:"new",sorenessLevel:8};
  const added={id:"new",notes:"another",sorenessLevel:5};
  assert.equal(isCurrentPendingWorkout(sent,[edited]),false);
  assert.deepEqual(remainingPendingWorkouts([edited,added],[sent],[]),[edited,added]);
  assert.deepEqual(remainingPendingWorkouts([edited,added],[sent],[sent]),[edited,added]);
  assert.deepEqual(remainingPendingWorkouts([sent],[sent],[]),[]);
  assert.deepEqual(remainingPendingWorkouts([sent],[sent],[sent]),[sent]);
});

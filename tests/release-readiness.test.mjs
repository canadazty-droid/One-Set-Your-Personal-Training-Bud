import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustNextWorkout,recentAdjustmentLogs,describeAdjustment} from '../lib/training/adjustment-rules.mjs';
import {workoutMeasurements} from '../app/session-utils.mjs';

const now = new Date('2026-09-13T02:00:00Z'); // September 12 in Vancouver
const base = {durationMinutes:30,focus:'pushpull',preserveFocus:true};
const sore = {date:'2026-08-25',focus:'pushpull',completed:true,sorenessLevel:9,energyLevel:3,perceivedDifficulty:9};
test('old recovery records stay in history but do not alter today',()=>{
  const records=[sore];const snapshot=JSON.stringify(records);
  const result=adjustNextWorkout(base,records,now);
  assert.equal(result.intensity,'normal');
  assert.equal(result.setDelta,0);
  assert.equal(result.adjustmentReason,'baseline:stale_logs');
  assert.match(describeAdjustment(result.adjustmentReason),/最近 7 天/);
  assert.equal(JSON.stringify(records),snapshot);
});
test('fresh feedback adjusts while future, invalid and expired dates do not',()=>{
  assert.equal(adjustNextWorkout(base,[{...sore,date:'2026-09-12'}],now).intensity,'light');
  assert.equal(recentAdjustmentLogs([{...sore,date:'2026-09-06'}],now).length,1);
  for(const date of ['2026-09-05','2026-09-13','invalid',undefined]){
    assert.equal(recentAdjustmentLogs([{...sore,date}],now).length,0);
  }
});
test('missing ratings never masquerade as low energy or prove recovery',()=>{
  const records=['2026-09-12','2026-09-11','2026-09-10'].map(date=>({date,focus:'full',completed:true,energyLevel:null,sorenessLevel:null}));
  const result=adjustNextWorkout(base,records,now);
  assert.equal(result.intensity,'normal');assert.equal(result.setDelta,0);
});
test('quick feedback preserves real measurements and never invents elapsed time',()=>{
  const performances=[{exerciseId:'Wall_Push-Up',setNumber:1,reps:8,weightKg:0}];
  assert.deepEqual(workoutMeasurements({summaryOnly:true,didComplete:true,previous:null}),{duration:0,performances:[]});
  assert.deepEqual(workoutMeasurements({summaryOnly:true,didComplete:true,previous:{duration:12,performances}}),{duration:12,performances});
  assert.deepEqual(workoutMeasurements({summaryOnly:false,didComplete:true,performances,seconds:720}),{duration:12,performances});
});

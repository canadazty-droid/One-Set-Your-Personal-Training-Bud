import test from 'node:test';
import assert from 'node:assert/strict';
import {isTestWorkout,trainingRecords} from '../lib/training/record-quality.mjs';
import {buildSevenDayReview} from '../lib/training/weekly-review.mjs';
import {adjustNextWorkout} from '../lib/training/adjustment-rules.mjs';
import {estimateWorkoutMinutes} from '../lib/training/duration-estimate.mjs';

test('only explicit fixtures are excluded; normal notes about tests are retained',()=>{
  for(const notes of ['Guided production QA — not a real workout','UI acceptance test v263','production test 0904'])assert.equal(isTestWorkout({notes}),true);
  assert.equal(isTestWorkout({notes:'fitness test today'}),false);
  assert.equal(isTestWorkout({notes:'今天测试卧推重量'}),false);
  assert.equal(isTestWorkout({recordKind:'test'}),true);
});
test('test-only history produces no recovery advice and does not mutate records',()=>{
  const logs=[{date:'2026-09-10',notes:'production test 0904',completed:true,sorenessLevel:9}];
  const before=JSON.stringify(logs);
  assert.equal(buildSevenDayReview(logs,3,new Date('2026-09-10T20:00:00Z')).completedWorkouts,0);
  assert.equal(adjustNextWorkout({durationMinutes:30,focus:'full'},logs).adjustmentReason,'baseline:no_logs');
  assert.equal(JSON.stringify(logs),before);
});
test('latest genuine record controls adjustment regardless of source order',()=>{
  const logs=[{date:'2026-09-08',completed:true,sorenessLevel:9},{date:'2026-09-10',completed:true,sorenessLevel:3,energyLevel:3}];
  assert.equal(trainingRecords(logs)[0].date,'2026-09-10');
  assert.equal(adjustNextWorkout({durationMinutes:30,focus:'full'},logs,new Date('2026-09-10T20:00:00Z')).adjustmentReason,'energy:3');
});
test('time estimate shrinks with volume and handles unilateral and timed exercises',()=>{
  const light=[{sets:1,reps:'8–12',restSeconds:35}];
  const normal=[{sets:3,reps:'8–12',restSeconds:35}];
  assert.ok(estimateWorkoutMinutes(light).max<estimateWorkoutMinutes(normal).max);
  assert.ok(estimateWorkoutMinutes([{sets:2,reps:'8 / 侧'}]).max>estimateWorkoutMinutes([{sets:2,reps:'8'}]).max);
  assert.deepEqual(estimateWorkoutMinutes([]),{min:0,max:0});
  assert.ok(estimateWorkoutMinutes([{sets:1,reps:'30 秒'}]).max<10);
});
test('review never recommends progression over difficulty or low energy warnings',()=>{
  for(const ratings of [{energyLevel:3,perceivedDifficulty:7},{energyLevel:7,perceivedDifficulty:9}]){
    const logs=['2026-09-09','2026-09-10'].map(date=>({date,completed:true,sorenessLevel:3,...ratings}));
    const review=buildSevenDayReview(logs,2,new Date('2026-09-10T20:00:00Z'));
    assert.notEqual(review.nextWeekAdjustment,'increase_volume_5');
    assert.notEqual(review.nextWorkoutSuggestion,'small_progression');
  }
});
test('one record does not establish a low-completion trend; missing soreness cannot prove recovery',()=>{
  const now=new Date('2026-09-10T20:00:00Z');
  assert.equal(buildSevenDayReview([{date:'2026-09-10',completed:true}],4,now).riskFlags.includes('low_completion'),false);
  const review=buildSevenDayReview(['2026-09-09','2026-09-10'].map(date=>({date,completed:true})),2,now);
  assert.notEqual(review.nextWorkoutSuggestion,'small_progression');
});

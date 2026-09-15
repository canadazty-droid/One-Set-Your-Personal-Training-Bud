import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {shouldRunWorkoutClock,validSetInput,setTargetLabel} from '../app/session-utils.mjs';
import {matchesAvailableEquipment,personalizePlan} from '../app/plan-personalizer.mjs';

test('no-equipment recommendations and personalization exclude bars, bands and benches',()=>{
  const make=(id,gear='bodyweight')=>({id,gear,body:'back',level:'beginner',alternatives:[]});
  const blocked=['Band_Assisted_Pull-Up','Pullups','Hanging_Knee_Raise','Hanging_Leg_Raise','Dips_-_Triceps_Version','Bodyweight_Box_Squat','Incline_Push-Up','Supported_Low_Step-Up'];
  for(const id of blocked){
    assert.equal(matchesAvailableEquipment(make(id),'bodyweight'),false,id);
    assert.equal(matchesAvailableEquipment(make(id),'dumbbell'),false,id);
    assert.equal(matchesAvailableEquipment(make(id),'gym'),true,id);
  }
  assert.equal(matchesAvailableEquipment(make('Wall_Push-Up'),'bodyweight'),true);
  assert.equal(matchesAvailableEquipment(make('Close-Grip_Push-Up_off_of_a_Dumbbell'),'bodyweight'),false);
  assert.equal(matchesAvailableEquipment(make('Dumbbell_Floor_Press','dumbbell'),'dumbbell'),true);
  assert.equal(matchesAvailableEquipment(make('Chest-Supported_Dumbbell_Row','dumbbell'),'dumbbell'),false);
  const catalog=[...blocked.map(id=>make(id)),make('Wall_Slide')];
  assert.deepEqual(personalizePlan(blocked,catalog,{equipment:'bodyweight',targetCount:2,focus:'upper',favoriteIds:blocked}).ids,['Wall_Slide']);
});

test('learning and recording do not advance workout time',()=>{
  assert.equal(shouldRunWorkoutClock(true,false,true,0),false);
  assert.equal(shouldRunWorkoutClock(true,false,false,0),true);
  assert.equal(shouldRunWorkoutClock(true,false,true,30),true);
  assert.equal(shouldRunWorkoutClock(true,true,false,0),false);
  assert.equal(shouldRunWorkoutClock(true,true,true,30),false);
  assert.equal(shouldRunWorkoutClock(false,false,false,0),false);
});
test('set targets give an exact quantity and preserve side and time units',()=>{
  assert.equal(setTargetLabel('8–12','8','zh'),'做 8 次');
  assert.equal(setTargetLabel('6–10 / side','6','zh'),'每侧 做 6 次');
  assert.equal(setTargetLabel('20–30s','20','zh'),'保持 20 秒');
  assert.equal(setTargetLabel('20–30s','20','en'),'Hold for 20 seconds');
  assert.equal(setTargetLabel('8–12','','zh'),'做 8 次');
});
test('actual set records reject blank, negative, fractional and non-finite values',()=>{
  assert.equal(validSetInput({reps:'8',weight:'0'},true),true);
  assert.equal(validSetInput({reps:'8',weight:'2.5'}),true);
  for(const reps of ['','0','-1','NaN','Infinity','3.5','1000'])assert.equal(validSetInput({reps,weight:'0'}),false);
  for(const weight of ['','-1','NaN','Infinity','2001'])assert.equal(validSetInput({reps:'8',weight}),false);
});
test('guided runtime requires starting, confirming, and saving in separate stages',async()=>{
  const source=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
  const mode=source.slice(source.indexOf('function WorkoutMode('));
  assert.match(mode,/if\(!recording\|\|!canComplete\|\|resting\|\|paused\|\|savedRef.current\)return/);
  assert.match(mode,/if\(!canComplete\|\|resting\|\|paused\|\|allDone\)return/);
  assert.match(source,/setWorkoutLearning\(true\)/);
  assert.match(mode,/setFeedbackOpen\(true\)/);
  assert.match(mode,/className="guided-help-panel"/);
  assert.doesNotMatch(mode,/onDetails\(ex\)/);
  assert.match(mode,/className="guided-rest"/);
});

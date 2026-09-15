import test from "node:test";
import assert from "node:assert/strict";
import {buildCorrectiveExerciseIds} from "../app/corrective-plan.mjs";

const exercises=[
  {id:"Side-Lying_Clamshell",gear:"bodyweight"},
  {id:"Supported_Split_Squat",gear:"bodyweight"},
  {id:"Bodyweight_Box_Squat",gear:"bodyweight"},
  {id:"Supported_Low_Step-Up",gear:"bodyweight"},
  {id:"Half-Kneeling_Ankle_Rock",gear:"bodyweight"},
  {id:"Goblet_Squat",gear:"dumbbell"},
  {id:"Butt_Lift_Bridge",gear:"bodyweight"},
  {id:"Cable_Pallof_Press",gear:"machine"},
  {id:"Dead_Bug",gear:"bodyweight"},
  {id:"Bird_Dog",gear:"bodyweight"},
];

test("lowest form metric leads the corrective exercise order",()=>{
  const result=buildCorrectiveExerciseIds({source:"form",metricKeys:["tracking","depth"],equipment:"gym",exercises,targetCount:5});
  assert.deepEqual(result.priorities,["tracking","depth"]);
  assert.deepEqual(result.ids.slice(0,4),["Side-Lying_Clamshell","Supported_Split_Squat","Bodyweight_Box_Squat","Supported_Low_Step-Up"]);
});

test("corrective plans respect equipment, pain feedback, and exclusions",()=>{
  const result=buildCorrectiveExerciseIds({source:"form",metricKeys:["torso","tempo","torso","unknown"],equipment:"bodyweight",exercises,fallbackIds:["Goblet_Squat","Butt_Lift_Bridge"],excludedIds:["Bird_Dog"],ratings:{Dead_Bug:"pain"},targetCount:5});
  assert.deepEqual(result.priorities,["torso","tempo"]);
  assert.ok(!result.ids.includes("Cable_Pallof_Press"));
  assert.ok(!result.ids.includes("Goblet_Squat"));
  assert.ok(!result.ids.includes("Bird_Dog"));
  assert.ok(!result.ids.includes("Dead_Bug"));
  assert.ok(result.ids.includes("Bodyweight_Box_Squat"));
  assert.ok(result.ids.length<=5);
});

test("posture correction uses observable metrics only",()=>{
  const result=buildCorrectiveExerciseIds({source:"posture",metricKeys:["hips","head"],equipment:"bodyweight",exercises,fallbackIds:["Dead_Bug"]});
  assert.deepEqual(result.priorities,["hips","head"]);
  assert.equal(result.ids[0],"Supported_Split_Squat");
  assert.ok(result.ids.includes("Butt_Lift_Bridge"));
});

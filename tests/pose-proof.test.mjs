import test from "node:test";
import assert from "node:assert/strict";
import {averageKneeAngle,selectDeepestSquatFrame} from "../app/pose-proof.mjs";

const frame=(time,bent,visibility=1)=>{
  const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility}));
  landmarks[11]={x:.4,y:.2,visibility};landmarks[12]={x:.6,y:.2,visibility};
  landmarks[23]={x:.42,y:.42,visibility};landmarks[24]={x:.58,y:.42,visibility};
  landmarks[25]={x:.42,y:.64,visibility};landmarks[26]={x:.58,y:.64,visibility};
  landmarks[27]=bent?{x:.62,y:.64,visibility}:{x:.42,y:.88,visibility};
  landmarks[28]=bent?{x:.38,y:.64,visibility}:{x:.58,y:.88,visibility};
  return{time,landmarks};
};

test("selects the deepest visible squat frame for AI evidence",()=>{
  const standing=frame(.4,false),deep=frame(1.2,true),hidden=frame(1.6,true,.2);
  assert.ok(averageKneeAngle(deep.landmarks)<averageKneeAngle(standing.landmarks));
  assert.equal(selectDeepestSquatFrame([standing,hidden,deep])?.time,1.2);
});

test("does not create visual proof from an occluded frame",()=>{
  assert.equal(selectDeepestSquatFrame([frame(.8,true,.1)]),null);
});

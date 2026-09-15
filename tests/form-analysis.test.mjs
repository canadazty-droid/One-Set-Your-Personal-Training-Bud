import test from "node:test";
import assert from "node:assert/strict";
import {analyzeSquatFrames} from "../app/form-analysis.mjs";

const makeLandmarks=(depth,asymmetry=0)=>{
  const points=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.98}));
  points[11]={x:.43,y:.25+depth*.12,z:0,visibility:.98};
  points[12]={x:.57,y:.25+depth*.12,z:0,visibility:.98};
  points[23]={x:.44,y:.45+depth*.19,z:0,visibility:.98};
  points[24]={x:.56,y:.45+depth*.19,z:0,visibility:.98};
  points[25]={x:.40+asymmetry*depth,y:.67,z:0,visibility:.98};
  points[26]={x:.60,y:.67,z:0,visibility:.98};
  points[27]={x:.38,y:.91,z:0,visibility:.98};
  points[28]={x:.62,y:.91,z:0,visibility:.98};
  points[31]={x:.40,y:.96,z:0,visibility:.98};
  points[32]={x:.60,y:.96,z:0,visibility:.98};
  return points;
};
const squatFrames=(asymmetry=0)=>Array.from({length:34},(_,index)=>{
  const phase=index/(33);
  const depth=Math.sin(phase*Math.PI)**2;
  return {time:index*.12,landmarks:makeLandmarks(depth,asymmetry)};
});

test("squat analysis returns observable metrics and actionable fixes",()=>{
  const result=analyzeSquatFrames(squatFrames(),"en");
  assert.ok(result.overall>=45&&result.overall<=98);
  assert.equal(result.metrics.length,5);
  assert.equal(result.suggestions.length,3);
  assert.ok(result.repCount>=1);
  assert.match(result.nextSet,/set|load|bodyweight/i);
  assert.equal(result.metrics.some(metric=>/appearance|body fat/i.test(metric.label)),false);
});

test("asymmetry reduces symmetry feedback",()=>{
  const balanced=analyzeSquatFrames(squatFrames(),"en");
  const asymmetric=analyzeSquatFrames(squatFrames(.13),"en");
  const score=result=>result.metrics.find(metric=>metric.key==="symmetry").score;
  assert.ok(score(asymmetric)<score(balanced));
});

test("analysis refuses clips without a continuously visible body",()=>{
  assert.throws(()=>analyzeSquatFrames([{time:0,landmarks:[]}],"en"),/full body/i);
});

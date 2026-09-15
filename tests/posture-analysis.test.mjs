import test from "node:test";
import assert from "node:assert/strict";
import {analyzePosturePhotos} from "../app/posture-analysis.mjs";

const makePose=({shoulderTilt=0,hipTilt=0,torsoShift=0,side=false}={})=>{
  const points=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.97}));
  if(side){
    points[7]={x:.53,y:.18,z:0,visibility:.94};points[8]={x:.54,y:.18,z:0,visibility:.94};
    points[11]={x:.5,y:.29,z:0,visibility:.95};points[12]={x:.51,y:.29,z:0,visibility:.95};
    points[23]={x:.49,y:.5,z:0,visibility:.95};points[24]={x:.5,y:.5,z:0,visibility:.95};
  }else{
    points[7]={x:.47,y:.18,z:0,visibility:.97};points[8]={x:.53,y:.18,z:0,visibility:.97};
    points[11]={x:.39+torsoShift,y:.29+shoulderTilt,z:0,visibility:.97};points[12]={x:.61+torsoShift,y:.29,z:0,visibility:.97};
    points[23]={x:.43,y:.5+hipTilt,z:0,visibility:.97};points[24]={x:.57,y:.5,z:0,visibility:.97};
    points[25]={x:.44,y:.69,z:0,visibility:.97};points[26]={x:.56,y:.69,z:0,visibility:.97};
    points[27]={x:.44,y:.91,z:0,visibility:.97};points[28]={x:.56,y:.91,z:0,visibility:.97};
  }
  return points;
};

test("posture photos create an observable, non-diagnostic trend baseline",()=>{
  const result=analyzePosturePhotos({front:makePose(),side:makePose({side:true})},"en");
  assert.ok(result.overall>=45&&result.overall<=98);
  assert.equal(result.metrics.length,5);
  assert.equal(result.priorities.length,3);
  assert.equal(result.photoCount,2);
  assert.equal(result.metrics.some(metric=>/body fat|appearance/i.test(metric.label)),false);
});

test("repeated visible tilt lowers the corresponding trend metric",()=>{
  const neutral=analyzePosturePhotos({front:makePose(),side:makePose({side:true})},"en");
  const tilted=analyzePosturePhotos({front:makePose({shoulderTilt:.07}),side:makePose({side:true})},"en");
  const shoulder=result=>result.metrics.find(metric=>metric.key==="shoulders").score;
  assert.ok(shoulder(tilted)<shoulder(neutral));
});

test("a front photo alone creates a quick baseline and leaves side-only trends unassessed",()=>{
  const result=analyzePosturePhotos({front:makePose()},"en");
  assert.equal(result.photoCount,1);
  assert.equal(result.metrics.filter(metric=>metric.assessed).length,4);
  assert.equal(result.metrics.find(metric=>metric.key==="head").assessed,false);
  assert.match(result.metrics.find(metric=>metric.key==="head").detail,/side photo/i);
});

test("a front photo is required",()=>{
  assert.throws(()=>analyzePosturePhotos({side:makePose({side:true})},"en"),/front photo/i);
});

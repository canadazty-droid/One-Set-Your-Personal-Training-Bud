import test from "node:test";
import assert from "node:assert/strict";
import {shareCardCopy} from "../app/share-card.mjs";

test("share-card copy exposes the score without appearance claims",()=>{
  const copy=shareCardCopy({type:"form",score:82,change:7,language:"en"});
  assert.equal(copy.title,"MY SQUAT SCORE");
  assert.match(copy.progress,/\+7/);
  assert.match(copy.shareText,/82\/100/);
  assert.match(copy.shareText,/observable performance/);
  assert.match(copy.shareText,/ONE SET/i);
  assert.doesNotMatch(copy.shareText,/body fat|better body|appearance rating/i);
});

test("posture share-card copy supports Chinese baselines",()=>{
  const copy=shareCardCopy({type:"posture",score:76,change:null,language:"zh"});
  assert.equal(copy.title,"我的体态趋势评分");
  assert.match(copy.progress,/基准/);
  assert.match(copy.shareText,/76\/100/);
});

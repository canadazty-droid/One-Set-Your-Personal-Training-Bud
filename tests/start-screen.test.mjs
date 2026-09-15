import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {hasSeenWelcome,markWelcomeSeen,getUserProfile,saveUserProfile} from '../lib/storage/userStore.ts';

const originalWindow=globalThis.window;
let values;
beforeEach(()=>{values=new Map();globalThis.window={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}});
after(()=>{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow});

test('first use shows the guide and subsequent reads remember entering',()=>{
  assert.equal(hasSeenWelcome(),false);
  markWelcomeSeen();
  assert.equal(hasSeenWelcome(),true);
  assert.equal(values.get('one-set-welcome-seen-v1'),'true');
});
test('welcome preference never replaces the existing athlete profile',()=>{
  saveUserProfile({equipment:'dumbbell',language:'en',weeklyGoal:3});
  markWelcomeSeen();
  assert.deepEqual(getUserProfile(),{equipment:'dumbbell',language:'en',weeklyGoal:3});
  saveUserProfile({...getUserProfile(),language:'zh'});
  assert.equal(hasSeenWelcome(),true);
  assert.equal(getUserProfile().equipment,'dumbbell');
});
test('blocked storage and server rendering do not block entry',()=>{
  globalThis.window={get localStorage(){throw Error('blocked')}};
  assert.equal(hasSeenWelcome(),false);
  assert.doesNotThrow(()=>markWelcomeSeen());
  delete globalThis.window;
  assert.equal(hasSeenWelcome(),false);
  assert.doesNotThrow(()=>markWelcomeSeen());
});
test('home gate is separate from progress and the guide has a return route',async()=>{
  const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
  const gate=page.slice(page.indexOf('export default function HomePage'),page.indexOf('export function OneSetApp'));
  assert.match(gate,/hasSeenWelcome\(\)/);
  assert.match(gate,/markWelcomeSeen\(\);setEntered\(true\)/);
  assert.match(gate,/return <OneSetApp\/>/);
  const start=await readFile(new URL('../app/start/page.tsx',import.meta.url),'utf8');
  assert.match(start,/window.location.assign\("\/"\)/);
});
test('welcome uses an optional real teaching sample without autoplay or fake progress',async()=>{
  const source=await readFile(new URL('../app/start-screen.tsx',import.meta.url),'utf8');
  assert.match(source,/getExerciseTutorial\("Dumbbell_Goblet_Squat"\)/);
  assert.match(source,/<video controls playsInline preload="none"/);
  assert.doesNotMatch(source,/autoPlay/);
  assert.match(source,/onError=\{\(\)=>setVideoFailed\(true\)\}/);
  assert.match(source,/<details className="start-guide welcome-details"/);
  assert.match(source,/disabled=\{entering\} aria-busy=\{entering\}/);
  for(const ext of ['jpg','mp4'])assert.ok((await stat(new URL(`../public/exercises/tutorials/ymove-dumbbell-goblet-squat.${ext}`,import.meta.url))).size>0);
});

test('entry precedes optional media and describes the actual next screen',async()=>{
  const source=await readFile(new URL('../app/start-screen.tsx',import.meta.url),'utf8');
  assert.ok(source.indexOf('className="start-primary"')<source.indexOf('className="welcome-video-details"'));
  assert.match(source,/<details className="welcome-video-details">/);
  assert.match(source,/进入训练首页/);
  assert.match(source,/Go to workout setup/);
  const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
  assert.match(page,/<header className="home-intro"><h1>\{zh\?"今日训练"/);
});

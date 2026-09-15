import test from "node:test";
import assert from "node:assert/strict";
import {clearProAccessForTest,grantProAccess,hasProAccess} from "../app/pro-access.mjs";

test("founding beta access unlocks the complete report on the same device",()=>{
  const values=new Map();const originalWindow=globalThis.window;
  globalThis.window={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
  try{
    assert.equal(hasProAccess(),false);
    assert.equal(grantProAccess(),true);
    assert.equal(hasProAccess(),true);
    clearProAccessForTest();
    assert.equal(hasProAccess(),false);
  }finally{globalThis.window=originalWindow}
});

import test from "node:test";
import assert from "node:assert/strict";
import {getPricingVariant,trackProductEvent} from "../app/product-events.mjs";

test("assigns a stable pricing experiment without personal data",async()=>{
  const values=new Map();const requests=[];
  const originalWindow=globalThis.window;const originalFetch=globalThis.fetch;
  globalThis.window={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:true}};
  try{
    const first=getPricingVariant();const second=getPricingVariant();
    assert.equal(second,first);assert.ok(first==="control"||first==="coach_anchor");
    trackProductEvent("scan_completed",{source:"form",score:78,confidence:91});
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(requests.length,1);assert.equal(requests[0].url,"/api/product-events");
    const payload=JSON.parse(requests[0].options.body);
    assert.equal(payload.eventName,"scan_completed");assert.equal(payload.source,"form");assert.equal(payload.metadata.score,78);assert.match(payload.sessionId,/^[a-zA-Z0-9-]{8,64}$/);
    assert.equal(payload.metadata.video,undefined);assert.equal(payload.metadata.photo,undefined);
  }finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch}
});

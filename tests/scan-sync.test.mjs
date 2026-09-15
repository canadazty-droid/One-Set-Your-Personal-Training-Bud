import test from "node:test";
import assert from "node:assert/strict";
import {PENDING_SCANS_KEY,queueScanRecord,readScanRecords,syncPendingScans} from "../app/scan-sync.mjs";

const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
globalThis.window=new EventTarget();

test("scan results save locally first and sync without losing metrics",async()=>{
  storage.clear();
  const record={id:"550e8400-e29b-41d4-a716-446655440000",date:new Date().toISOString(),type:"form",score:78,confidence:91,repCount:4,metrics:[{key:"depth",score:84,assessed:true}]};
  queueScanRecord(record);
  assert.equal(readScanRecords()[0].pending,true);
  assert.ok(localStorage.getItem(PENDING_SCANS_KEY));
  globalThis.fetch=async(_url,options)=>({ok:true,json:async()=>({scan:{...JSON.parse(options.body),pending:false}})});
  const synced=await syncPendingScans();
  assert.equal(synced.pending,0);
  assert.equal(synced.records[0].pending,false);
  assert.equal(synced.records[0].metrics[0].key,"depth");
});

test("failed sync keeps a scan queued for retry",async()=>{
  storage.clear();
  queueScanRecord({id:"b85f47bd-f2c5-4dcb-b344-4be2c1e06b0a",date:new Date().toISOString(),type:"posture",score:72,confidence:76,photoCount:2,metrics:[{key:"shoulders",score:72,assessed:true}]});
  globalThis.fetch=async()=>{throw new Error("offline")};
  const result=await syncPendingScans();
  assert.equal(result.pending,1);
  assert.equal(readScanRecords()[0].pending,true);
});

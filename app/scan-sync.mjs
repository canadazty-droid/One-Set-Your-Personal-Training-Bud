export const SCAN_RECORDS_KEY="form-ai-scan-records-v1";
export const PENDING_SCANS_KEY="form-ai-pending-scans-v1";
const LEGACY_FORM_KEY="form-ai-scan-history-v1";
const LEGACY_POSTURE_KEY="form-ai-posture-history-v1";

const normalize=record=>{
  if(!record||typeof record!=="object"||typeof record.id!=="string"||!['form','posture'].includes(record.type))return null;
  const date=typeof record.date==="string"&&!Number.isNaN(Date.parse(record.date))?record.date:new Date().toISOString();
  const score=Math.min(100,Math.max(0,Math.round(Number(record.score)||0)));
  const confidence=Math.min(100,Math.max(0,Math.round(Number(record.confidence)||0)));
  const metrics=Array.isArray(record.metrics)?record.metrics.slice(0,12).flatMap(metric=>metric&&typeof metric.key==="string"?[{key:metric.key,score:Math.min(100,Math.max(0,Math.round(Number(metric.score)||0))),assessed:metric.assessed!==false}]:[]):[];
  return {id:record.id,date,type:record.type,score,confidence,metrics,pending:record.pending===true,...(record.type==="form"?{repCount:Math.max(0,Math.round(Number(record.repCount)||0))}:{photoCount:Math.min(3,Math.max(2,Math.round(Number(record.photoCount)||2)))})};
};
const parseList=(value)=>{try{const parsed=JSON.parse(value||"[]");return Array.isArray(parsed)?parsed.map(normalize).filter(Boolean):[]}catch{return[]}};
const sortUnique=records=>[...new Map(records.filter(Boolean).map(record=>[record.id,record])).values()].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,60);

export function readScanRecords(){
  if(typeof window==="undefined")return[];
  const current=parseList(localStorage.getItem(SCAN_RECORDS_KEY));
  if(current.length)return current;
  const migrate=(key,type)=>{try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value.map(item=>normalize({...item,type,pending:false})).filter(Boolean):[]}catch{return[]}};
  const migrated=sortUnique([...migrate(LEGACY_FORM_KEY,"form"),...migrate(LEGACY_POSTURE_KEY,"posture")]);
  if(migrated.length)localStorage.setItem(SCAN_RECORDS_KEY,JSON.stringify(migrated));
  return migrated;
}

export function queueScanRecord(record){
  const normalized=normalize({...record,pending:true});if(!normalized)return;
  const records=sortUnique([normalized,...readScanRecords()]);
  const pending=sortUnique([normalized,...parseList(localStorage.getItem(PENDING_SCANS_KEY))]);
  localStorage.setItem(SCAN_RECORDS_KEY,JSON.stringify(records));localStorage.setItem(PENDING_SCANS_KEY,JSON.stringify(pending));window.dispatchEvent(new Event("form-ai-scans-changed"));
}

export async function syncPendingScans(){
  const pending=parseList(localStorage.getItem(PENDING_SCANS_KEY));let remaining=[...pending];let records=readScanRecords();
  for(const record of pending){
    try{const response=await fetch("/api/scans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(record)});if(!response.ok)continue;const data=await response.json();const saved=normalize(data.scan);if(saved){records=sortUnique([saved,...records.filter(item=>item.id!==saved.id)]);remaining=remaining.filter(item=>item.id!==record.id)}}catch{/* retry when online */}
  }
  localStorage.setItem(SCAN_RECORDS_KEY,JSON.stringify(records));if(remaining.length)localStorage.setItem(PENDING_SCANS_KEY,JSON.stringify(remaining));else localStorage.removeItem(PENDING_SCANS_KEY);window.dispatchEvent(new Event("form-ai-scans-changed"));return{records,pending:remaining.length};
}

export async function loadSyncedScans(){
  let records=readScanRecords();
  try{const response=await fetch("/api/scans",{cache:"no-store"});if(response.ok){const data=await response.json();const remote=Array.isArray(data.scans)?data.scans.map(normalize).filter(Boolean):[];records=sortUnique([...remote,...records]);localStorage.setItem(SCAN_RECORDS_KEY,JSON.stringify(records))}}catch{/* local fallback */}
  return records;
}

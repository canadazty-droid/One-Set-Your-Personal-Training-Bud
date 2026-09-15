export const CORRECTION_CYCLE_KEY="purefitness-correction-cycle-v1";
export const CORRECTION_CYCLE_EVENT="purefitness-correction-cycle-changed";

const day=86400000;
const validSource=value=>value==="form"||value==="posture";
const finiteScore=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Math.round(Number(value)))):null;
const cleanKeys=value=>Array.isArray(value)?[...new Set(value.filter(key=>typeof key==="string"&&key.length>0).map(key=>key.slice(0,40)))].slice(0,5):[];
const notify=()=>{try{window.dispatchEvent(new Event(CORRECTION_CYCLE_EVENT))}catch{/* unavailable outside browser */}};

export function normalizeCorrectionCycle(value){
  if(!value||typeof value!=="object"||!validSource(value.source)||typeof value.id!=="string")return null;
  const createdAt=new Date(value.createdAt);const dueAt=new Date(value.dueAt);
  if(Number.isNaN(createdAt.getTime())||Number.isNaN(dueAt.getTime()))return null;
  const baselineScore=finiteScore(value.baselineScore);if(baselineScore===null)return null;
  const targetWorkouts=Math.max(1,Math.min(6,Math.round(Number(value.targetWorkouts)||3)));
  const workoutsCompleted=Math.max(0,Math.min(targetWorkouts,Math.round(Number(value.workoutsCompleted)||0)));
  const latestScore=finiteScore(value.latestScore);
  return{id:value.id.slice(0,80),source:value.source,metricKeys:cleanKeys(value.metricKeys),baselineScore,baselineScanId:typeof value.baselineScanId==="string"?value.baselineScanId.slice(0,80):"",createdAt:createdAt.toISOString(),dueAt:dueAt.toISOString(),targetWorkouts,workoutsCompleted,lastWorkoutAt:typeof value.lastWorkoutAt==="string"&&!Number.isNaN(new Date(value.lastWorkoutAt).getTime())?new Date(value.lastWorkoutAt).toISOString():null,status:value.status==="completed"&&latestScore!==null?"completed":"active",latestScore,completedAt:typeof value.completedAt==="string"&&!Number.isNaN(new Date(value.completedAt).getTime())?new Date(value.completedAt).toISOString():null};
}

export function readCorrectionCycle(){
  try{return normalizeCorrectionCycle(JSON.parse(window.localStorage.getItem(CORRECTION_CYCLE_KEY)||"null"))}catch{return null}
}

const save=cycle=>{try{window.localStorage.setItem(CORRECTION_CYCLE_KEY,JSON.stringify(cycle));notify();return cycle}catch{return cycle}};

export function startCorrectionCycle({source,metricKeys,baselineScore,baselineScanId="",createdAt=new Date().toISOString(),targetWorkouts=3,rescanAfterDays=7}){
  const start=new Date(createdAt);const safeStart=Number.isNaN(start.getTime())?new Date():start;
  const cycle=normalizeCorrectionCycle({id:`${validSource(source)?source:"form"}-${safeStart.getTime()}`,source:validSource(source)?source:"form",metricKeys,baselineScore,baselineScanId,createdAt:safeStart.toISOString(),dueAt:new Date(safeStart.getTime()+Math.max(3,Math.min(14,Math.round(Number(rescanAfterDays)||7)))*day).toISOString(),targetWorkouts,workoutsCompleted:0,status:"active",latestScore:null,lastWorkoutAt:null,completedAt:null});
  return cycle?save(cycle):null;
}

export function recordCorrectionWorkout(completedAt=new Date().toISOString()){
  const cycle=readCorrectionCycle();if(!cycle||cycle.status!=="active")return cycle;
  return save({...cycle,workoutsCompleted:Math.min(cycle.targetWorkouts,cycle.workoutsCompleted+1),lastWorkoutAt:new Date(completedAt).toISOString()});
}

export function recordCorrectionRescan({source,score,scanId="",scannedAt=new Date().toISOString()}){
  const cycle=readCorrectionCycle();const at=new Date(scannedAt);const nextScore=finiteScore(score);
  if(!cycle||cycle.status!=="active"||cycle.source!==source||nextScore===null||Number.isNaN(at.getTime())||at.getTime()<=new Date(cycle.createdAt).getTime()||scanId===cycle.baselineScanId)return cycle;
  return save({...cycle,status:"completed",latestScore:nextScore,completedAt:at.toISOString()});
}

export function correctionCycleState(cycle,now=Date.now()){
  const normalized=normalizeCorrectionCycle(cycle);if(!normalized)return null;
  const daysLeft=Math.max(0,Math.ceil((new Date(normalized.dueAt).getTime()-Number(now))/day));
  return{...normalized,daysLeft,rescanReady:normalized.status==="active"&&(normalized.workoutsCompleted>=normalized.targetWorkouts||daysLeft===0),improvement:normalized.status==="completed"&&normalized.latestScore!==null?normalized.latestScore-normalized.baselineScore:null};
}

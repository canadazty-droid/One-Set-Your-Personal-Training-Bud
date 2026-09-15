export function formatCountdown(seconds){
  const safe=Math.max(0,Math.floor(Number(seconds)||0));
  return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`;
}

export const SESSION_STORAGE_KEY="purefitness-active-workout-v1";
export const PENDING_WORKOUTS_KEY="purefitness-pending-workouts-v1";

// A quick feeling update is not evidence of additional sets or elapsed time.
export function workoutMeasurements({summaryOnly, didComplete, previous, performances, seconds}) {
  if (!didComplete) return {performances:[],duration:0};
  if (summaryOnly) return {performances:previous?.performances || [],duration:previous?.duration || 0};
  return {performances,duration:Math.max(1,Math.round(seconds/60))};
}

export function shouldRunWorkoutClock(active, paused, learning, restRemaining) {
  return active && !paused && (!learning || restRemaining > 0);
}

export function validSetInput(input, bodyweight = false) {
  if (!input || !String(input.reps).trim()) return false;
  const reps = Number(input.reps);
  const weight = Number(input.weight);
  return Number.isInteger(reps) && reps > 0 && reps <= 999 &&
    (bodyweight || String(input.weight).trim() !== "") &&
    Number.isFinite(weight) && weight >= 0 && weight <= 2000;
}

export function setTargetLabel(prescription, target, language = "zh") {
  const value = Math.max(1, Math.round(Number(target) || Number(String(prescription).match(/\d+/)?.[0]) || 8));
  const timed = /\d\s*(s|sec|秒)\b/i.test(prescription) || /秒/.test(prescription);
  const perSide = /side|侧/i.test(prescription);
  if (language === "zh") return `${perSide ? "每侧 " : ""}${timed ? "保持 " : "做 "}${value} ${timed ? "秒" : "次"}`;
  return `${timed ? "Hold for" : "Do"} ${value} ${timed ? "seconds" : "reps"}${perSide ? " per side" : ""}`;
}

export function isSessionDraft(value,validExerciseIds=[]){
  if(!value||typeof value!=="object"||value.version!==1)return false;
  const validIds=new Set(validExerciseIds);
  if(!Array.isArray(value.planIds)||value.planIds.length<1||value.planIds.length>12)return false;
  if(validIds.size&&value.planIds.some(id=>!validIds.has(id)))return false;
  if(!Number.isFinite(value.savedAt)||Date.now()-value.savedAt>7*24*60*60*1000||value.savedAt>Date.now()+5*60*1000)return false;
  if(!Number.isInteger(value.exerciseIndex)||value.exerciseIndex<0||value.exerciseIndex>=value.planIds.length)return false;
  if(!Number.isInteger(value.setIndex)||value.setIndex<0||value.setIndex>5)return false;
  if(value.setCounts!==undefined&&(!Array.isArray(value.setCounts)||value.setCounts.length!==value.planIds.length||value.setCounts.some(count=>!Number.isInteger(count)||count<1||count>10)))return false;
  if(value.activeWorkoutId!==undefined&&!isUuid(value.activeWorkoutId))return false;
  if(!Number.isFinite(value.seconds)||value.seconds<0||value.seconds>24*60*60)return false;
  if(!Number.isFinite(value.restRemaining)||value.restRemaining<0||value.restRemaining>15*60)return false;
  if(!Number.isFinite(value.duration)||value.duration<15||value.duration>75)return false;
  if(!["full","upper","lower","pushpull","core"].includes(value.focus))return false;
  if(!["gym","dumbbell","bodyweight"].includes(value.equipment))return false;
  if(!["beginner","intermediate","advanced"].includes(value.level))return false;
  if(!["strength","muscle","fatloss","general"].includes(value.goal))return false;
  return typeof value.noviceMode==="boolean"&&value.setInputs&&typeof value.setInputs==="object"&&value.completed&&typeof value.completed==="object";
}

export function isPendingWorkout(value,validExerciseIds=[]){
  if(!value||typeof value!=="object"||!isUuid(value.id))return false;
  const completedAt=Date.parse(value.date);
  if(!Number.isFinite(completedAt)||completedAt>Date.now()+5*60*1000||completedAt<Date.now()-365*24*60*60*1000)return false;
  if(!["full","upper","lower","pushpull","core"].includes(value.focus))return false;
  if(!Number.isFinite(value.duration)||value.duration<1||value.duration>300)return false;
  if(!Number.isFinite(value.exercises)||value.exercises<1||value.exercises>50)return false;
  if(!Number.isFinite(value.sets)||value.sets<1||value.sets>200)return false;
  if(!Number.isFinite(value.totalVolume)||value.totalVolume<0)return false;
  if(!["easy","right","hard","pain"].includes(value.rating))return false;
  if(!Array.isArray(value.performances)||value.performances.length<1||value.performances.length>200)return false;
  const validIds=new Set(validExerciseIds);
  return value.performances.every(set=>set&&typeof set==="object"&&typeof set.exerciseId==="string"&&(!validIds.size||validIds.has(set.exerciseId))&&Number.isFinite(set.setNumber)&&set.setNumber>=1&&Number.isFinite(set.weightKg)&&set.weightKg>=0&&Number.isFinite(set.reps)&&set.reps>=1);
}

function isUuid(value){return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}

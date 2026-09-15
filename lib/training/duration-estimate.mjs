// A transparent planning estimate, not a measured workout duration.
export function estimateWorkoutMinutes(exercises = []) {
  if (!exercises.length) return {min:0,max:0};
  const seconds=exercises.reduce((sum,ex)=>{
    const numbers=String(ex.reps||'8').match(/\d+/g)?.map(Number)||[8];
    const reps=numbers.length>1?(numbers[0]+numbers[1])/2:numbers[0];
    const timed=/秒|sec|\bs\b/i.test(ex.reps||'');
    const sides=/侧|side/i.test(ex.reps||'')?2:1;
    const setSeconds=timed?reps*sides:reps*4*sides;
    const sets=Math.max(1,Number(ex.sets)||1);
    return sum+sets*setSeconds+Math.max(0,sets-1)*(Number(ex.restSeconds)||30)+45;
  },300); // Five minutes for preparation and cooldown; 45s between movements.
  return {min:Math.max(1,Math.floor(seconds/60)),max:Math.ceil(seconds*1.3/60)};
}

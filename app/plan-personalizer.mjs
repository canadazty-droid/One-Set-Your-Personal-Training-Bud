// Resistance type is not the same as required equipment: a pull-up is
// bodyweight but still needs a bar. These movements need more than floor/wall.
const extraEquipmentIds=new Set([
  "Band_Assisted_Pull-Up","Pullups","Hanging_Knee_Raise","Hanging_Leg_Raise",
  "Dips_-_Triceps_Version","Bodyweight_Box_Squat","Incline_Push-Up","Supported_Low_Step-Up",
  "Chest-Supported_Dumbbell_Row","Dumbbell_Bench_Press","Incline_Dumbbell_Press",
  "Dumbbell_Flyes","Bent-Arm_Dumbbell_Pullover","Dumbbell_Step_Ups",
]);
export function matchesAvailableEquipment(exercise,equipment="gym"){
  if(!exercise)return false;
  if(equipment==="gym")return true;
  if(extraEquipmentIds.has(exercise.id))return false;
  if(exercise.id==="Close-Grip_Push-Up_off_of_a_Dumbbell")return equipment==="dumbbell";
  return exercise.gear==="bodyweight"||equipment==="dumbbell"&&exercise.gear==="dumbbell";
}

export function personalizePlan(baseIds,exercises,options={}){
  const byId=new Map(exercises.map(exercise=>[exercise.id,exercise]));
  const ratings=options.ratings||{};
  const favorites=Array.isArray(options.favoriteIds)?options.favoriteIds:[];
  const easierById=options.easierById||{};
  const excluded=new Set(options.excludedIds||[]);
  const equipment=options.equipment||"gym";
  const novice=Boolean(options.novice);
  const targetCount=Number.isInteger(options.targetCount)?Math.max(1,Math.min(10,options.targetCount)):baseIds.length;
  const fits=exercise=>Boolean(exercise)&&!excluded.has(exercise.id)&&matchesAvailableEquipment(exercise,equipment)&&(!novice||exercise.level==="beginner");
  const ids=[];
  const painSwaps=[];

  for(const baseId of baseIds){
    const base=byId.get(baseId);
    if(!base)continue;
    let chosen=base;
    if(ratings[baseId]==="pain"){
      const alternatives=[easierById[baseId],...(base.alternatives||[]),...exercises.filter(candidate=>candidate.body===base.body).map(candidate=>candidate.id)];
      const replacement=alternatives.map(id=>byId.get(id)).find(candidate=>fits(candidate)&&ratings[candidate.id]!=="pain"&&!ids.includes(candidate.id));
      if(replacement){chosen=replacement;painSwaps.push({from:baseId,to:replacement.id})}
    }
    if(fits(chosen)&&!ids.includes(chosen.id))ids.push(chosen.id);
  }

  const favoritesUsed=[];
  for(const favoriteId of favorites){
    if(favoritesUsed.length>=2)break;
    const favorite=byId.get(favoriteId);
    if(!fits(favorite)||ratings[favoriteId]==="pain")continue;
    if(ids.includes(favoriteId)){favoritesUsed.push(favoriteId);continue}
    const replaceIndex=ids.findIndex(id=>byId.get(id)?.body===favorite.body&&!favorites.includes(id));
    if(replaceIndex<0)continue;
    ids[replaceIndex]=favoriteId;
    favoritesUsed.push(favoriteId);
  }

  if(ids.length>targetCount)ids.splice(targetCount);
  const focusBodies={full:["chest","back","shoulders","arms","lower","core"],upper:["chest","back","shoulders","arms","core"],lower:["lower","core"],pushpull:["chest","back","shoulders","arms"],core:["core"]}[options.focus||"full"]||[];
  const candidatePool=exercises.filter(exercise=>focusBodies.includes(exercise.body)&&fits(exercise)&&ratings[exercise.id]!=="pain"&&!ids.includes(exercise.id));
  while(ids.length<targetCount&&candidatePool.length){
    const counts=new Map();
    for(const id of ids){const body=byId.get(id)?.body;counts.set(body,(counts.get(body)||0)+1)}
    candidatePool.sort((a,b)=>(counts.get(a.body)||0)-(counts.get(b.body)||0)||(a.level==="beginner"?-1:1)-(b.level==="beginner"?-1:1));
    ids.push(candidatePool.shift().id);
  }

  return {ids,painSwaps:painSwaps.filter(swap=>ids.includes(swap.to)),favoritesUsed:favoritesUsed.filter(id=>ids.includes(id))};
}

export function exerciseTargetForDuration(durationMinutes){
  const duration=Math.max(15,Math.min(75,Math.round(Number(durationMinutes)||45)));
  return duration<=20?3:duration<=30?4:duration<=50?5:duration<=65?6:7;
}

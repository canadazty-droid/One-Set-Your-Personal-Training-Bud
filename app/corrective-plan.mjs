export const correctiveMoves={
  form:{depth:["Half-Kneeling_Ankle_Rock","Bodyweight_Box_Squat","Goblet_Squat","Butt_Lift_Bridge"],tracking:["Side-Lying_Clamshell","Supported_Split_Squat","Bodyweight_Box_Squat","Supported_Low_Step-Up"],symmetry:["Supported_Split_Squat","Supported_Low_Step-Up","Suitcase_Carry","Kneeling_Side_Plank"],torso:["Dead_Bug","Cable_Pallof_Press","Bird_Dog","Goblet_Squat"],tempo:["Bodyweight_Box_Squat","Goblet_Squat","Dead_Bug","Half-Kneeling_Ankle_Rock"]},
  posture:{shoulders:["Wall_Slide","Chest-Supported_Dumbbell_Row","Bird_Dog","Cable_Pallof_Press"],hips:["Supported_Split_Squat","Butt_Lift_Bridge","Side-Lying_Clamshell","Supported_Low_Step-Up"],torso:["Cable_Pallof_Press","Dead_Bug","Suitcase_Carry","Bird_Dog"],stance:["Supported_Low_Step-Up","Supported_Split_Squat","Butt_Lift_Bridge","Standing_Calf_Raises"],head:["Wall_Slide","Cat-Cow","Chest-Supported_Dumbbell_Row","Bird_Dog"]}
};

/**
 * @param {{
 * source:"form"|"posture",
 * metricKeys:string[],
 * equipment:"gym"|"dumbbell"|"bodyweight",
 * exercises:Array<{id:string,gear:string}>,
 * fallbackIds?:string[],
 * excludedIds?:string[],
 * ratings?:Record<string,string>,
 * targetCount?:number
 * }} options
 */
export function buildCorrectiveExerciseIds({source,metricKeys,equipment,exercises,fallbackIds=[],excludedIds=[],ratings={},targetCount=5}){
  const map=correctiveMoves[source]||{};const priorities=[...new Set(metricKeys)].filter(key=>Array.isArray(map[key])).slice(0,3);const byId=new Map(exercises.map(exercise=>[exercise.id,exercise]));const excluded=new Set(excludedIds);
  const fits=exercise=>equipment==="gym"||exercise.gear==="bodyweight"||(equipment==="dumbbell"&&exercise.gear==="dumbbell");
  const candidates=[...priorities.flatMap(key=>map[key]),...fallbackIds];
  const ids=[...new Set(candidates)].filter(id=>{const exercise=byId.get(id);return exercise&&fits(exercise)&&!excluded.has(id)&&ratings[id]!=="pain"}).slice(0,targetCount);
  return{ids,priorities};
}

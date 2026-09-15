export const correctiveMoves:Record<"form"|"posture",Record<string,string[]>>;
export function buildCorrectiveExerciseIds(options:{source:"form"|"posture";metricKeys:string[];equipment:"gym"|"dumbbell"|"bodyweight";exercises:Array<{id:string;gear:string}>;fallbackIds?:string[];excludedIds?:string[];ratings?:Record<string,string>;targetCount?:number}):{ids:string[];priorities:string[]};

export type PersonalizationResult={ids:string[];painSwaps:Array<{from:string;to:string}>;favoritesUsed:string[]};
export function personalizePlan(baseIds:string[],exercises:Array<{id:string;body:string;gear:string;level:string;alternatives?:string[]}>,options?:{ratings?:Record<string,string>;favoriteIds?:string[];easierById?:Record<string,string>;excludedIds?:string[];equipment?:"gym"|"dumbbell"|"bodyweight";novice?:boolean;focus?:"full"|"upper"|"lower"|"pushpull"|"core";targetCount?:number}):PersonalizationResult;
export function exerciseTargetForDuration(durationMinutes:number):number;

export type ParsedFocus = "full" | "upper" | "lower" | "pushpull" | "core";
export type ParsedEquipment = "gym" | "dumbbell" | "bodyweight";
export type ParsedLevel = "beginner" | "intermediate" | "advanced";
export type ParsedGoal = "strength" | "muscle" | "fatloss" | "general";
export type RequestDefaults = {duration:number;focus:ParsedFocus;equipment:ParsedEquipment;level:ParsedLevel;goal:ParsedGoal};
export function parseWorkoutRequest(input:string,fallback:RequestDefaults):RequestDefaults&{intensity?:"light"|"normal"|"hard";excludedExercises?:string[];understood:boolean};

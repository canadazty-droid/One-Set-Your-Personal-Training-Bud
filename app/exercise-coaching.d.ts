export type TempoPhase={label:string;value:string};
export function buildTempoGuide(tempo:string,language?:"zh"|"en"):TempoPhase[];
export function starterLoadRule(exercise:{gear:string;level:string},language?:"zh"|"en"):string;

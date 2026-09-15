export type PoseLandmark={x:number;y:number;z?:number;visibility?:number};
export type PoseFrame={time:number;landmarks:PoseLandmark[]};
export type FormMetric={key:string;score:number;label:string;detail:string;status:"good"|"watch"|"fix";confidenceLevel:"high"|"medium"|"low"};
export type FormAnalysis={overall:number;confidence:number;repCount:number;metrics:FormMetric[];suggestions:string[];nextSet:string;deepestKneeAngle:number};
export function analyzeSquatFrames(frames:PoseFrame[],language?:"zh"|"en"):FormAnalysis;

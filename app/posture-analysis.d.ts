export type PostureLandmark={x:number;y:number;z?:number;visibility?:number};
export type PostureMetric={key:string;score:number;label:string;detail:string;confidence:"high"|"medium"|"low";assessed:boolean};
export type PostureAnalysis={overall:number;confidence:number;metrics:PostureMetric[];priorities:{key:string;title:string;text:string}[];next:string;photoCount:number};
export function analyzePosturePhotos(photos:{front:PostureLandmark[];side:PostureLandmark[];back?:PostureLandmark[]},language?:"zh"|"en"):PostureAnalysis;

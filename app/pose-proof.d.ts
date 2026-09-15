export type ProofLandmark={x:number;y:number;visibility?:number};
export type ProofFrame={time:number;landmarks:ProofLandmark[]};
export const PROOF_JOINTS:number[];
export const PROOF_CONNECTIONS:number[][];
export function selectDeepestSquatFrame(frames:ProofFrame[]):ProofFrame|null;
export function averageKneeAngle(points:ProofLandmark[]):number;

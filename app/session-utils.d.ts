export function formatCountdown(seconds:number):string;
export const SESSION_STORAGE_KEY:string;
export const PENDING_WORKOUTS_KEY:string;
export function isSessionDraft(value:unknown,validExerciseIds?:string[]):boolean;
export function isPendingWorkout(value:unknown,validExerciseIds?:string[]):boolean;

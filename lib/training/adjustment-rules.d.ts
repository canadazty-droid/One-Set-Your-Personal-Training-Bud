export type AdjustmentLog = { date?: string; workoutDate?: string; completed?: boolean; focus: string; perceivedDifficulty?: number | null; energyLevel?: number | null; sorenessLevel?: number | null };
export type WorkoutAdjustment = { durationMinutes: number; focus: string; intensity: string; exerciseDelta: number; setDelta: number; adjustmentReason: string; frequencySuggestion: string };
export function recentAdjustmentLogs<T extends AdjustmentLog>(logs?: T[], now?: Date): T[];
export function adjustNextWorkout(request: {durationMinutes:number;focus:string;intensity?:string;preserveFocus?:boolean}, logs?: AdjustmentLog[], now?: Date): WorkoutAdjustment;
export function describeAdjustment(reason: string, language?: "zh" | "en"): string;

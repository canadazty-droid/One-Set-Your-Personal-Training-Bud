import { isInLast7AppDays } from "../date/app-date.mjs";
import { trainingRecords } from "./record-quality.mjs";

export function buildSevenDayReview(logs = [], plannedWorkouts = 4, now = new Date()) {
  const recent = trainingRecords(logs).filter(log => isInLast7AppDays(log.date || log.workoutDate, now));
  const completed = recent.filter(log => log.completed !== false);
  const values = (key) => recent.map(log => log[key]).filter(value=>value!==null&&value!==undefined).map(Number).filter(value=>Number.isFinite(value)&&value>=1&&value<=10);
  const average = (items) => items.length ? Math.round(items.reduce((sum, value) => sum + value, 0) / items.length * 10) / 10 : 0;
  const averageEnergy = average(values("energyLevel"));
  const averageSoreness = average(values("sorenessLevel"));
  const averageDifficulty = average(values("perceivedDifficulty"));
  const completionRate = plannedWorkouts ? Math.min(100, Math.round(completed.length / plannedWorkouts * 100)) : 0;
  const riskFlags = [];
  if (recent.length >= 2 && completionRate < 60) riskFlags.push("low_completion");
  if (averageSoreness > 7) riskFlags.push("high_soreness");
  if (averageEnergy > 0 && averageEnergy < 5) riskFlags.push("low_energy");
  if (averageDifficulty > 8.5) riskFlags.push("high_difficulty");
  const consecutiveMisses = recent.slice(0, 2).length === 2 && recent.slice(0, 2).every(log => log.completed === false);
  if (consecutiveMisses) riskFlags.push("repeated_misses");
  let nextWeekAdjustment = "maintain_volume";
  if (averageSoreness > 7) nextWeekAdjustment = "reduce_intensity_and_add_recovery";
  else if (averageEnergy > 0 && averageEnergy < 5) nextWeekAdjustment = "reduce_intensity_and_add_recovery";
  else if (averageDifficulty > 8.5) nextWeekAdjustment = "reduce_volume_15";
  else if (recent.length >= 2 && completionRate < 60) nextWeekAdjustment = "reduce_volume_15";
  else if (recent.length >= 2 && completionRate > 85 && averageSoreness > 0 && averageSoreness < 6) nextWeekAdjustment = "increase_volume_5";
  const nextWorkoutSuggestion = averageSoreness > 7
    ? "light_recovery"
    : averageEnergy > 0 && averageEnergy < 5
      ? "short_light_session"
      : averageDifficulty > 8.5
        ? "short_light_session"
      : consecutiveMisses
        ? "shorter_more_realistic_session"
        : recent.length >= 2 && completionRate > 85 && averageSoreness > 0 && averageSoreness < 6 ? "small_progression" : "repeat_baseline";
  return { plannedWorkouts, completedWorkouts: completed.length, completionRate, averageEnergy, averageSoreness, averageDifficulty, riskFlags, nextWorkoutSuggestion, nextWeekAdjustment, recent };
}

import { trainingRecords } from "./record-quality.mjs";
import { isInLast7AppDays } from "../date/app-date.mjs";
const oppositeFocus = { upper: "lower", pushpull: "lower", lower: "upper", core: "full", full: "upper" };

export function recentAdjustmentLogs(logs = [], now = new Date()) {
  return trainingRecords(logs).filter(log => {
    const date = log.workoutDate || log.date;
    return typeof date === "string" && date.length > 0 && isInLast7AppDays(date, now);
  });
}

export function adjustNextWorkout(request, logs = [], now = new Date()) {
  const recorded = trainingRecords(logs);
  logs = recentAdjustmentLogs(recorded, now);
  const latest = logs[0];
  const recent = logs.slice(0, 3);
  const firstCompleted = logs.findIndex(log => log.completed !== false);
  const missedStreak = firstCompleted === -1 ? logs.length : firstCompleted;
  const completedStreak = recent.length === 3 && recent.every(log => log.completed !== false);
  const result = {
    durationMinutes: request.durationMinutes,
    focus: request.focus,
    intensity: request.intensity || "normal",
    exerciseDelta: request.intensity === "light" ? -1 : 0,
    setDelta: request.intensity === "light" ? -1 : 0,
    adjustmentReason: request.intensity === "light" ? "request:light" : "",
    frequencySuggestion: "",
  };
  if (!latest) {
    if (!result.adjustmentReason) result.adjustmentReason = recorded.length ? "baseline:stale_logs" : "baseline:no_logs";
    return result;
  }
  if (missedStreak >= 2) {
    result.durationMinutes = Math.max(20, request.durationMinutes - 15);
    result.intensity = "light";
    result.exerciseDelta = -1;
    result.frequencySuggestion = "reduce_frequency";
    result.adjustmentReason = `missed:${missedStreak}`;
    return result;
  }
  if (latest.sorenessLevel >= 8) {
    result.focus = request.preserveFocus ? request.focus : oppositeFocus[latest.focus] || request.focus;
    result.intensity = "light";
    result.exerciseDelta = -1;
    result.setDelta = -1;
    result.adjustmentReason = `soreness:${latest.sorenessLevel}`;
    return result;
  }
  if (latest.energyLevel != null && latest.energyLevel >= 1 && latest.energyLevel <= 4) {
    result.durationMinutes = Math.min(request.durationMinutes, 30);
    result.intensity = "light";
    result.exerciseDelta = -1;
    result.setDelta = -1;
    result.adjustmentReason = `energy:${latest.energyLevel}`;
    return result;
  }
  if (latest.perceivedDifficulty >= 9) {
    result.exerciseDelta = -1;
    result.setDelta = -1;
    result.adjustmentReason = `difficulty:${latest.perceivedDifficulty}`;
    return result;
  }
  if (completedStreak && recent.every(log => log.sorenessLevel >= 1 && log.sorenessLevel <= 6 && log.energyLevel >= 5 && log.perceivedDifficulty >= 1 && log.perceivedDifficulty < 9)) {
    result.setDelta = 1;
    result.adjustmentReason = "completed_streak:3";
  }
  return result;
}

export function describeAdjustment(reason, language = "zh") {
  if (!reason) return "";
  const [kind, raw] = reason.split(":");
  const value = Number(raw);
  const zh = language === "zh";
  if (reason === "baseline:stale_logs") return zh ? "最近 7 天没有有效记录，暂不沿用旧的酸痛或精力反馈。请按今天的感觉选择强度。" : "No valid records in the last 7 days. Old soreness and energy feedback is not applied; choose intensity based on how you feel today.";
  if (kind === "baseline") return zh ? "先完成几次训练，系统会根据记录自动调整。" : "Complete a few workouts so the system can adjust from your records.";
  if (kind === "soreness") return zh ? "因为你上次酸痛较高，这次改成轻量恢复训练。" : `Because soreness was ${value}/10 last time, this is now a light recovery workout.`;
  if (kind === "energy") return zh ? "因为你上次精力偏低，这次降低训练强度。" : `Because energy was ${value}/10 last time, this workout is shorter and lighter.`;
  if (kind === "difficulty") return zh ? "因为你上次反馈难度偏高，这次减少训练容量。" : `Because difficulty was ${value}/10 last time, this workout reduces training volume.`;
  if (kind === "missed") return zh ? `因为连续 ${value} 次未完成，今天缩短训练，并建议降低每周频率。` : `After ${value} missed workouts, today is shorter and a lower weekly frequency may be more realistic.`;
  if (reason === "request:light") return zh ? "已按你的要求生成轻量训练，并减少一个动作和一组。" : "Built as a lighter session with one fewer move and set, as requested.";
  if (reason === "completed_streak:3") return zh ? "你最近完成度高且恢复良好，这次小幅增加训练容量。" : "You completed 3 sessions with manageable soreness, so this workout slightly increases volume.";
  return "";
}

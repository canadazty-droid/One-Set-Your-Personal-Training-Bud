import { getLogsForLast7Days } from "../storage/log-store";
import { getUserProfile } from "../storage/userStore";
import { saveWeeklyReview } from "../storage/reviewStore";
import { buildSevenDayReview } from "./weekly-review.mjs";

export type WeeklyReview = {
  id: string; userId: string; weekStart: string; weekEnd: string;
  plannedWorkouts: number; completedWorkouts: number; completionRate: number;
  averageEnergy: number; averageSoreness: number; averageDifficulty: number;
  riskFlags: string[]; nextWorkoutSuggestion: string; nextWeekAdjustment: string; createdAt: string;
};

export async function generateWeeklyReview(userId: string, plannedWorkouts?: number): Promise<WeeklyReview> {
  const now = new Date();
  const logs = await getLogsForLast7Days(userId);
  const profile = plannedWorkouts === undefined ? getUserProfile<{ weeklyGoal?: number; weeklyDays?: number }>() : null;
  const resolvedPlannedWorkouts = plannedWorkouts ?? profile?.weeklyGoal ?? profile?.weeklyDays ?? 4;
  const review = buildSevenDayReview(logs, resolvedPlannedWorkouts, now);
  const weekStart = new Date(now.getTime() - 6 * 86400000);
  const insufficientData = logs.length < 2;
  const riskFlags: string[] = [];
  const suggestions: string[] = [];
  if (!insufficientData) {
    if (review.completionRate < 60) {
      riskFlags.push("本周完成率偏低");
      suggestions.push("建议减少训练量或缩短每次训练时间。");
    }
    if (review.averageSoreness > 7) {
      riskFlags.push("酸痛偏高");
      suggestions.push("建议降低强度或增加休息。");
    }
    if (review.averageEnergy > 0 && review.averageEnergy < 5) {
      riskFlags.push("精力偏低");
      suggestions.push("优先恢复、睡眠和饮食，再增加训练量。");
    }
    if (review.averageDifficulty > 8.5) {
      riskFlags.push("训练难度偏高");
      suggestions.push("建议减少组数或降低强度。");
    }
    if (review.completionRate > 85 && review.averageSoreness < 6) {
      riskFlags.push("恢复良好");
      suggestions.push("可以小幅增加训练容量。");
    }
  }
  const weeklyReview: WeeklyReview = {
    id: `${userId}-${weekStart.toISOString().slice(0, 10)}`, userId,
    weekStart: weekStart.toISOString(), weekEnd: now.toISOString(),
    plannedWorkouts: review.plannedWorkouts, completedWorkouts: review.completedWorkouts,
    completionRate: review.completionRate / 100, averageEnergy: review.averageEnergy,
    averageSoreness: review.averageSoreness, averageDifficulty: review.averageDifficulty,
    riskFlags: insufficientData ? ["需要更多训练记录"] : riskFlags,
    nextWorkoutSuggestion: insufficientData ? "先完成 2 次训练，再判断趋势。" : suggestions.join(" ") || "保持当前训练容量。",
    nextWeekAdjustment: insufficientData ? "暂不调整训练计划。" : suggestions.join(" ") || "保持当前训练容量。",
    createdAt: now.toISOString(),
  };
  saveWeeklyReview(userId, weeklyReview);
  return weeklyReview;
}

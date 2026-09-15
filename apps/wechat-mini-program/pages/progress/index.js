const api = require("../../shared/api");

function dayKey(value) { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
function calculate(workouts) {
  const completed = workouts.filter(item => item.status !== "missed");
  const now = new Date(); const month = completed.filter(item => { const date = new Date(item.date); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); });
  const last7Start = Date.now() - 6 * 86400000; const weekly = completed.filter(item => new Date(item.date).getTime() >= last7Start);
  const currentVolume = month.reduce((sum, item) => sum + Number(item.totalVolume || 0), 0);
  const prs = new Map();
  completed.forEach(workout => (workout.performances || []).forEach(set => { const current = prs.get(set.exerciseId); if (!current || Number(set.weightKg) > current.weightKg) prs.set(set.exerciseId, { name: set.exerciseId, weightKg: Number(set.weightKg), reps: Number(set.reps), date: workout.date }); }));
  const days = unique(completed.map(item => dayKey(item.date))).sort((a, b) => b.localeCompare(a));
  let streak = 0; let cursor = new Date();
  while (days.includes(dayKey(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - 86400000); }
  return { monthCount: month.length, weeklyCount: weekly.length, currentVolume: Math.round(currentVolume), streak, records: [...prs.values()].sort((a, b) => b.weightKg - a.weightKg).slice(0, 5), recent: completed.slice(0, 6).map(item => { const date = new Date(item.date); return { ...item, dateLabel: `${date.getMonth() + 1}月${date.getDate()}日` }; }) };
}
function unique(values) { return [...new Set(values)]; }

Page({
  data: { loading: true, metrics: { monthCount: 0, weeklyCount: 0, currentVolume: 0, streak: 0, records: [], recent: [] } },
  async onShow() { this.setData({ loading: true }); const workouts = await api.getWorkouts(); this.setData({ loading: false, metrics: calculate(workouts) }); api.track("progress_viewed", { workoutCount: workouts.length }); },
});

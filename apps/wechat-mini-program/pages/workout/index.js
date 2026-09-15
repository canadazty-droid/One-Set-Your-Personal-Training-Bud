const api = require("../../shared/api");

Page({
  timer: null,
  data: { workout: null, sets: [], currentIndex: 0, weightKg: 0, reps: 8, rpe: 8, rir: 2, setType: "working", showAdvanced: false, restLeft: 0, saving: false, finished: false, summary: null, error: "", lastSetText: "暂无记录" },
  onShow() { this.loadWorkout(); },
  onHide() { this.stopTimer(); },
  onUnload() { this.stopTimer(); },
  async loadWorkout() {
    const workout = api.store.getActiveWorkout();
    if (!workout) { this.setData({ workout: null }); return; }
    const history = await api.getWorkouts();
    this.historyByExercise = {};
    for (const session of history) {
      for (const performance of session.performances || []) {
        if (!this.historyByExercise[performance.exerciseId]) this.historyByExercise[performance.exerciseId] = performance;
      }
    }
    const sets = workout.exercises.flatMap(exercise => Array.from({ length: exercise.sets }, (_, index) => ({ exerciseId: exercise.id, exerciseName: exercise.name, setNumber: index + 1, totalSets: exercise.sets, repsTarget: exercise.reps, restSeconds: exercise.restSeconds || 60, completed: false })));
    const completed = api.store.getCompletedSets();
    const merged = sets.map(set => ({ ...set, completed: completed.some(done => done.exerciseId === set.exerciseId && done.setNumber === set.setNumber) }));
    const currentIndex = Math.max(0, merged.findIndex(set => !set.completed));
    const current = merged[currentIndex];
    this.setData({ workout, sets: merged, currentIndex, weightKg: this.previousValue(current?.exerciseId, "weightKg", 0), reps: this.previousValue(current?.exerciseId, "reps", this.repTarget(current?.repsTarget)), lastSetText: this.previousText(current?.exerciseId) });
  },
  previousValue(exerciseId, key, fallback) { const sets = api.store.getCompletedSets().filter(item => item.exerciseId === exerciseId); if (sets.length) return sets[sets.length - 1][key]; return this.historyByExercise?.[exerciseId]?.[key] ?? fallback; },
  previousText(exerciseId) { const last = this.historyByExercise?.[exerciseId]; return last ? `${Number(last.weightKg || 0)} kg × ${last.reps}` : "暂无记录"; },
  repTarget(value) { const match = String(value || "8").match(/\d+/); return match ? Number(match[0]) : 8; },
  setNumber(event) { this.setData({ [event.currentTarget.dataset.key]: Number(event.detail.value) || 0 }); },
  toggleAdvanced() { this.setData({ showAdvanced: !this.data.showAdvanced }); },
  chooseSetType(event) { this.setData({ setType: event.currentTarget.dataset.value }); },
  async completeSet() {
    if (this.data.saving || !this.data.workout || !this.data.sets.length) return;
    const current = this.data.sets[this.data.currentIndex];
    const payload = { workoutId: this.data.workout.id, exerciseId: current.exerciseId, setNumber: current.setNumber, weightKg: this.data.weightKg, reps: this.data.reps, rpe: this.data.rpe, rir: this.data.rir, setType: this.data.setType, focus: this.data.workout.focusArea?.split(",")[0] || "full" };
    this.setData({ saving: true, error: "" });
    try {
      const result = await api.logSet(payload);
      const saved = { ...payload, completedAt: result.set?.completedAt || new Date().toISOString(), source: "mini_program" };
      const completedSets = api.store.getCompletedSets().filter(item => !(item.exerciseId === saved.exerciseId && item.setNumber === saved.setNumber));
      completedSets.push(saved); api.store.saveCompletedSets(completedSets); api.track("set_completed", { workoutId: this.data.workout.id, exerciseId: saved.exerciseId });
      const sets = this.data.sets.map((item, index) => index === this.data.currentIndex ? { ...item, completed: true } : item);
      const nextIndex = sets.findIndex(item => !item.completed);
      if (nextIndex < 0) { this.setData({ sets, saving: false }); await this.finishWorkout(); return; }
      const next = sets[nextIndex];
      this.setData({ sets, currentIndex: nextIndex, saving: false, weightKg: this.previousValue(next.exerciseId, "weightKg", this.data.weightKg), reps: this.previousValue(next.exerciseId, "reps", this.repTarget(next.repsTarget)), restLeft: current.restSeconds, lastSetText: this.previousText(next.exerciseId) });
      this.startTimer();
    } catch (error) { this.setData({ saving: false, error: error.message || "保存失败，请重试。" }); }
  },
  startTimer() { this.stopTimer(); this.timer = setInterval(() => { const next = Math.max(0, this.data.restLeft - 1); this.setData({ restLeft: next }); if (!next) this.stopTimer(); }, 1000); },
  stopTimer() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  skipRest() { this.setData({ restLeft: 0 }); this.stopTimer(); },
  async finishWorkout() {
    this.stopTimer();
    const workout = this.data.workout;
    const completedSets = api.store.getCompletedSets();
    const summary = api.domain.summarizeCompletedWorkout(workout, completedSets);
    await api.completeWorkout(workout.id, summary.durationMinutes);
    const record = { id: workout.id, date: new Date().toISOString(), focus: workout.focusArea, name: workout.name, duration: summary.durationMinutes, sets: summary.setCount, totalVolume: summary.totalVolumeKg, performances: completedSets, status: "completed", source: "mini_program" };
    api.store.saveWorkout(record); api.store.clearActiveWorkout(); api.track("workout_completed", summary);
    this.setData({ finished: true, summary, workout: record });
  },
  done() { wx.switchTab({ url: "/pages/today/index" }); },
  onShareAppMessage() { const s = this.data.summary; return { title: s ? `ONE SET · ${s.durationMinutes} 分钟 / ${s.setCount} 组 / ${s.totalVolumeKg} KG` : "ONE SET · 马上开练", path: "/pages/today/index" }; },
});

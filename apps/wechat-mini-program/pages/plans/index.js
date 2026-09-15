const api = require("../../shared/api");

Page({
  data: { mode: "plans", plans: [], importText: "", planPreview: null, logText: "", logPreview: null, saving: false, message: "" },
  onShow() { this.setData({ plans: api.store.getPlans() }); },
  setMode(event) { this.setData({ mode: event.currentTarget.dataset.mode, message: "" }); },
  onImportInput(event) { this.setData({ importText: event.detail.value, planPreview: null }); },
  parsePlan() { const planPreview = api.domain.parseImportedPlan(this.data.importText); this.setData({ planPreview }); api.track("workout_imported", { exerciseCount: planPreview.exercises.length }); },
  async savePlan() {
    if (!this.data.planPreview?.exercises.length) return;
    this.setData({ saving: true });
    const plan = await api.saveImportedPlan(this.data.planPreview);
    api.track("plan_saved", { planId: plan.id });
    this.setData({ saving: false, plans: api.store.getPlans(), message: "已保存到我的计划", mode: "plans" });
  },
  async startPlan(event) {
    const plan = api.store.getPlans().find(item => item.id === event.currentTarget.dataset.id);
    if (!plan) return;
    let workout = { id: `workout-${Date.now()}`, name: plan.name, focusArea: "full", durationMinutes: 45, intensity: "normal", source: "imported_plan", exercises: plan.exercises.map((item, index) => ({ id: item.exerciseId, name: item.name, sets: item.sets, reps: item.repsMin === item.repsMax ? String(item.repsMin) : `${item.repsMin}-${item.repsMax}`, restSeconds: item.restSeconds || 90, order: index + 1 })), startedAt: Date.now(), status: "in_progress" };
    const started = await api.startWorkout({ workoutId: workout.id, focus: "full", startedAt: workout.startedAt, source: "imported_plan" });
    if (started?.workoutId) workout = { ...workout, id: started.workoutId };
    api.store.saveActiveWorkout(workout); api.store.saveCompletedSets([]); api.track("workout_started", { source: "imported_plan" }); wx.switchTab({ url: "/pages/workout/index" });
  },
  onLogInput(event) { this.setData({ logText: event.detail.value, logPreview: null }); },
  parseLog() { const parsed = api.domain.parseNaturalLanguageLog(this.data.logText); this.setData({ logPreview: { ...parsed, entries: parsed.entries.map(item => ({ ...item, repsLabel: item.reps.join(" / ") })) } }); api.track("natural_language_log_started", {}); },
  async confirmLog() {
    if (!this.data.logPreview?.entries.length) return;
    this.setData({ saving: true });
    const workoutId = `oneset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const performances = [];
    for (const entry of this.data.logPreview.entries) {
      for (let index = 0; index < entry.reps.length; index += 1) {
        const payload = { workoutId, exerciseId: entry.exerciseId, setNumber: index + 1, weightKg: entry.weightKg, reps: entry.reps[index], source: "natural_language_log" };
        await api.logSet(payload); performances.push({ ...payload, completedAt: new Date().toISOString() });
      }
    }
    await api.completeWorkout(workoutId, 45);
    api.store.saveWorkout({ id: workoutId, date: new Date().toISOString(), name: "一句话训练记录", focus: "full", duration: 45, sets: performances.length, totalVolume: performances.reduce((sum, item) => sum + item.weightKg * item.reps, 0), performances, status: "completed", source: "natural_language_log" });
    api.track("natural_language_log_confirmed", { setCount: performances.length });
    this.setData({ saving: false, message: "训练记录已保存", logText: "", logPreview: null, mode: "plans" });
  },
});

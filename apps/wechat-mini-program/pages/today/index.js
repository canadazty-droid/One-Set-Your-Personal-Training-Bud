const api = require("../../shared/api");

Page({
  data: { input: "", workout: null, generating: false, profileReady: false, error: "" },
  onLoad() { api.track("onboarding_started", { entry: "today" }); },
  onShow() {
    const profile = api.store.getProfile();
    this.setData({ profileReady: Boolean(profile), workout: api.store.getActiveWorkout() });
    if (!profile && !wx.getStorageSync("oneset_onboarding_seen")) wx.navigateTo({ url: "/pages/onboarding/index" });
  },
  onInput(event) { this.setData({ input: event.detail.value, error: "" }); },
  useSuggestion(event) { const value = event.currentTarget.dataset.value; this.setData({ input: value }); this.generate(); },
  async generate() {
    const input = this.data.input.trim() || "40分钟，全身训练";
    this.setData({ generating: true, error: "" });
    try {
      const workout = await api.generateWorkout(input);
      api.store.saveActiveWorkout({ ...workout, requestText: input }); api.store.saveCompletedSets([]);
      api.track("workout_generated", { duration: workout.durationMinutes, focus: workout.focusArea });
      this.setData({ workout });
    } catch (error) { this.setData({ error: error.message || "暂时无法生成，请再试一次。" }); }
    finally { this.setData({ generating: false }); }
  },
  async startWorkout() {
    let workout = { ...this.data.workout, startedAt: Date.now(), status: "in_progress" };
    const started = await api.startWorkout({ workoutId: workout.id, focus: workout.focusArea?.split(",")[0] || "full", startedAt: workout.startedAt });
    if (started?.workoutId) workout = { ...workout, id: started.workoutId };
    api.store.saveActiveWorkout(workout); api.track("workout_started", { workoutId: workout.id });
    wx.switchTab({ url: "/pages/workout/index" });
  },
  goPlans() { wx.switchTab({ url: "/pages/plans/index" }); },
});

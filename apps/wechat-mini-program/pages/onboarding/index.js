const api = require("../../shared/api");

const STEPS = [
  { key: "goal", title: "你的目标是什么？", options: [{ value: "muscle", label: "增肌" }, { value: "fatloss", label: "减脂" }, { value: "strength", label: "力量" }, { value: "general", label: "保持健康" }] },
  { key: "level", title: "你的训练经验？", options: [{ value: "beginner", label: "新手" }, { value: "intermediate", label: "有一些经验" }, { value: "advanced", label: "进阶" }] },
  { key: "equipment", title: "你通常在哪里训练？", options: [{ value: "gym", label: "商业健身房" }, { value: "home_gym", label: "家庭健身房" }, { value: "dumbbell", label: "哑铃" }, { value: "bodyweight", label: "徒手" }] },
];

Page({
  data: { step: 0, steps: STEPS, selection: { goal: "muscle", level: "beginner", equipment: "gym", weeklyDays: 3, sessionLengthMinutes: 40 } },
  choose(event) { const step = STEPS[this.data.step]; this.setData({ [`selection.${step.key}`]: event.currentTarget.dataset.value }); },
  changeDays(event) { this.setData({ "selection.weeklyDays": Number(event.detail.value) }); },
  changeMinutes(event) { this.setData({ "selection.sessionLengthMinutes": Number(event.detail.value) }); },
  next() { if (this.data.step < 3) this.setData({ step: this.data.step + 1 }); else this.finish(); },
  back() { if (this.data.step > 0) this.setData({ step: this.data.step - 1 }); },
  async finish() {
    const profile = { ...this.data.selection, completedAt: new Date().toISOString(), weightUnit: "kg" };
    api.store.saveProfile(profile); wx.setStorageSync("oneset_onboarding_seen", true);
    try { await api.request("/api/profile", { method: "PUT", data: { trainingGoal: profile.goal, level: profile.level, equipment: profile.equipment === "home_gym" ? "dumbbell" : profile.equipment, weeklyDays: profile.weeklyDays, session_length_minutes: profile.sessionLengthMinutes } }); } catch (_) {}
    api.track("onboarding_completed", { goal: profile.goal, level: profile.level });
    wx.reLaunch({ url: "/pages/today/index" });
  },
});

const api = require("../../shared/api");

const labels = { muscle: "增肌", fatloss: "减脂", strength: "力量", general: "保持健康", beginner: "新手", intermediate: "有一些经验", advanced: "进阶", gym: "商业健身房", home_gym: "家庭健身房", dumbbell: "哑铃", bodyweight: "徒手" };

Page({
  data: { profile: null, labels, connected: false, exporting: false },
  onShow() { const app = getApp(); this.setData({ profile: api.store.getProfile(), connected: Boolean(app.globalData.sessionToken) }); },
  editOnboarding() { wx.navigateTo({ url: "/pages/onboarding/index" }); },
  exportData() {
    this.setData({ exporting: true });
    const payload = { exportedAt: new Date().toISOString(), profile: api.store.getProfile(), plans: api.store.getPlans(), workouts: api.store.getWorkouts() };
    wx.setClipboardData({ data: JSON.stringify(payload, null, 2), success: () => { this.setData({ exporting: false }); wx.showToast({ title: "数据已复制", icon: "success" }); }, fail: () => this.setData({ exporting: false }) });
  },
  clearData() {
    wx.showModal({ title: "删除本机数据？", content: "这会删除本机的训练、计划和偏好。云端账号数据不会在此操作中删除。", confirmText: "删除", confirmColor: "#b7351b", success: result => { if (!result.confirm) return; ["oneset_mp_profile", "oneset_mp_active_workout", "oneset_mp_completed_sets", "oneset_mp_workouts", "oneset_mp_plans", "oneset_onboarding_seen"].forEach(key => wx.removeStorageSync(key)); this.setData({ profile: null }); } });
  },
});

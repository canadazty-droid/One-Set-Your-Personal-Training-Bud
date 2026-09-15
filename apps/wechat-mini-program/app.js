const api = require("./shared/api");

App({
  globalData: {
    apiBaseUrl: "https://lianyixia-ai-workout.canadazty.chatgpt.site",
    user: null,
    sessionToken: "",
    offlineMode: false,
  },
  onLaunch() {
    this.globalData.sessionToken = wx.getStorageSync("oneset_session_token") || "";
    this.globalData.user = wx.getStorageSync("oneset_user") || null;
    api.bootstrapSession(this);
  },
});

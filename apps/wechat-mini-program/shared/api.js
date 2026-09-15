const store = require("./store");
const domain = require("./workout-domain");

function appState() { return getApp(); }
function request(path, options) {
  const app = appState();
  return new Promise((resolve, reject) => wx.request({
    url: `${app.globalData.apiBaseUrl}${path}`,
    method: options?.method || "GET",
    data: options?.data,
    timeout: 8000,
    header: { "content-type": "application/json", ...(app.globalData.sessionToken ? { authorization: `Bearer ${app.globalData.sessionToken}` } : {}) },
    success: result => result.statusCode >= 200 && result.statusCode < 300 ? resolve(result.data) : reject(new Error(result.data?.error || `请求失败 ${result.statusCode}`)),
    fail: reject,
  }));
}

function bootstrapSession(app) {
  if (app.globalData.sessionToken) return Promise.resolve(app.globalData.user);
  return new Promise(resolve => wx.login({
    success: login => wx.request({
      url: `${app.globalData.apiBaseUrl}/api/auth/wechat`, method: "POST", data: { code: login.code },
      success: response => {
        if (response.statusCode === 200 && response.data?.token) {
          app.globalData.sessionToken = response.data.token; app.globalData.user = response.data.user;
          wx.setStorageSync("oneset_session_token", response.data.token); wx.setStorageSync("oneset_user", response.data.user);
        } else { app.globalData.offlineMode = true; }
        resolve(app.globalData.user);
      },
      fail: () => { app.globalData.offlineMode = true; resolve(null); },
    }),
    fail: () => { app.globalData.offlineMode = true; resolve(null); },
  }));
}

async function generateWorkout(rawInput) {
  const intent = domain.parseWorkoutIntent(rawInput);
  try { const data = await request("/api/mini/workout/generate", { method: "POST", data: { input: rawInput, intent } }); return data.workout; }
  catch (_) { return domain.generateWorkoutFromIntent(intent, store.getProfile() || {}, Date.now()); }
}

async function logSet(payload) {
  try { return await request("/api/workouts", { method: "POST", data: { action: "log_set", source: "mini_program", ...payload } }); }
  catch (_) { return { workoutId: payload.workoutId, set: { ...payload, source: "mini_program", completedAt: new Date().toISOString() } }; }
}

async function startWorkout(payload) {
  try { return await request("/api/workouts", { method: "POST", data: { action: "start_workout", source: "mini_program", ...payload } }); }
  catch (_) { return { workoutId: payload.workoutId, status: "in_progress", startedAt: payload.startedAt || Date.now() }; }
}

async function completeWorkout(workoutId, duration) {
  try { return await request("/api/workouts", { method: "POST", data: { action: "complete_workout", workoutId, duration } }); }
  catch (_) { return null; }
}

async function getWorkouts() { try { return (await request("/api/workouts", {})).workouts || []; } catch (_) { return store.getWorkouts(); } }
async function saveImportedPlan(plan) {
  const local = { ...plan, id: plan.id || `plan-${Date.now()}`, createdAt: new Date().toISOString(), source: "imported_plan" };
  store.savePlan(local);
  try { await request("/api/plans", { method: "POST", data: { name: local.name, days: [{ dayLabel: "导入", dayOfWeek: new Date().getDay(), name: local.name, focus: "full", exercises: local.exercises.map(item => ({ exerciseId: item.exerciseId, name: item.name, sets: item.sets, repsMin: item.repsMin, repsMax: item.repsMax, restSeconds: item.restSeconds })) }], activate: true } }); } catch (_) {}
  return local;
}
function track(eventName, metadata) { request("/api/product-events", { method: "POST", data: { eventName, sessionId: wx.getStorageSync("oneset_event_session") || `mp-${Date.now()}`, source: "mini_program", metadata: metadata || {} } }).catch(() => {}); }

module.exports = { bootstrapSession, generateWorkout, startWorkout, logSet, completeWorkout, getWorkouts, saveImportedPlan, track, request, domain, store };

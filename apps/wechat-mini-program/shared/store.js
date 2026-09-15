const KEYS = {
  profile: "oneset_mp_profile",
  activeWorkout: "oneset_mp_active_workout",
  completedSets: "oneset_mp_completed_sets",
  workouts: "oneset_mp_workouts",
  plans: "oneset_mp_plans",
};

function get(key, fallback) { try { return wx.getStorageSync(KEYS[key]) || fallback; } catch (_) { return fallback; } }
function set(key, value) { wx.setStorageSync(KEYS[key], value); return value; }
function getProfile() { return get("profile", null); }
function saveProfile(profile) { return set("profile", profile); }
function getActiveWorkout() { return get("activeWorkout", null); }
function saveActiveWorkout(workout) { return set("activeWorkout", workout); }
function getCompletedSets() { return get("completedSets", []); }
function saveCompletedSets(sets) { return set("completedSets", sets); }
function clearActiveWorkout() { wx.removeStorageSync(KEYS.activeWorkout); wx.removeStorageSync(KEYS.completedSets); }
function getWorkouts() { return get("workouts", []); }
function saveWorkout(workout) { const all = getWorkouts().filter(item => item.id !== workout.id); all.unshift(workout); return set("workouts", all.slice(0, 200)); }
function getPlans() { return get("plans", []); }
function savePlan(plan) { const all = getPlans().filter(item => item.id !== plan.id); all.unshift(plan); return set("plans", all.slice(0, 30)); }

module.exports = { getProfile, saveProfile, getActiveWorkout, saveActiveWorkout, getCompletedSets, saveCompletedSets, clearActiveWorkout, getWorkouts, saveWorkout, getPlans, savePlan };

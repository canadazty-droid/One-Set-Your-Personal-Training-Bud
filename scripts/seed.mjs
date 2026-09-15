const base = (process.env.FORM_API_URL || "http://localhost:3000").replace(/\/$/, "");
const user = process.env.FORM_DEV_USER || "demo@oneset.local";
const headers = { "content-type": "application/json", "x-form-dev-user": user };
async function call(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data;
}
await call("/api/profile", "PUT", { displayName: "Demo Athlete", gender: "prefer not to say", age: 32, height_cm: 172, weight_kg: 70, trainingGoal: "muscle", level: "beginner", weeklyDays: 3, session_length_minutes: 45, equipment: "gym", injuries_or_limitations: "none", preferred_training_style: "simple hypertrophy" });
await call("/api/plans/generate", "POST", {});
for (const [daysAgo, energy, soreness] of [[5, 7, 4], [3, 8, 3], [1, 7, 5]]) {
  const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
  await call("/api/workouts", "POST", { date, focus: "full", duration: 45, perceived_difficulty: 7, energy_level: energy, soreness_level: soreness, notes: "Seed workout", performances: [{ exerciseId: "Goblet_Squat", setNumber: 1, weightKg: 16, reps: 10 }, { exerciseId: "Goblet_Squat", setNumber: 2, weightKg: 16, reps: 10 }] });
}
console.log(`Seeded ONE SET Fitness OS for ${user}`);

#!/usr/bin/env node
/** Form CLI - developer interface for the same backend as MCP and the app. */
const API_URL = (process.env.FORM_API_URL || "http://localhost:3000").replace(/\/$/, "");
const DEV_USER = process.env.FORM_DEV_USER || process.env.FORM_DEV_EMAIL || "dev@form.local";
const API_TOKEN = process.env.FORM_API_TOKEN || "";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(API_TOKEN ? { authorization: `Bearer ${API_TOKEN}` } : { "x-form-dev-user": DEV_USER }),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data.error || data.raw || `HTTP ${response.status}`);
  return data;
}

function parseArgs(argv) {
  const args = { flags: {}, positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { args.flags[key] = next; i += 1; }
      else args.flags[key] = true;
    } else args.positional.push(token);
  }
  return args;
}

function printJson(value) { console.log(JSON.stringify(value, null, 2)); }

const commandHelp = {
  "create-user": "fitness-cli create-user --name Paul --gender male --age 35 --height 178 --weight 80 --goal muscle_gain --experience intermediate --days 4 --minutes 50 --equipment gym --style hypertrophy [--injuries none]",
  "generate-plan": "fitness-cli generate-plan\nGenerates and saves a new deterministic four-week plan from the current profile.",
  "log-workout": "fitness-cli log-workout --exercise \"Bench Press\" --sets 4 --reps 8 --weight 80 --difficulty 8 --energy 7 --soreness 3 [--notes text]\nfitness-cli log-workout --missed --notes \"Travel day\"",
  "weekly-review": "fitness-cli weekly-review [--end YYYY-MM-DD]\nCalculates completion, energy, soreness, risks, and the next adjustment.",
  "adjust-plan": "fitness-cli adjust-plan\nCreates a new plan version from the current weekly review and preserves history.",
  "list-plans": "fitness-cli list-plans\nLists saved versions and marks the active plan with *.",
  "list-logs": "fitness-cli list-logs\nLists completed and missed workout logs as structured JSON.",
};

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [group, command, ...rest] = positional;
  if (flags.help && group && commandHelp[group]) { console.log(commandHelp[group]); return; }
  if (group === "create-user") {
    const required = ["name", "gender", "age", "height", "weight", "goal", "experience", "days", "minutes", "equipment", "style"];
    const missing = required.filter(key => flags[key] === undefined || flags[key] === "");
    if (missing.length) throw new Error(`Missing required options: ${missing.map(key => `--${key}`).join(", ")}`);
    printJson(await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({
        displayName: flags.name, gender: flags.gender, age: Number(flags.age), height_cm: Number(flags.height), weight_kg: Number(flags.weight),
        trainingGoal: flags.goal === "fat_loss" ? "fatloss" : flags.goal === "muscle_gain" ? "muscle" : flags.goal === "recomposition" ? "general" : flags.goal,
        level: flags.experience, weeklyDays: Number(flags.days), session_length_minutes: Number(flags.minutes), equipment: flags.equipment,
        injuries_or_limitations: flags.injuries || "none", preferred_training_style: flags.style,
      }),
    }));
    return;
  }
  if (group === "auth" && command === "status") {
    try { const profile = await api("/api/profile"); printJson({ authenticated: true, user: profile.profile?.email || DEV_USER, method: API_TOKEN ? "token" : "development" }); }
    catch { printJson({ authenticated: false, method: API_TOKEN ? "token" : "none" }); process.exitCode = 1; }
    return;
  }
  if (group === "generate-plan") { printJson(await api("/api/plans/generate", { method: "POST", body: "{}" })); return; }
  if (group === "weekly-review") { printJson(await api(`/api/review${flags.end ? `?weekEnd=${encodeURIComponent(flags.end)}` : ""}`)); return; }
  if (group === "adjust-plan") { printJson(await api("/api/plans/adjust", { method: "POST", body: "{}" })); return; }
  if (group === "list-plans") {
    const data = await api("/api/plans");
    for (const plan of data.plans || []) console.log(`${plan.active ? "*" : " "} v${plan.planVersion || 1} | ${plan.name} | ${plan.startDate || "unscheduled"} → ${plan.endDate || ""}`);
    return;
  }
  if (group === "list-logs") {
    const data = await api("/api/workouts?all=1");
    printJson(data.workouts || []);
    return;
  }
  if (group === "log-workout") {
    const exercise = String(flags.exercise || "");
    const sets = Number(flags.sets); const reps = Number(flags.reps); const weightKg = Number(flags.weight || 0);
    const completed = flags.missed !== true;
    if (completed && (!exercise || !Number.isFinite(sets) || !Number.isFinite(reps))) throw new Error("--exercise, --sets and --reps are required unless --missed is used");
    const performances = completed ? Array.from({ length: Math.max(1, Math.round(sets)) }, (_, index) => ({ exerciseId: exercise, setNumber: index + 1, weightKg, reps })) : [];
    printJson(await api("/api/workouts", { method: "POST", body: JSON.stringify({
      date: flags.date, completed, focus: flags.focus || "full", duration: Number(flags.minutes || 45),
      perceived_difficulty: Number(flags.difficulty || 5), energy_level: Number(flags.energy || 5), soreness_level: Number(flags.soreness || 5),
      notes: flags.notes || "", rating: flags.rating || "right", source: "cli", performances: performances.map(item => ({ ...item, source: "cli" })),
    }) }));
    return;
  }
  if (group === "workout" && command === "create") {
    printJson(await api("/api/workouts", { method: "POST", body: JSON.stringify({ action: "start_workout", focus: flags.focus || "full", planId: flags.plan, source: "cli" }) }));
    return;
  }
  if (group === "workout" && command === "log") {
    const exercise = String(flags.exercise || rest[0] || ""); const weightKg = Number(flags.weight || 0); const reps = Number(flags.reps);
    if (!exercise || !Number.isFinite(reps)) throw new Error("--exercise and --reps are required");
    printJson(await api("/api/workouts", { method: "POST", body: JSON.stringify({ action: "log_set", workoutId: flags.workout, exerciseId: exercise, setNumber: Number(flags.set || 1), weightKg, reps, source: "cli" }) }));
    return;
  }
  if (group === "workout" && command === "today") {
    const data = await api(`/api/plans/today?day=${new Date().getDay()}`);
    if (!data.today) { console.log("No active plan saved yet. Ask ChatGPT to create one with create_workout_plan."); return; }
    console.log(`${data.today.dayLabel} - ${data.today.dayName}`);
    for (const exercise of data.today.exercises) console.log(`  ${exercise.name}: ${exercise.sets} x ${exercise.repsMin}-${exercise.repsMax}`);
    return;
  }
  if ((group === "workouts" || group === "workout") && command === "list") {
    const data = await api("/api/workouts");
    for (const workout of data.workouts || []) console.log(`${workout.date.slice(0, 10)} | ${workout.focus} | ${workout.sets} sets | ${Math.round(workout.totalVolume)} kg volume`);
    return;
  }
  if (group === "plans" && command === "list") {
    const data = await api("/api/plans");
    for (const plan of data.plans || []) console.log(`${plan.active ? "*" : " "} ${plan.name} (${plan.id.slice(0, 8)})`);
    return;
  }
  if (group === "profile") { printJson(await api("/api/profile")); return; }
  if (group === "prs") {
    const data = await api("/api/personal-records");
    for (const record of data.records || []) console.log(`${record.name}: ${record.weightKg} kg x ${record.reps} (${record.date.slice(0, 10)})`);
    return;
  }
  if (group === "history" || (group === "exercise" && command === "history")) {
    const exercise = group === "exercise" ? rest[0] || flags.exercise : rest[0] || command || flags.exercise;
    const query = exercise ? `?exercise=${encodeURIComponent(exercise)}` : "";
    const data = await api(`/api/exercise-history${query}`);
    printJson(data.history || []);
    return;
  }
  if (group === "log") {
    const exercise = command;
    if (!exercise) throw new Error("Usage: form log bench --weight 185 --reps 8");
    const weightLb = Number(flags.weight || flags.w);
    const reps = Number(flags.reps || flags.r);
    if (!Number.isFinite(weightLb) || !Number.isFinite(reps)) throw new Error("--weight and --reps are required");
    printJson(await api("/api/workouts", {
      method: "POST",
      body: JSON.stringify({ action: "log_set", exerciseId: exercise, setNumber: Number(flags.set || 1), weightLb, reps, source: "cli" }),
    }));
    return;
  }
  console.log(`fitness-cli · ONE SET Fitness OS

Usage:
  fitness-cli create-user --name Paul --gender male --age 35 --height 178 --weight 80 --goal muscle_gain --experience intermediate --days 4 --minutes 50 --equipment gym --style hypertrophy [--injuries none]
  fitness-cli generate-plan
  fitness-cli log-workout --exercise Goblet_Squat --sets 3 --reps 10 --weight 20 --difficulty 7 --energy 8 --soreness 3
  fitness-cli log-workout --missed --notes "Travel day"
  fitness-cli weekly-review [--end 2026-08-19]
  fitness-cli adjust-plan
  fitness-cli list-plans
  fitness-cli list-logs

Legacy developer aliases:
  node cli/form.mjs workout today
  node cli/form.mjs workouts list
  node cli/form.mjs plans list
  node cli/form.mjs profile
  node cli/form.mjs prs
  node cli/form.mjs history squat
  node cli/form.mjs log bench --weight 185 --reps 8

Env:
  FORM_API_URL=${API_URL}
  FORM_DEV_USER=${DEV_USER}
  FORM_API_TOKEN=${API_TOKEN ? "configured" : "not configured"}`);
}

main().catch(error => { console.error(error.message || error); process.exit(1); });

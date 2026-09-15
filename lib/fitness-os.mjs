const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const LIBRARY = {
  gym: {
    full: ["Goblet Squat", "Dumbbell Bench Press", "Seated Cable Row", "Dumbbell Romanian Deadlift", "Cable Pallof Press"],
    upper: ["Dumbbell Bench Press", "Neutral-Grip Lat Pulldown", "Seated Dumbbell Press", "Seated Cable Row", "Cable Biceps Curl", "Rope Triceps Pushdown"],
    lower: ["Goblet Squat", "Dumbbell Romanian Deadlift", "Leg Press", "Seated Leg Curl", "Standing Calf Raise", "Dead Bug"],
    push: ["Dumbbell Bench Press", "Incline Dumbbell Press", "Seated Dumbbell Press", "Cable Crossover", "Lateral Raise", "Rope Triceps Pushdown"],
    pull: ["Neutral-Grip Lat Pulldown", "Seated Cable Row", "Chest-Supported Dumbbell Row", "Face Pull", "Dumbbell Biceps Curl", "Suitcase Carry"],
  },
  dumbbell: {
    full: ["Goblet Squat", "Dumbbell Floor Press", "One-Arm Dumbbell Row", "Dumbbell Romanian Deadlift", "Dead Bug"],
    upper: ["Dumbbell Floor Press", "One-Arm Dumbbell Row", "Seated Dumbbell Press", "Chest-Supported Dumbbell Row", "Dumbbell Biceps Curl"],
    lower: ["Goblet Squat", "Dumbbell Romanian Deadlift", "Supported Reverse Lunge", "Dumbbell Step Up", "Single-Leg Glute Bridge"],
    push: ["Dumbbell Floor Press", "Incline Dumbbell Press", "Seated Dumbbell Press", "Lateral Raise", "Dumbbell Triceps Extension"],
    pull: ["One-Arm Dumbbell Row", "Chest-Supported Dumbbell Row", "Dumbbell Pullover", "Dumbbell Biceps Curl", "Suitcase Carry"],
  },
  bodyweight: {
    full: ["Bodyweight Box Squat", "Incline Push-Up", "Supported Reverse Lunge", "Bird Dog", "Dead Bug"],
    upper: ["Incline Push-Up", "Kneeling Push-Up", "Band-Assisted Pull-Up", "Wall Slide", "Bird Dog"],
    lower: ["Bodyweight Box Squat", "Supported Split Squat", "Glute Bridge", "Low Step-Up", "Wall Sit"],
    push: ["Wall Push-Up", "Incline Push-Up", "Kneeling Push-Up", "Wall Slide", "Plank"],
    pull: ["Band-Assisted Pull-Up", "Towel Row", "Reverse Snow Angel", "Bird Dog", "Suitcase Carry"],
  },
};

const SPLITS = {
  2: ["full", "full"],
  3: ["full", "upper", "lower"],
  4: ["upper", "lower", "push", "pull"],
  5: ["push", "pull", "lower", "upper", "full"],
  6: ["push", "pull", "lower", "push", "pull", "lower"],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const dateOnly = date => new Date(date).toISOString().slice(0, 10);

export function normalizeFitnessProfile(input = {}) {
  const requiredText = ["name", "gender", "goal", "training_experience", "available_equipment", "preferred_training_style"];
  const missing = requiredText.filter(key => typeof input[key] !== "string" || !input[key].trim());
  const numeric = ["age", "height_cm", "weight_kg", "weekly_training_days", "session_length_minutes"];
  missing.push(...numeric.filter(key => !Number.isFinite(Number(input[key]))));
  if (missing.length) throw new Error(`Missing or invalid profile fields: ${[...new Set(missing)].join(", ")}`);
  return {
    name: input.name.trim().slice(0, 80),
    gender: input.gender.trim().slice(0, 40),
    age: Math.round(clamp(input.age, 13, 100)),
    height_cm: clamp(input.height_cm, 100, 250),
    weight_kg: clamp(input.weight_kg, 30, 350),
    goal: ["fat_loss", "muscle_gain", "strength", "recomposition"].includes(input.goal) ? input.goal : "recomposition",
    training_experience: ["beginner", "intermediate", "advanced"].includes(input.training_experience) ? input.training_experience : "beginner",
    weekly_training_days: Math.round(clamp(input.weekly_training_days, 2, 6)),
    session_length_minutes: Math.round(clamp(input.session_length_minutes, 20, 120)),
    available_equipment: ["gym", "dumbbell", "bodyweight"].includes(input.available_equipment) ? input.available_equipment : "bodyweight",
    injuries_or_limitations: String(input.injuries_or_limitations || "none").trim().slice(0, 500),
    preferred_training_style: input.preferred_training_style.trim().slice(0, 80),
  };
}

function prescription(profile, weekNumber, exerciseIndex) {
  const level = profile.training_experience;
  const goal = profile.goal;
  let sets = level === "beginner" ? 2 : level === "advanced" ? 4 : 3;
  let reps = goal === "strength" ? "4-6" : goal === "fat_loss" ? "10-15" : "8-12";
  let rest = goal === "strength" ? 120 : goal === "fat_loss" ? 45 : 75;
  if (exerciseIndex >= 4) sets = Math.max(2, sets - 1);
  if (weekNumber === 2) reps = goal === "strength" ? "5-6" : goal === "fat_loss" ? "12-15" : "9-12";
  if (weekNumber === 3 && exerciseIndex < 3) sets += 1;
  if (weekNumber === 4) {
    sets = Math.max(2, sets - 1);
    rest += 15;
  }
  return { sets, reps, rest_seconds: rest };
}

function selectExerciseNames(profile, focus, maxExercises) {
  const library = LIBRARY[profile.available_equipment];
  let names = [...library[focus]];
  if (profile.goal === "strength" && profile.available_equipment === "gym") {
    const strengthLead = { full: "Barbell Back Squat", upper: "Barbell Bench Press", lower: "Barbell Back Squat", push: "Barbell Bench Press", pull: "Barbell Deadlift" };
    names = [strengthLead[focus], ...names.filter(name => name !== strengthLead[focus])];
  }
  names = names.slice(0, maxExercises);
  if (profile.goal === "fat_loss") names.push(profile.available_equipment === "gym" ? "Air Bike" : "Low-Impact March");
  return names;
}

export function generateFourWeekPlan(profileInput, options = {}) {
  const profile = normalizeFitnessProfile(profileInput);
  const start = new Date(options.startDate || Date.now());
  start.setUTCHours(0, 0, 0, 0);
  const dayOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - dayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 27);
  const split = SPLITS[profile.weekly_training_days];
  const maxExercises = profile.session_length_minutes <= 35 ? 4 : profile.session_length_minutes <= 55 ? 5 : 6;
  const weeks = Array.from({ length: 4 }, (_, weekIndex) => ({
    week_number: weekIndex + 1,
    emphasis: weekIndex === 0 ? "Learn and establish baseline" : weekIndex === 1 ? "Add controlled repetitions" : weekIndex === 2 ? "Peak training volume" : "Deload and consolidate technique",
    days: split.map((focus, dayIndex) => ({
      day_number: dayIndex + 1,
      day_of_week: dayIndex + 1,
      day_label: DAY_NAMES[dayIndex],
      focus_area: focus,
      notes: weekIndex === 3 ? "Keep 3-4 reps in reserve and prioritize clean technique." : "Finish each working set with 2-3 good reps still available.",
      exercises: selectExerciseNames(profile, focus, maxExercises).map((name, exerciseIndex) => ({
        name,
        ...prescription(profile, weekIndex + 1, exerciseIndex),
        notes: exerciseIndex === 0 ? "Warm up first; stop if pain changes your movement." : "Use a controlled range you can repeat.",
      })),
    })),
  }));
  return {
    plan_version: Math.max(1, Math.round(Number(options.version) || 1)),
    start_date: dateOnly(start),
    end_date: dateOnly(end),
    goal: profile.goal,
    weekly_training_days: profile.weekly_training_days,
    adjustment_reason: String(options.adjustmentReason || "Initial rule-based plan from onboarding profile"),
    weeks,
  };
}

export function buildWeeklyReview(logs = [], scheduledWorkoutCount = 0, options = {}) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  const completed = safeLogs.filter(log => log.completed !== false);
  const scheduled = Math.max(1, Math.round(Number(scheduledWorkoutCount) || safeLogs.length || 1));
  const average = key => completed.length ? Math.round((completed.reduce((sum, log) => sum + clamp(log[key] ?? 5, 1, 10), 0) / completed.length) * 10) / 10 : 0;
  const completionRate = Math.min(100, Math.round(completed.length / scheduled * 100));
  const averageEnergy = average("energy_level");
  const averageSoreness = average("soreness_level");
  const riskFlags = [];
  let adjustment = "maintain";
  if (completionRate < 60) { riskFlags.push("low_completion"); adjustment = "reduce_volume_15"; }
  if (averageSoreness > 7) { riskFlags.push("high_soreness"); adjustment = "reduce_intensity_and_add_recovery"; }
  if (averageEnergy > 0 && averageEnergy < 5) riskFlags.push("low_energy");
  if (completionRate >= 85 && averageSoreness > 0 && averageSoreness < 6 && averageEnergy >= 5) adjustment = "increase_volume_5";
  const best = [...completed].sort((a, b) => Number(b.completed_exercises || b.actual_sets || 0) - Number(a.completed_exercises || a.actual_sets || 0))[0];
  return {
    week_start: options.weekStart || null,
    week_end: options.weekEnd || null,
    completion_rate: completionRate,
    average_energy: averageEnergy,
    average_soreness: averageSoreness,
    missed_workouts: Math.max(0, scheduled - completed.length),
    best_performed_day: best?.workout_date || best?.date || null,
    risk_flags: riskFlags,
    next_week_adjustment: adjustment,
  };
}

export function adjustPlanVersion(plan, review) {
  if (!plan?.weeks?.length) throw new Error("A valid plan with weeks is required");
  const action = review?.next_week_adjustment || "maintain";
  const factor = action === "reduce_volume_15" ? 0.85 : action === "reduce_intensity_and_add_recovery" ? 0.8 : action === "increase_volume_5" ? 1.05 : 1;
  const reschedule = Number(review?.missed_workouts) >= 2;
  const rescheduledDays = [1, 3, 5, 6, 2, 4];
  const adjustedWeeks = plan.weeks.map(week => ({
    ...week,
    days: week.days.map((day, dayIndex) => ({
      ...day,
      day_of_week: reschedule ? rescheduledDays[dayIndex] : day.day_of_week,
      notes: reschedule ? `${day.notes} Rescheduled to create more recovery space after missed sessions.` : day.notes,
      exercises: day.exercises.map(exercise => ({
        ...exercise,
        sets: action === "increase_volume_5" && day.exercises.indexOf(exercise) < 2 ? exercise.sets + 1 : Math.max(1, Math.round(exercise.sets * factor)),
        rest_seconds: action === "reduce_intensity_and_add_recovery" ? exercise.rest_seconds + 30 : exercise.rest_seconds,
      })),
    })),
  }));
  const start = new Date(`${plan.end_date}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 27);
  return {
    ...plan,
    plan_version: Math.max(1, Number(plan.plan_version) || 1) + 1,
    start_date: dateOnly(start),
    end_date: dateOnly(end),
    adjustment_reason: action,
    weeks: adjustedWeeks,
  };
}

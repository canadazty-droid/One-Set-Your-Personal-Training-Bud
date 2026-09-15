import { generateFourWeekPlan } from "../fitness-os.mjs";

export function generateVersionBTrainingPlan(profile, options = {}) {
  const plan = generateFourWeekPlan(profile, options);
  const lowEnergy = Number(profile.current_energy_level) <= 4;
  const highSoreness = Number(profile.current_soreness_level) >= 8;
  const level = profile.training_experience;
  for (const week of plan.weeks) {
    for (const day of week.days) {
      day.estimated_minutes = profile.session_length_minutes;
      for (const exercise of day.exercises) {
        exercise.difficulty = level === "beginner" ? "easy" : level === "advanced" ? "hard" : "medium";
      }
    }
  }
  if (lowEnergy || highSoreness) {
    for (const day of plan.weeks[0].days) {
      day.exercises = day.exercises.slice(0, Math.max(3, day.exercises.length - 1)).map(exercise => ({ ...exercise, sets: Math.max(1, exercise.sets - 1), difficulty: "easy" }));
      day.notes = highSoreness
        ? `Readiness adjustment: soreness ${profile.current_soreness_level}/10; reduced first-week volume.`
        : `Readiness adjustment: energy ${profile.current_energy_level}/10; reduced first-week volume.`;
    }
    plan.adjustment_reason = highSoreness ? `Initial soreness ${profile.current_soreness_level}/10` : `Initial energy ${profile.current_energy_level}/10`;
  }
  return plan;
}

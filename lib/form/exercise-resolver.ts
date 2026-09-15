import { exerciseLibrary } from "../../app/exercise-data";

const aliasMap: Record<string, string> = {
  "bench press": "Dumbbell_Bench_Press",
  "barbell bench press": "Dumbbell_Bench_Press",
  "db bench press": "Dumbbell_Bench_Press",
  "dumbbell bench press": "Dumbbell_Bench_Press",
  "incline db press": "Incline_Dumbbell_Press",
  "incline dumbbell press": "Incline_Dumbbell_Press",
  "incline press": "Incline_Dumbbell_Press",
  "cable fly": "Dumbbell_Flyes",
  "cable flyes": "Dumbbell_Flyes",
  "dumbbell fly": "Dumbbell_Flyes",
  "lateral raise": "Side_Lateral_Raise",
  "side lateral raise": "Side_Lateral_Raise",
  "squat": "Bodyweight_Squat",
  "back squat": "Bodyweight_Squat",
  "goblet squat": "Goblet_Squat",
  "romanian deadlift": "Romanian_Deadlift",
  "rdl": "Romanian_Deadlift",
  "deadlift": "Kettlebell_Deadlift",
  "pull up": "Band_Assisted_Pull-Up",
  "pull-up": "Band_Assisted_Pull-Up",
  "lat pulldown": "Full_Range-Of-Motion_Lat_Pulldown",
  "row": "Seated_Cable_Rows",
  "cable row": "Seated_Cable_Rows",
  "dumbbell row": "One-Arm_Dumbbell_Row",
  "overhead press": "Seated_Dumbbell_Press",
  "shoulder press": "Machine_Shoulder_Press",
  "push up": "Pushups",
  "push-up": "Pushups",
  "pushups": "Pushups",
  "plank": "Plank",
  "hip thrust": "Barbell_Hip_Thrust",
  "leg press": "Leg_Press",
  "leg curl": "Seated_Leg_Curl",
  "calf raise": "Standing_Calf_Raises",
  "bicep curl": "Dumbbell_Bicep_Curl",
  "tricep pushdown": "Triceps_Pushdown_-_Rope_Attachment",
  "face pull": "Face_Pull",
};

const byId = new Map(exerciseLibrary.map(exercise => [exercise.id, exercise]));

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function resolveExerciseId(nameOrId: string, equipment?: string): string | null {
  const raw = nameOrId.trim();
  if (byId.has(raw)) return raw;

  const normalized = normalizeName(raw);
  if (aliasMap[normalized]) return aliasMap[normalized];

  for (const exercise of exerciseLibrary) {
    if (normalizeName(exercise.id.replace(/_/g, " ")) === normalized) return exercise.id;
    if (normalizeName(exercise.en) === normalized) return exercise.id;
    if (normalizeName(exercise.zh) === normalized) return exercise.id;
  }

  const fuzzy = exerciseLibrary.find(exercise => {
    const en = normalizeName(exercise.en);
    return en.includes(normalized) || normalized.includes(en);
  });
  if (fuzzy) return fuzzy.id;

  if (equipment === "dumbbell") {
    const dumbbell = exerciseLibrary.find(exercise =>
      exercise.gear === "dumbbell" && normalizeName(exercise.en).includes(normalized.split(" ").slice(-1)[0] || normalized),
    );
    if (dumbbell) return dumbbell.id;
  }

  return null;
}

export function parseRepRange(value: unknown, fallback = { min: 8, max: 12 }) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const reps = Math.round(value);
    return { min: reps, max: reps };
  }
  if (typeof value !== "string") return fallback;
  const match = value.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (match) {
    const min = Math.max(1, Number(match[1]));
    const max = Math.max(min, Number(match[2]));
    return { min, max };
  }
  const single = value.match(/\d+/);
  if (single) {
    const reps = Math.max(1, Number(single[0]));
    return { min: reps, max: reps };
  }
  return fallback;
}

export function getExerciseName(exerciseId: string) {
  return byId.get(exerciseId)?.en ?? exerciseId.replace(/_/g, " ");
}

export function listExerciseCatalog() {
  return exerciseLibrary.map(exercise => ({
    id: exercise.id,
    en: exercise.en,
    zh: exercise.zh,
    gear: exercise.gear,
    body: exercise.body,
  }));
}

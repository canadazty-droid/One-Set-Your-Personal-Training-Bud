export type ExerciseTutorial = {
  src: string;
  poster: string;
  durationSeconds: number;
  author: string;
  provider: "wger" | "Your Move" | "Wikimedia Commons";
  sourceUrl: string;
  license: "CC BY 3.0" | "CC BY-SA 4.0" | "Royalty-free commercial use";
  licenseUrl: string;
  processingNoteZh: string;
  processingNoteEn: string;
};

const wger = (videoId: number, durationSeconds: number): ExerciseTutorial => ({
  src: `/exercises/tutorials/wger-${videoId}.mp4`,
  poster: `/exercises/tutorials/wger-${videoId}.jpg`,
  durationSeconds,
  author: "Goulart",
  provider: "wger",
  sourceUrl: `https://wger.de/api/v2/video/${videoId}/`,
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  processingNoteZh: "已转码并移除设备与位置资料",
  processingNoteEn: "Transcoded; device and location metadata removed",
});

const yourMove = (slug: string, durationSeconds = 12): ExerciseTutorial => ({
  src: `/exercises/tutorials/ymove-${slug}.mp4`,
  poster: `/exercises/tutorials/ymove-${slug}.jpg`,
  durationSeconds,
  author: "Your Move B.V.",
  provider: "Your Move",
  sourceUrl: "https://ymove.app/free-exercise-videos",
  license: "Royalty-free commercial use",
  licenseUrl: "https://ymove.app/free-exercise-videos#licence",
  processingNoteZh: "720p 真人示范 · 允许用于商业 App · 不可单独转售素材",
  processingNoteEn: "720p real-person demo · commercial app use allowed · no standalone resale",
});

const commons = (
  slug: string,
  title: string,
  durationSeconds: number,
  author: string,
  license: "CC BY 3.0" | "CC BY-SA 4.0",
): ExerciseTutorial => ({
  src: `/exercises/tutorials/commons-${slug}.mp4`,
  poster: `/exercises/tutorials/commons-${slug}.jpg`,
  durationSeconds,
  author,
  provider: "Wikimedia Commons",
  sourceUrl: `https://commons.wikimedia.org/wiki/${title.replaceAll(" ", "_")}`,
  license,
  licenseUrl: license === "CC BY 3.0"
    ? "https://creativecommons.org/licenses/by/3.0/"
    : "https://creativecommons.org/licenses/by-sa/4.0/",
  processingNoteZh: "已静音并转码为手机兼容 H.264；保留原作者与许可信息",
  processingNoteEn: "Muted and transcoded to mobile-compatible H.264; author and license retained",
});

const tutorials: Record<string, ExerciseTutorial> = {
  Seated_Cable_Rows: yourMove("seated-cable-row-neutral-grip"),
  Romanian_Deadlift: wger(2, 13),
  Side_Lateral_Raise: yourMove("dumbbell-lateral-raise"),
  Machine_Shoulder_Press: wger(11, 12.27),
  Seated_Dumbbell_Press: wger(12, 12.27),
  Seated_Calf_Raise: wger(13, 12),
  Standing_Calf_Raise_Machine: wger(14, 16.79),
  Dumbbell_Bench_Press: wger(17, 14.16),
  "Barbell_Bench_Press_-_Medium_Grip": yourMove("barbell-bench-press"),
  Incline_Dumbbell_Press: wger(24, 27.49),
  Dumbbell_Lunges: wger(31, 17.09),
  Lying_Leg_Curls: yourMove("lying-leg-curl"),
  Seated_Leg_Curl: wger(37, 12),
  Leg_Press: wger(44, 34.69),
  Dumbbell_Bicep_Curl: wger(48, 10.94),
  Cable_Biceps_Curl: wger(50, 12),
  Hammer_Curls: yourMove("hammer-curls"),
  Cable_Rope_Overhead_Triceps_Extension: yourMove("overhead-cable-rope-extension"),
  Cable_One_Arm_Tricep_Extension: wger(58, 12),
  "Dips_-_Triceps_Version": wger(66, 10.17),
  Pullups: wger(71, 18.77),
  Barbell_Hip_Thrust: wger(72, 30.19),
  Machine_Hip_Adduction: wger(74, 12),
  Face_Pull: wger(79, 8.57),
  "One-Arm_Dumbbell_Row": yourMove("single-arm-dumbbell-row"),
  Goblet_Squat: yourMove("kettlebell-goblet-squat"),
  Dumbbell_Goblet_Squat: yourMove("dumbbell-goblet-squat"),
  Kettlebell_Swing: yourMove("kettlebell-swing"),
  Kettlebell_Push_Press: yourMove("kettlebell-push-press"),
  Kettlebell_Romanian_Deadlift: yourMove("kettlebell-romanian-deadlift"),
  "Neutral-Grip_Lat_Pulldown": yourMove("lat-pulldown-v-grip"),
  Leg_Extensions: yourMove("leg-extension"),
  Reverse_Pec_Deck: yourMove("machine-reverse-fly"),
  Cable_Wood_Chop: yourMove("cable-woodchop-high-to-low"),
  Pec_Deck_Fly: yourMove("pec-deck-fly"),
  Incline_Machine_Press: yourMove("incline-machine-press"),
  Cable_Tricep_Pushdown: yourMove("cable-tricep-pushdown"),
  Machine_Bicep_Curl: yourMove("machine-bicep-curl"),
  High_Cable_Curl: yourMove("high-cable-curl"),
  Hack_Squat: yourMove("hack-squat"),
  Glute_Kickback_Machine: yourMove("glute-kickback-machine"),
  Barbell_Deadlift: yourMove("barbell-deadlift"),
  Barbell_Full_Squat: yourMove("barbell-back-squat"),
  Bent_Over_Barbell_Row: commons("bent-over-row", "File:Bent-over row - exercise demonstration video.webm", 5.2, "FitnessScape", "CC BY 3.0"),
  Hanging_Knee_Raise: commons("hanging-crunches", "File:Hanging crunches - exercise demonstration video.webm", 5.8, "FitnessScape", "CC BY 3.0"),
  Hanging_Leg_Raise: commons("leg-raises", "File:Leg raises - exercise demonstration video.webm", 3.8, "FitnessScape", "CC BY 3.0"),
  Kettlebell_Suitcase_Carry: commons("kettlebell-farmer-walks", "File:Kettlebell Farmer Walks.webm", 20.4, "Taco fleur", "CC BY-SA 4.0"),
};

export function getExerciseTutorial(exerciseId: string) {
  return tutorials[exerciseId] ?? null;
}

export const licensedTutorialCount = Object.keys(tutorials).length;

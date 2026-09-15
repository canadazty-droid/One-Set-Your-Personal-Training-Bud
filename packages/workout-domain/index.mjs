const EXERCISES = {
  chest: [
    { id: "barbell_bench_press", name: "杠铃卧推", sets: 4, reps: "6-8", restSeconds: 120 },
    { id: "incline_dumbbell_press", name: "上斜哑铃卧推", sets: 3, reps: "8-10", restSeconds: 90 },
    { id: "cable_fly", name: "绳索夹胸", sets: 3, reps: "12-15", restSeconds: 60 },
  ],
  back: [
    { id: "lat_pulldown", name: "高位下拉", sets: 4, reps: "8-10", restSeconds: 90 },
    { id: "seated_cable_row", name: "坐姿划船", sets: 3, reps: "8-12", restSeconds: 90 },
    { id: "face_pull", name: "面拉", sets: 3, reps: "12-15", restSeconds: 60 },
  ],
  shoulders: [
    { id: "dumbbell_shoulder_press", name: "哑铃肩推", sets: 3, reps: "8-10", restSeconds: 90 },
    { id: "lateral_raise", name: "侧平举", sets: 4, reps: "12-15", restSeconds: 60 },
  ],
  biceps: [
    { id: "dumbbell_curl", name: "哑铃弯举", sets: 3, reps: "10-12", restSeconds: 60 },
    { id: "hammer_curl", name: "锤式弯举", sets: 3, reps: "10-12", restSeconds: 60 },
  ],
  triceps: [
    { id: "rope_pushdown", name: "绳索下压", sets: 3, reps: "10-12", restSeconds: 60 },
    { id: "overhead_triceps_extension", name: "过顶臂屈伸", sets: 3, reps: "10-12", restSeconds: 60 },
  ],
  legs: [
    { id: "goblet_squat", name: "高脚杯深蹲", sets: 4, reps: "8-10", restSeconds: 120 },
    { id: "romanian_deadlift", name: "罗马尼亚硬拉", sets: 3, reps: "8-10", restSeconds: 120 },
    { id: "split_squat", name: "分腿蹲", sets: 3, reps: "8-10 / 侧", restSeconds: 90 },
    { id: "calf_raise", name: "提踵", sets: 3, reps: "12-15", restSeconds: 60 },
  ],
  core: [
    { id: "dead_bug", name: "死虫", sets: 3, reps: "8-10 / 侧", restSeconds: 45 },
    { id: "plank", name: "平板支撑", sets: 3, reps: "30-45 秒", restSeconds: 45 },
    { id: "pallof_press", name: "帕洛夫推", sets: 3, reps: "10-12 / 侧", restSeconds: 45 },
  ],
};

const GROUP_LABELS = { chest: "胸", back: "背", shoulders: "肩", biceps: "二头", triceps: "三头", legs: "腿", core: "核心", full_body: "全身" };

const EXERCISE_ALIASES = [
  [/(卧推|bench(?: press)?)/i, "barbell_bench_press", "杠铃卧推"],
  [/(上斜哑铃|incline dumbbell)/i, "incline_dumbbell_press", "上斜哑铃卧推"],
  [/(飞鸟|夹胸|cable fly)/i, "cable_fly", "绳索夹胸"],
  [/(侧平举|lateral raise)/i, "lateral_raise", "侧平举"],
  [/(高位下拉|下拉|lat pulldown)/i, "lat_pulldown", "高位下拉"],
  [/(划船|row)/i, "seated_cable_row", "坐姿划船"],
  [/(深蹲|squat)/i, "goblet_squat", "深蹲"],
  [/(硬拉|deadlift)/i, "romanian_deadlift", "硬拉"],
  [/(弯举|curl)/i, "dumbbell_curl", "哑铃弯举"],
  [/(下压|pushdown)/i, "rope_pushdown", "绳索下压"],
  [/(平板|plank)/i, "plank", "平板支撑"],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
const unique = values => [...new Set(values)];

export function parseWorkoutIntent(rawInput = "") {
  const raw = String(rawInput).trim();
  const durationMatch = raw.match(/(\d{1,3})\s*(?:分钟|min(?:ute)?s?)/i);
  const rules = [
    [/(胸|chest)/i, "chest"], [/(背|back)/i, "back"], [/(肩|shoulder)/i, "shoulders"],
    [/(二头|biceps?)/i, "biceps"], [/(三头|triceps?)/i, "triceps"], [/(腿|下肢|legs?)/i, "legs"],
    [/(核心|腹|core|abs?)/i, "core"], [/(全身|full.?body)/i, "full_body"],
  ];
  let muscleGroups = rules.filter(([pattern]) => pattern.test(raw)).map(([, value]) => value);
  if (muscleGroups.includes("full_body")) muscleGroups = ["full_body"];
  const excludedExercises = EXERCISE_ALIASES
    .filter(([pattern]) => new RegExp(`(?:不要|排除|避免|no\\s+)${pattern.source}`, pattern.flags).test(raw))
    .map(([, id]) => id);
  const energy = /(累|疲劳|没精神|tired|low.?energy)/i.test(raw) ? "low" : /(状态好|精力好|energetic)/i.test(raw) ? "high" : "normal";
  const intensity = /(轻量|恢复|light)/i.test(raw) || energy === "low" ? "light" : /(高强度|hard|heavy)/i.test(raw) ? "hard" : "normal";
  return {
    rawInput: raw,
    durationMinutes: durationMatch ? clamp(durationMatch[1], 10, 120) : undefined,
    muscleGroups: unique(muscleGroups),
    energy,
    intensity,
    excludedExercises: unique(excludedExercises),
  };
}

function groupsForIntent(groups) {
  if (!groups?.length || groups.includes("full_body")) return ["chest", "back", "legs", "core"];
  return groups;
}

export function generateWorkoutFromIntent(intent = {}, profile = {}, seed = Date.now()) {
  const durationMinutes = clamp(intent.durationMinutes || profile.sessionLengthMinutes || 40, 10, 120);
  const selectedGroups = groupsForIntent(intent.muscleGroups);
  const excluded = new Set(intent.excludedExercises || []);
  const candidates = selectedGroups.flatMap((group, groupIndex) => (EXERCISES[group] || []).map((exercise, index) => ({ ...exercise, group, rank: index * selectedGroups.length + groupIndex })));
  const rotated = candidates.length ? candidates.slice(seed % candidates.length).concat(candidates.slice(0, seed % candidates.length)) : [];
  const exerciseLimit = intent.intensity === "light" ? Math.max(3, Math.floor(durationMinutes / 12)) : Math.max(3, Math.min(7, Math.floor(durationMinutes / 9)));
  const chosen = rotated.filter(exercise => !excluded.has(exercise.id)).sort((a, b) => a.rank - b.rank).slice(0, exerciseLimit);
  const intensity = intent.intensity || "normal";
  const exercises = chosen.map((exercise, index) => ({
    ...exercise,
    order: index + 1,
    sets: intensity === "light" ? Math.max(2, exercise.sets - 1) : intensity === "hard" ? exercise.sets + (index < 2 ? 1 : 0) : exercise.sets,
  }));
  const focusLabel = selectedGroups.map(group => GROUP_LABELS[group] || group).join(" + ");
  return {
    id: cryptoRandomId(),
    name: `${focusLabel || "全身"}训练`,
    focusArea: selectedGroups.join(","),
    durationMinutes,
    intensity,
    source: "mini_program",
    exercises,
    adjustmentReason: intensity === "light" ? "已根据你的精力和强度要求减少训练容量。" : "已根据训练部位、时间与器械生成。",
  };
}

function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `oneset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveExercise(rawName) {
  const normalized = rawName.trim();
  const match = EXERCISE_ALIASES.find(([pattern]) => pattern.test(normalized));
  return match ? { exerciseId: match[1], name: match[2], confidence: "high" } : { exerciseId: `custom_${normalized.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")}`, name: normalized, confidence: "low" };
}

export function parseImportedPlan(rawInput = "") {
  const raw = String(rawInput).trim();
  const chunks = raw.split(/[\n,，;；]+/).map(value => value.trim()).filter(Boolean);
  const exercises = [];
  for (const chunk of chunks) {
    const prescription = chunk.match(/(.+?)\s*(\d{1,2})\s*[×xX*]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/);
    if (!prescription) continue;
    const resolved = resolveExercise(prescription[1]);
    exercises.push({ ...resolved, sets: clamp(prescription[2], 1, 20), repsMin: clamp(prescription[3], 1, 500), repsMax: clamp(prescription[4] || prescription[3], 1, 500), restSeconds: 90 });
  }
  return { name: chunks[0] && !/\d\s*[×xX*]/.test(chunks[0]) ? chunks[0] : "导入训练", exercises, confidence: exercises.length ? (exercises.some(item => item.confidence === "low") ? "medium" : "high") : "low", warnings: exercises.length ? [] : ["未识别到“动作 + 组数 × 次数”，请检查格式。"] };
}

export function parseNaturalLanguageLog(rawInput = "") {
  const chunks = String(rawInput).split(/[\n,，;；。]+/).map(value => value.trim()).filter(Boolean);
  const entries = [];
  const warnings = [];
  for (const chunk of chunks) {
    const resolved = resolveExercise(chunk);
    const weightMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(?:公斤|kg|千克)/i);
    const setsMatch = chunk.match(/([一二三四五六七八九十\d]{1,3})\s*(?:组|sets?)/i);
    const repeatedReps = chunk.match(/(?:公斤|kg|千克)\s*((?:\d{1,3}\s+){1,10}\d{1,3})/i);
    const repMatch = chunk.match(/(\d{1,3})\s*(?:个|次|reps?)/i);
    let reps = repeatedReps ? repeatedReps[1].trim().split(/\s+/).map(Number) : [];
    if (!reps.length && repMatch && setsMatch) reps = Array.from({ length: clamp(parseChineseCount(setsMatch[1]), 1, 20) }, () => clamp(repMatch[1], 1, 500));
    if (!weightMatch || !reps.length) {
      warnings.push(`“${chunk}”信息不完整，请补充重量和次数。`);
      continue;
    }
    entries.push({ ...resolved, weightKg: clamp(weightMatch[1], 0, 1000), reps, setCount: reps.length, source: "natural_language_log" });
  }
  return { entries, warnings, confidence: warnings.length ? "low" : entries.length ? "high" : "low" };
}

function parseChineseCount(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [left, right] = value.split("十");
    return (digits[left] || 1) * 10 + (digits[right] || 0);
  }
  return digits[value] || Number(value) || 0;
}

export function summarizeCompletedWorkout(workout, completedSets = [], previousVolume = 0) {
  const totalVolumeKg = Math.round(completedSets.reduce((sum, set) => sum + (Number(set.weightKg) || 0) * (Number(set.reps) || 0), 0) * 10) / 10;
  const uniqueExercises = new Set(completedSets.map(set => set.exerciseId)).size;
  return {
    workoutId: workout.id,
    durationMinutes: Math.max(1, Math.round((Date.now() - Number(workout.startedAt || Date.now())) / 60000)),
    setCount: completedSets.length,
    exerciseCount: uniqueExercises,
    totalVolumeKg,
    changePercent: previousVolume > 0 ? Math.round(((totalVolumeKg - previousVolume) / previousVolume) * 100) : null,
  };
}

export { EXERCISES, GROUP_LABELS };

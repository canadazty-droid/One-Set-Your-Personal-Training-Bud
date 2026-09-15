const focusRules = [
  ["chest", /胸|胸部|chest|pecs?/i],
  ["back", /背|背部|back|lats?/i],
  ["legs", /腿|腿部|下肢|臀|legs?|lower body|glutes?/i],
  ["shoulders", /肩|肩部|shoulders?|delts?/i],
  ["arms", /手臂|二头|三头|arms?|biceps?|triceps?/i],
  ["core", /核心|腹肌|腹部|core|abs?/i],
  ["full_body", /全身|全身性|full[ -]?body|whole[ -]?body/i],
];

const exerciseRules = [
  ["squat", /深蹲|squats?/i],
  ["deadlift", /硬拉|deadlifts?/i],
  ["push-up", /俯卧撑|push[ -]?ups?/i],
  ["bench press", /卧推|bench press/i],
  ["lunge", /弓步|lunges?/i],
  ["running", /跑步|慢跑|running|jogging/i],
];

export function parseWorkoutInput(input = "") {
  const rawInput = String(input).trim();
  const durationMatch = rawInput.match(/(\d{1,3})\s*(?:分钟|分|min(?:ute)?s?)/i);
  const durationMinutes = durationMatch ? Math.max(15, Math.min(90, Number(durationMatch[1]))) : undefined;
  const detectedFocusAreas = focusRules.filter(([, pattern]) => pattern.test(rawInput)).map(([focus]) => focus);
  const focusAreas = detectedFocusAreas.length ? [...new Set(detectedFocusAreas)] : ["full_body"];
  const low = /累|疲惫|疲劳|没精神|恢复|轻量|轻松|tired|fatigued|low energy|light|recovery/i.test(rawInput);
  const hard = /高强度|挑战|大重量|hard|intense|heavy/i.test(rawInput);
  const excludedExercises = exerciseRules
    .filter(([, pattern]) => new RegExp(`(?:不要|避开|不做|without|no|avoid).{0,10}(?:${pattern.source})`, "i").test(rawInput))
    .map(([exercise]) => exercise);
  return {
    ...(durationMinutes ? { durationMinutes } : {}),
    focusAreas,
    ...(low || hard ? { intensity: low ? "light" : "hard" } : {}),
    ...(excludedExercises.length ? { excludedExercises } : {}),
    rawInput,
  };
}

export function mapFocusAreas(focusAreas = [], fallback = "full") {
  const areas = new Set(focusAreas);
  if (areas.has("full_body")) return "full";
  if (areas.has("chest") && areas.has("back")) return "pushpull";
  if (areas.has("legs")) return "lower";
  if (areas.has("core") && areas.size === 1) return "core";
  if (["chest", "back", "shoulders", "arms"].some(area => areas.has(area))) return "upper";
  return fallback;
}

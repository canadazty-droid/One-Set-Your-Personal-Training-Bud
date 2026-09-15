import { mapFocusAreas, parseWorkoutInput } from "../lib/training/input-parser.mjs";

export function parseWorkoutRequest(input,fallback){
  const normalized=input.toLowerCase().replace(/[，。！？、]/g," ").replace(/\s+/g," ").trim();
  const request=parseWorkoutInput(input);
  let duration=fallback.duration;
  const numericDuration=normalized.match(/(\d{1,3})\s*(?:分钟|min(?:ute)?s?)/);
  const wordDurations=[[/七十五|seventy[- ]five/,75],[/六十|sixty/,60],[/四十五|forty[- ]five/,45],[/三十|thirty/,30],[/二十五|twenty[- ]five/,25],[/二十|twenty/,20],[/十五|fifteen/,15]];
  if(numericDuration)duration=Number(numericDuration[1]);
  else{const wordDuration=wordDurations.find(([pattern])=>pattern.test(normalized));if(wordDuration)duration=wordDuration[1];}
  duration=Math.max(15,Math.min(75,Math.round(duration/5)*5));

  let focus=fallback.focus;
  if(/全身|全身性|full body|whole body/.test(normalized))focus="full";
  else if(/下肢|腿部?|臀部?|lower body|legs?|glutes?/.test(normalized))focus="lower";
  else if(/核心|腹部?|腹肌|core|abs?|abdominal/.test(normalized))focus="core";
  else if(/胸背|胸部?|背部?|推拉|chest|back|push.?pull/.test(normalized))focus="pushpull";
  else if(/上肢|肩部?|手臂|upper body|shoulders?|arms?/.test(normalized))focus="upper";

  let equipment=fallback.equipment;
  if(/徒手|无器械|不需要器械|家里|自重|bodyweight|no equipment|without equipment|at home|home workout/.test(normalized))equipment="bodyweight";
  else if(/哑铃|dumbbells?/.test(normalized))equipment="dumbbell";
  else if(/健身房|器械房|固定器械|绳索|gym|machines?|cables?/.test(normalized))equipment="gym";

  let level=fallback.level;
  if(/第一次|零基础|新手|初学|beginner|first workout|new to/.test(normalized))level="beginner";
  else if(/高级|高阶|advanced|experienced/.test(normalized))level="advanced";
  else if(/中级|进阶|intermediate/.test(normalized))level="intermediate";

  let goal=fallback.goal||"general";
  if(/增肌|肌肉增长|长肌肉|hypertrophy|build muscle|muscle build(?:ing)?|muscle gain/.test(normalized))goal="muscle";
  else if(/减脂|燃脂|塑形|fat loss|lose fat|fat burn|conditioning/.test(normalized))goal="fatloss";
  else if(/力量|变强|strength|get stronger|build strength/.test(normalized))goal="strength";
  else if(/综合体能|保持健康|general fitness|keep fit/.test(normalized))goal="general";

  if(request.durationMinutes)duration=Math.max(15,Math.min(75,request.durationMinutes));
  const explicitStructuredFocus=request.focusAreas?.some(area=>area!=="full_body")||/全身|全身性|full body|whole body/.test(normalized);
  if(request.focusAreas?.length&&explicitStructuredFocus)focus=mapFocusAreas(request.focusAreas,focus);
  return {duration,focus,equipment,level,goal,...(request.intensity?{intensity:request.intensity}:{}),...(request.excludedExercises?.length?{excludedExercises:request.excludedExercises}:{}),understood:Boolean(normalized)};
}

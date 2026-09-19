"use client";

import { FormEvent, SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BodyPart, diversifyExerciseIds, exerciseLibrary, Gear, LibraryExercise, movementPatternForExercise, workoutPlans } from "./exercise-data";
import { exerciseDatasetSource, getExerciseDatasetEnrichment } from "./exercise-dataset-enrichment";
import { CatalogExerciseDetail, CatalogExerciseIndex, EXERCISE_CATALOG_COUNT, EXERCISE_CATALOG_INDEX_URL, exerciseCatalogDetailUrl } from "./exercise-catalog";
import { buildTempoGuide, starterLoadRule } from "./exercise-coaching.mjs";
import { exerciseTargetForDuration, personalizePlan, matchesAvailableEquipment } from "./plan-personalizer.mjs";
import { parseWorkoutRequest } from "./request-parser.mjs";
import { formatCountdown, isPendingWorkout, isSessionDraft, SESSION_STORAGE_KEY, shouldRunWorkoutClock, validSetInput, setTargetLabel, workoutMeasurements } from "./session-utils.mjs";
import FormScanner from "./form-scanner";
import PhotoScanner from "./photo-scanner";
import {loadSyncedScans,readScanRecords,syncPendingScans} from "./scan-sync.mjs";
import {buildCorrectiveExerciseIds} from "./corrective-plan.mjs";
import {getProductSession,trackProductEvent} from "./product-events.mjs";
import {CORRECTION_CYCLE_EVENT,correctionCycleState,readCorrectionCycle,recordCorrectionWorkout,startCorrectionCycle} from "./correction-cycle.mjs";
import {shareWorkoutSummary} from "./share-card.mjs";
import {adjustNextWorkout,describeAdjustment,recentAdjustmentLogs} from "../lib/training/adjustment-rules.mjs";
import {buildSevenDayReview} from "../lib/training/weekly-review.mjs";
import {trainingRecords,isTestWorkout} from "../lib/training/record-quality.mjs";
import {estimateWorkoutMinutes} from "../lib/training/duration-estimate.mjs";
import ExternalTutorial,{hasExternalTutorial} from "./external-tutorial";
import {DEFAULT_USER_ID,getLogsForLast7Days,getTodayLog,getWorkoutLogs,readPendingWorkoutPayloads,saveWorkoutLog,writePendingWorkoutPayloads,isCurrentPendingWorkout,remainingPendingWorkouts,type WorkoutLog as StoredWorkoutLog} from "../lib/storage/log-store";
import {clearUserProfile,getUserProfile,saveUserProfile} from "../lib/storage/userStore";
import {getFourWeekPlan,getReadinessProfile} from "../lib/storage/planStore";
import {hasSeenWelcome,markWelcomeSeen} from "../lib/storage/userStore";
import StartScreen from "./start-screen";
import {clearActiveWorkout,getActiveWorkout,getGeneratedWorkout,saveActiveWorkout,saveGeneratedWorkout} from "../lib/storage/workoutStore";
import {generateWorkout,type GeneratedWorkout} from "../lib/training/workoutGenerator";
import {AppIcon,type AppIconName} from "./ui-icons";
import {getExerciseTutorial} from "./exercise-tutorials";
import {appDateKey,formatFullAppDate,formatShortAppDate,isSameAppDay,isInLast7AppDays} from "../lib/date/app-date.mjs";

type Language = "zh" | "en";
type Tab = "today" | "plan" | "library" | "progress" | "profile";
type Focus = "full" | "upper" | "lower" | "pushpull" | "core";
type LowerTarget = "glutes" | "quads" | "hamstrings";
type UpperTarget = "biceps" | "triceps" | "lats" | "upperBack";
type CoreTarget = "abs" | "stability";
type SpecificTarget = LowerTarget | UpperTarget | CoreTarget;
type LibraryTarget = SpecificTarget | "all";
type BuildArea = BodyPart | SpecificTarget;
type Equipment = "gym" | "dumbbell" | "bodyweight";
type Level = "beginner" | "intermediate" | "advanced";
type Sheet = "builder" | "exercise" | "onboarding" | "warmup" | "profile" | "integration" | "data" | "feedback" | "scan" | "posture" | null;
type MovementSkill = "push" | "squat" | "hinge" | "pull" | "core";
type TrainingGoal = "strength" | "muscle" | "fatloss" | "general";
type SessionRating = "easy" | "right" | "hard" | "pain";
type WorkoutFeedbackInput = {completed:boolean;difficulty:number;energy:number;soreness:number;notes:string};
type LibraryType = "all" | "favorites" | "beginner" | "intermediate" | "mobility";
type LibraryLayer = "ready" | "catalog";
type BuilderMode = "quick" | "advanced";
type Experience = "new" | "some" | "regular" | "advanced";
type Recovery = "low" | "normal" | "high";
type PainArea = "knees" | "shoulders" | "back" | "hips";
type CorrectionSource = "form" | "posture";
type AdvancedProfile = {experience:Experience;weeklyDays:number;recovery:Recovery;painAreas:PainArea[];heightCm:string;weightKg:string;notes:string};
type SyncedAdvancedProfile = Omit<AdvancedProfile,"notes">;
type SetPerformance = { exerciseId:string; setNumber:number; weightKg:number; reps:number };
type WorkoutLog = { id:string; date:string; focus:Focus; duration:number; exercises:number; sets:number; totalVolume:number; rating:SessionRating; performances:SetPerformance[]; completed?:boolean; perceivedDifficulty?:number|null; energyLevel?:number|null; sorenessLevel?:number|null; notes?:string; pending?:boolean };
type PersonalBestHighlight = {exerciseId:string;performance:SetPerformance;kind:"weight"|"reps";delta:number};
type ExerciseStats = { sessions:number; lastDate:string; latest:SetPerformance|null; best:SetPerformance|null; lastRating:SessionRating };
type PlanPersonalization = { favoritesUsed:number; painSwaps:number; historyAware:boolean; targetCount:number; advanced:boolean; weeklyDays?:number; targetArea?:BuildArea; correctionSource?:CorrectionSource; correctionMetrics?:string[]; aiSaved?:boolean; planName?:string; dayName?:string; focusExerciseId?:string; adjustmentReason?:string; intensity?:"light"|"normal"|"hard" };
type SavedPlanExercise = { exerciseId:string; name:string; sets:number; repsMin:number; repsMax:number; weightKg?:number|null };
type TodaySession = { planId:string; planName:string; dayLabel:string; dayName:string; focus:Focus; exercises:SavedPlanExercise[]; isRestDay?:boolean; daysUntil?:number };
type SetInput = { weight:string; reps:string };
type SyncState = "loading" | "synced" | "saving" | "offline" | "error" | "local";
type SessionDraft = {version:1;savedAt:number;planIds:string[];setCounts?:number[];activeWorkoutId?:string;duration:number;focus:Focus;equipment:Equipment;level:Level;goal:TrainingGoal;noviceMode:boolean;exerciseIndex:number;setIndex:number;seconds:number;restRemaining:number;setInputs:Record<string,SetInput>;completed:Record<string,boolean>};

const text = {
  zh: {
    tabs: ["今日", "训练", "动作", "进度", "我的"], greeting: "你好", subtitle: "用 AI 规划，在练一下训练。",
    today: "今日概览", recovery: "恢复状态", fresh: "状态良好", readiness: "身体准备度", weekly: "本周活动", workouts: "训练", volume: "训练容量", streak: "连续训练",
    plan: "今日训练", made: "ONE SET · 来自 ChatGPT 的计划", start: "开始今日训练", adjust: "调整训练", duration: "时长", focus: "训练部位", equipment: "训练器械", level: "难度",
    full: "全身", upper: "上肢", lower: "下肢", pushpull: "胸部与背部", core: "核心", gym: "健身房", dumbbell: "哑铃", bodyweight: "徒手",
    beginner: "入门", intermediate: "进阶", advanced: "高阶", voice: "点击说出今天想练什么", type: "也可以手动输入，例如：45 分钟下肢训练…", generate: "生成新计划",
    exercises: "个动作", sets: "组", rest: "休息", warmup: "动态热身", warmupSub: "5 分钟 · 激活关节与目标肌群", edit: "替换", details: "动作要领",
    library: "动作库", search: "搜索动作、肌群或器械", all: "全部", progress: "训练进度", history: "最近训练", strength: "力量趋势", goal: "本周目标", completed: "已完成",
    profile: "个人中心", settings: "训练偏好", goalLabel: "主要目标", goalValue: "增强力量与体型", gymLabel: "默认场地", language: "语言", integrations: "数据与设备", notifications: "训练提醒",
    workout: "训练中", set: "组数", previous: "上次", kg: "重量 kg", reps: "次数", done: "完成", next: "下一组", nextMove: "下一个动作", finish: "完成训练", elapsed: "已训练", pause: "暂停", end: "退出",
    technique: "动作拆解", cues: "关键要点", mistake: "常见错误", alternatives: "可替换动作", muscles: "目标肌群", tempo: "节奏", source: "部分真人动作示范来自 wger，并在页面内逐条署名；其余动作使用 Free Exercise DB 或 ONE SET 定制分步预览。",
    newWorkout:"生成新训练", beginnerMode:"新手保护模式", beginnerDesc:"自动选择更容易掌握的动作、保守组数与充分休息", abilityCheck:"30 秒能力评估", tooHard:"这个动作太难", howTo:"动作教学", why:"为什么安排它", easier:"换成更简单", feedback:"完成后感觉", regenerate:"重新生成", firstPlan:"生成我的第一套训练",
  },
  en: {
    tabs: ["Today", "Workout", "Exercises", "Progress", "Profile"], greeting: "Hello", subtitle: "Plan with AI. Train with ONE SET.",
    today: "Today", recovery: "Recovery", fresh: "Ready to train", readiness: "Body readiness", weekly: "This week", workouts: "Workouts", volume: "Volume", streak: "Day streak",
    plan: "Today’s workout", made: "ONE SET · SAVED FROM CHATGPT", start: "Start today’s workout", adjust: "Adjust workout", duration: "Duration", focus: "Target area", equipment: "Equipment", level: "Level",
    full: "Full body", upper: "Upper body", lower: "Lower body", pushpull: "Chest & back", core: "Core", gym: "Full gym", dumbbell: "Dumbbells", bodyweight: "Bodyweight",
    beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", voice: "Tap and tell me what you want", type: "Or type: 45 min lower-body workout…", generate: "Generate new plan",
    exercises: "exercises", sets: "sets", rest: "rest", warmup: "Dynamic warm-up", warmupSub: "5 min · Prime joints and target muscles", edit: "Swap", details: "Technique",
    library: "Exercise library", search: "Search movement, muscle or equipment", all: "All", progress: "Progress", history: "Recent workouts", strength: "Strength trend", goal: "Weekly goal", completed: "complete",
    profile: "Profile", settings: "Workout preferences", goalLabel: "Primary goal", goalValue: "Strength & definition", gymLabel: "Default location", language: "Language", integrations: "Data & devices", notifications: "Workout reminders",
    workout: "Workout", set: "Set", previous: "Previous", kg: "Weight kg", reps: "Reps", done: "Done", next: "Next set", nextMove: "Next exercise", finish: "Finish workout", elapsed: "Elapsed", pause: "Pause", end: "Exit",
    technique: "Movement steps", cues: "Key cues", mistake: "Common mistake", alternatives: "Alternatives", muscles: "Target muscles", tempo: "Tempo", source: "Selected real-movement demos are sourced from wger with per-video attribution; remaining movements use Free Exercise DB or custom ONE SET step previews.",
    newWorkout:"Generate workout", beginnerMode:"Beginner protection", beginnerDesc:"Simpler movement patterns, conservative sets and more recovery", abilityCheck:"30-sec ability check", tooHard:"This feels too hard", howTo:"How to", why:"Why this move", easier:"Choose easier", feedback:"How did it feel?", regenerate:"Regenerate", firstPlan:"Build my first workout",
  },
} as const;

const primaryNavigation:{id:Tab;icon:AppIconName;copyIndex:number}[]=[{id:"today",icon:"today",copyIndex:0},{id:"plan",icon:"workout",copyIndex:1},{id:"library",icon:"library",copyIndex:2},{id:"progress",icon:"progress",copyIndex:3},{id:"profile",icon:"profile",copyIndex:4}];
const focusIconNames:Record<Focus,AppIconName>={full:"full-body",upper:"upper-body",lower:"lower-body",pushpull:"push-pull",core:"core"};
const bodyNames = { zh: { lower:"下肢",chest:"胸部",back:"背部",shoulders:"肩部",arms:"手臂",core:"核心" }, en: { lower:"Lower",chest:"Chest",back:"Back",shoulders:"Shoulders",arms:"Arms",core:"Core" } };
const buildAreaNames:Record<Language,Record<BuildArea,string>>={
  zh:{lower:"下肢",chest:"胸部",back:"背部",shoulders:"肩部",arms:"手臂",core:"核心",glutes:"臀部",quads:"股四头",hamstrings:"后侧链",biceps:"二头",triceps:"三头",lats:"背阔肌",upperBack:"上背",abs:"腹肌",stability:"稳定核心"},
  en:{lower:"Lower body",chest:"Chest",back:"Back",shoulders:"Shoulders",arms:"Arms",core:"Core",glutes:"Glutes",quads:"Quads",hamstrings:"Hamstrings",biceps:"Biceps",triceps:"Triceps",lats:"Lats",upperBack:"Upper back",abs:"Abs",stability:"Core stability"},
};
const gearNames = { zh: { bodyweight:"徒手",dumbbell:"哑铃",barbell:"杠铃",kettlebell:"壶铃",cable:"绳索",machine:"固定器械" }, en: { bodyweight:"Bodyweight",dumbbell:"Dumbbell",barbell:"Barbell",kettlebell:"Kettlebell",cable:"Cable",machine:"Machine" } };
const stopSignals:Record<Language,Record<BodyPart,string>>={
  zh:{lower:"膝、髋或腰部出现尖锐疼痛，或单侧突然失去力量。",chest:"肩前侧、手腕或手肘出现尖锐疼痛，或胸口异常不适。",back:"肩部或腰部出现尖锐疼痛，或手臂麻木。",shoulders:"肩关节出现夹痛、麻木，或已经无法控制下放。",arms:"手肘或手腕出现尖锐疼痛、麻木，或握力突然下降。",core:"腰背或颈部疼痛、眩晕，或无法保持正常呼吸。"},
  en:{lower:"Stop for sharp knee, hip, or back pain, or a sudden loss of strength on one side.",chest:"Stop for sharp front-shoulder, wrist, or elbow pain, or unusual chest discomfort.",back:"Stop for sharp shoulder or back pain, or numbness into the arm.",shoulders:"Stop for pinching, numbness, or when you can no longer control the lowering phase.",arms:"Stop for sharp elbow or wrist pain, numbness, or a sudden loss of grip.",core:"Stop for back or neck pain, dizziness, or if you cannot breathe normally."}
};
const ids = Object.fromEntries(exerciseLibrary.map(x => [x.id, x]));
const lowerTargetMatchers:Record<LowerTarget,(exercise:LibraryExercise)=>boolean>={
  glutes:exercise=>/glute|bridge|hip.thrust|hip.abduction|pull-through|clamshell/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
  quads:exercise=>/squat|lunge|step.up|leg.press|leg.extension|wall.sit/i.test(`${exercise.id} ${exercise.primaryEn}`),
  hamstrings:exercise=>/romanian|deadlift|leg.curl|good.morning/i.test(`${exercise.id} ${exercise.primaryEn}`),
};
const isLowerTarget=(area:BuildArea|undefined):area is LowerTarget=>area==="glutes"||area==="quads"||area==="hamstrings";
const specificTargetMatchers:Record<Exclude<SpecificTarget,LowerTarget>,(exercise:LibraryExercise)=>boolean>={
  biceps:exercise=>/bicep|curl/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
  triceps:exercise=>/tricep|pushdown|dip|extension/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
  lats:exercise=>/lat|pulldown|pull-up|pullup|straight-arm/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
  upperBack:exercise=>/row|rear.delt|face.pull|shrug|middle.back|traps/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
  abs:exercise=>/crunch|russian|air.bike|oblique/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
  stability:exercise=>/plank|pallof|bird.dog|dead.bug|carry|side.plank/i.test(`${exercise.id} ${exercise.primaryEn} ${exercise.secondaryEn}`),
};
const isSpecificTarget=(area:BuildArea|undefined):area is SpecificTarget=>isLowerTarget(area)||area==="biceps"||area==="triceps"||area==="lats"||area==="upperBack"||area==="abs"||area==="stability";
const matchesSpecificTarget=(exercise:LibraryExercise,target:LibraryTarget)=>target==="all"||(isLowerTarget(target)?lowerTargetMatchers[target](exercise):specificTargetMatchers[target](exercise));
const mobilityIds = new Set(["Cat-Cow","90-90_Hip_Switch","Half-Kneeling_Hip-Flexor_Mobilization","Half-Kneeling_Ankle_Rock"]);
const defaultAdvancedProfile:AdvancedProfile={experience:"new",weeklyDays:3,recovery:"normal",painAreas:[],heightCm:"",weightKg:"",notes:""};
const syncedAdvancedProfile=(profile:AdvancedProfile):SyncedAdvancedProfile=>({experience:profile.experience,weeklyDays:profile.weeklyDays,recovery:profile.recovery,painAreas:profile.painAreas,heightCm:profile.heightCm,weightKg:profile.weightKg});
const hasAdvancedPersonalization=(profile:AdvancedProfile)=>profile.experience!==defaultAdvancedProfile.experience||profile.weeklyDays!==defaultAdvancedProfile.weeklyDays||profile.recovery!==defaultAdvancedProfile.recovery||profile.painAreas.length>0||Boolean(profile.heightCm)||Boolean(profile.weightKg)||Boolean(profile.notes.trim());
const normalizeSyncedAdvancedProfile=(profile:Partial<SyncedAdvancedProfile>):SyncedAdvancedProfile=>({
  experience:["new","some","regular","advanced"].includes(profile.experience||"")?profile.experience as Experience:defaultAdvancedProfile.experience,
  weeklyDays:typeof profile.weeklyDays==="number"&&profile.weeklyDays>=1&&profile.weeklyDays<=7?Math.round(profile.weeklyDays):defaultAdvancedProfile.weeklyDays,
  recovery:["low","normal","high"].includes(profile.recovery||"")?profile.recovery as Recovery:defaultAdvancedProfile.recovery,
  painAreas:Array.isArray(profile.painAreas)?[...new Set(profile.painAreas.filter(area=>["knees","shoulders","back","hips"].includes(area)))].slice(0,4) as PainArea[]:[],
  heightCm:typeof profile.heightCm==="string"?profile.heightCm.slice(0,8):"",
  weightKg:typeof profile.weightKg==="string"?profile.weightKg.slice(0,8):"",
});
const painAreaExclusions:Record<PainArea,string[]>={
  knees:["Bodyweight_Box_Squat","Bodyweight_Squat","Goblet_Squat","Dumbbell_Lunges","Supported_Split_Squat","Supported_Reverse_Lunge","Supported_Low_Step-Up","Dumbbell_Step_Ups","Leg_Press","Leg_Extensions"],
  shoulders:["Wall_Push-Up","Kneeling_Push-Up","Incline_Push-Up","Pushups","Dumbbell_Bench_Press","Dumbbell_Floor_Press","Incline_Dumbbell_Press","Dumbbell_Flyes","Assisted_Dip_Machine","Seated_Dumbbell_Press","Arnold_Dumbbell_Press","Machine_Shoulder_Press","Half-Kneeling_Landmine_Press","Bent-Arm_Dumbbell_Pullover"],
  back:["Hyperextensions_Back_Extensions","Dumbbell_Romanian_Deadlift","Romanian_Deadlift","Kettlebell_Deadlift","Cable_Pull-Through","Barbell_Hip_Thrust","Cable_Wood_Chop"],
  hips:["Bodyweight_Box_Squat","Bodyweight_Squat","Goblet_Squat","Dumbbell_Lunges","Supported_Split_Squat","Supported_Reverse_Lunge","Supported_Low_Step-Up","Leg_Press","Machine_Hip_Abduction","Machine_Hip_Adduction","90-90_Hip_Switch","Half-Kneeling_Hip-Flexor_Mobilization"],
};
const correctionMetricCopy:Record<string,{zh:string;en:string}>={depth:{zh:"深蹲深度",en:"Squat depth"},tracking:{zh:"膝盖轨迹",en:"Knee tracking"},symmetry:{zh:"左右对称",en:"Left/right symmetry"},torso:{zh:"躯干控制",en:"Torso control"},tempo:{zh:"动作节奏",en:"Rep tempo"},shoulders:{zh:"肩线趋势",en:"Shoulder trend"},hips:{zh:"骨盆趋势",en:"Pelvis trend"},stance:{zh:"站姿左右趋势",en:"Stance symmetry"},head:{zh:"头肩位置",en:"Head-to-shoulder trend"}};
const bodyweightPlans: Record<Focus,string[]> = {
  full:["Bodyweight_Squat","Pushups","Supported_Reverse_Lunge","Single_Leg_Glute_Bridge","Bird_Dog","Plank"], upper:["Pushups","Incline_Push-Up","Wall_Slide","Bird_Dog","Kneeling_Side_Plank","Plank"], lower:["Bodyweight_Squat","Supported_Reverse_Lunge","Single_Leg_Glute_Bridge","Side-Lying_Clamshell","Standing_Calf_Raises","Dead_Bug"], pushpull:["Pushups","Incline_Push-Up","Wall_Slide","Bird_Dog","Kneeling_Side_Plank","Plank"], core:["Dead_Bug","Plank","Russian_Twist","Air_Bike","Single_Leg_Glute_Bridge","Bird_Dog"]
};
const dumbbellPlans: Record<Focus,string[]> = {
  full:["Goblet_Squat","Incline_Dumbbell_Press","Chest-Supported_Dumbbell_Row","Dumbbell_Romanian_Deadlift","Half-Kneeling_Single-Arm_Dumbbell_Press","Suitcase_Carry"], upper:["Incline_Dumbbell_Press","Chest-Supported_Dumbbell_Row","Half-Kneeling_Single-Arm_Dumbbell_Press","Dumbbell_Bicep_Curl","Wall_Slide","Suitcase_Carry"], lower:["Goblet_Squat","Dumbbell_Romanian_Deadlift","Supported_Low_Step-Up","Side-Lying_Clamshell","Calf_Raise_On_A_Dumbbell","Suitcase_Carry"], pushpull:["Incline_Dumbbell_Press","Chest-Supported_Dumbbell_Row","Dumbbell_Floor_Press","One-Arm_Dumbbell_Row","Dumbbell_Bicep_Curl","Suitcase_Carry"], core:["Bird_Dog","Dead_Bug","Suitcase_Carry","Kneeling_Side_Plank","Side-Lying_Clamshell","Wall_Slide"]
};
const beginnerPlans: Record<Focus,string[]> = {
  full:["Supported_Low_Step-Up","Standing_Cable_Chest_Press","Chest-Supported_Dumbbell_Row","Kettlebell_Deadlift","Cable_Pallof_Press"],
  upper:["Standing_Cable_Chest_Press","Chest-Supported_Dumbbell_Row","Machine_Shoulder_Press","Neutral-Grip_Lat_Pulldown","Cable_Biceps_Curl"],
  lower:["Bodyweight_Box_Squat","Supported_Reverse_Lunge","Seated_Leg_Curl","Machine_Hip_Adduction","Seated_Calf_Raise"],
  pushpull:["Standing_Cable_Chest_Press","Chest-Supported_Dumbbell_Row","Reverse_Pec_Deck","Neutral-Grip_Lat_Pulldown","Assisted_Dip_Machine"],
  core:["Bird_Dog","Cable_Pallof_Press","Cable_Wood_Chop","Kneeling_Side_Plank","Suitcase_Carry"]
};
const beginnerDumbbellPlans:Record<Focus,string[]>={
  full:["Bodyweight_Box_Squat","Dumbbell_Floor_Press","Chest-Supported_Dumbbell_Row","Dumbbell_Romanian_Deadlift","Suitcase_Carry"],
  upper:["Dumbbell_Floor_Press","Chest-Supported_Dumbbell_Row","Half-Kneeling_Single-Arm_Dumbbell_Press","Wall_Slide","Suitcase_Carry"],
  lower:["Bodyweight_Box_Squat","Dumbbell_Romanian_Deadlift","Supported_Low_Step-Up","Side-Lying_Clamshell","Bird_Dog"],
  pushpull:["Dumbbell_Floor_Press","Chest-Supported_Dumbbell_Row","Half-Kneeling_Single-Arm_Dumbbell_Press","Dumbbell_Bicep_Curl","Suitcase_Carry"],
  core:["Bird_Dog","Dead_Bug","Suitcase_Carry","Kneeling_Side_Plank","Side-Lying_Clamshell"]
};
const beginnerBodyweightPlans:Record<Focus,string[]>={
  full:["Bodyweight_Box_Squat","Wall_Push-Up","Supported_Low_Step-Up","Side-Lying_Clamshell","Bird_Dog"],
  upper:["Wall_Push-Up","Wall_Slide","Bird_Dog","Kneeling_Side_Plank","Bodyweight_Box_Squat"],
  lower:["Bodyweight_Box_Squat","Supported_Low_Step-Up","Butt_Lift_Bridge","Side-Lying_Clamshell","Bird_Dog"],
  pushpull:["Wall_Push-Up","Wall_Slide","Bodyweight_Box_Squat","Bird_Dog","Kneeling_Side_Plank"],
  core:["Bird_Dog","Kneeling_Side_Plank","Side-Lying_Clamshell","Butt_Lift_Bridge","Wall_Slide"]
};
const easierMove:Record<string,string>={"Kneeling_Push-Up":"Wall_Push-Up","Incline_Push-Up":"Kneeling_Push-Up",Pushups:"Incline_Push-Up",Dumbbell_Bench_Press:"Dumbbell_Floor_Press",Incline_Dumbbell_Press:"Dumbbell_Floor_Press",Dumbbell_Floor_Press:"Wall_Push-Up",Standing_Cable_Chest_Press:"Leverage_Chest_Press",Assisted_Dip_Machine:"Triceps_Pushdown_-_Rope_Attachment",Bodyweight_Squat:"Bodyweight_Box_Squat",Goblet_Squat:"Bodyweight_Squat","Supported_Low_Step-Up":"Bodyweight_Box_Squat",Dumbbell_Step_Ups:"Supported_Low_Step-Up",Supported_Split_Squat:"Bodyweight_Box_Squat",Supported_Reverse_Lunge:"Supported_Split_Squat",Dumbbell_Lunges:"Supported_Split_Squat","Side-Lying_Clamshell":"Butt_Lift_Bridge",Machine_Hip_Abduction:"Side-Lying_Clamshell",Machine_Hip_Adduction:"Bodyweight_Box_Squat",Single_Leg_Glute_Bridge:"Butt_Lift_Bridge","Cable_Pull-Through":"Butt_Lift_Bridge",Kettlebell_Deadlift:"Butt_Lift_Bridge",Seated_Leg_Curl:"Butt_Lift_Bridge",Seated_Calf_Raise:"Standing_Calf_Raises",Dumbbell_Romanian_Deadlift:"Butt_Lift_Bridge",Romanian_Deadlift:"Dumbbell_Romanian_Deadlift",Barbell_Hip_Thrust:"Butt_Lift_Bridge",Arnold_Dumbbell_Press:"Half-Kneeling_Single-Arm_Dumbbell_Press",Seated_Dumbbell_Press:"Wall_Slide",Machine_Shoulder_Press:"Wall_Slide","Half-Kneeling_Landmine_Press":"Wall_Slide",Reverse_Pec_Deck:"Wall_Slide","Half-Kneeling_Single-Arm_Dumbbell_Press":"Wall_Slide",Seated_Cable_Rows:"Chest-Supported_Dumbbell_Row","Straight-Arm_Cable_Pulldown":"Chest-Supported_Dumbbell_Row","Neutral-Grip_Lat_Pulldown":"Chest-Supported_Dumbbell_Row","Bent-Arm_Dumbbell_Pullover":"Chest-Supported_Dumbbell_Row",Cable_Biceps_Curl:"Dumbbell_Bicep_Curl",Suitcase_Carry:"Cable_Pallof_Press",Cable_Wood_Chop:"Cable_Pallof_Press",Cable_Pallof_Press:"Bird_Dog",Plank:"Kneeling_Side_Plank","Kneeling_Side_Plank":"Bird_Dog",Dead_Bug:"Bird_Dog"};
const getWarmupMoves=(workout:LibraryExercise[])=>{
  const bodies=new Set(workout.map(exercise=>exercise.body));
  const candidates=["Cat-Cow"];
  if(["chest","back","shoulders","arms"].some(body=>bodies.has(body as BodyPart)))candidates.push("Wall_Slide","Bird_Dog");
  if(bodies.has("lower"))candidates.push("Half-Kneeling_Ankle_Rock","Half-Kneeling_Hip-Flexor_Mobilization","90-90_Hip_Switch");
  if(bodies.has("core"))candidates.push("Dead_Bug","Bird_Dog");
  candidates.push("Half-Kneeling_Ankle_Rock","90-90_Hip_Switch","Wall_Slide","Bird_Dog","Bodyweight_Box_Squat","Butt_Lift_Bridge");
  return [...new Set(candidates)].slice(0,5).map(id=>ids[id]).filter(Boolean) as LibraryExercise[];
};
const skillPaths:{id:MovementSkill;zh:string;en:string;levels:string[];criteriaZh:string[];criteriaEn:string[]}[]=[
  {id:"push",zh:"水平推",en:"Push",levels:["Wall_Push-Up","Kneeling_Push-Up","Incline_Push-Up","Pushups","Close-Grip_Push-Up_off_of_a_Dumbbell"],criteriaZh:["墙面完成 12 次，臀肩同步","跪姿完成 10 次，身体保持直线","高台完成 10 次，胸口落在双手之间","标准俯卧撑稳定完成 8 次","窄距完成 8 次且肩部无不适"],criteriaEn:["12 wall reps with hips and shoulders together","10 kneeling reps in one body line","10 incline reps with chest between hands","8 controlled full push-ups","8 close-grip reps without shoulder discomfort"]},
  {id:"squat",zh:"下蹲",en:"Squat",levels:["Bodyweight_Box_Squat","Bodyweight_Squat","Goblet_Squat","Supported_Split_Squat","Dumbbell_Lunges"],criteriaZh:["轻触训练凳完成 12 次，不坐下放松","徒手完成 12 次，脚跟不离地","负重完成 10 次，膝盖稳定","每侧完成 8 次，只轻扶支架","每侧弓步完成 8 次，骨盆水平"],criteriaEn:["12 light bench touches without relaxing","12 bodyweight reps with heels grounded","10 loaded reps with stable knees","8 supported reps each side with a light grip","8 lunges each side with level hips"]},
  {id:"hinge",zh:"髋伸",en:"Hip extension",levels:["Butt_Lift_Bridge","Cable_Pull-Through","Dumbbell_Romanian_Deadlift","Romanian_Deadlift","Barbell_Hip_Thrust"],criteriaZh:["臀桥完成 15 次，腰部无代偿","绳索髋铰链完成 12 次，不做成深蹲","哑铃硬拉完成 10 次，能感受腿后侧","杠铃硬拉完成 8 次，脊柱保持中立","负重臀推完成 10 次并控制顶点"],criteriaEn:["15 bridges without low-back compensation","12 cable hinges without turning it into a squat","10 dumbbell hinges with hamstring tension","8 barbell hinges with a neutral spine","10 loaded thrusts with a controlled lockout"]},
  {id:"pull",zh:"上肢拉",en:"Pull",levels:["Chest-Supported_Dumbbell_Row","Seated_Cable_Rows","Neutral-Grip_Lat_Pulldown","Full_Range-Of-Motion_Lat_Pulldown","Band_Assisted_Pull-Up"],criteriaZh:["俯卧划船完成 12 次，胸口不离开靠垫","坐姿划船完成 12 次，不耸肩","窄握下拉完成 10 次，躯干保持稳定","宽握下拉完成 10 次，不大幅后仰","辅助引体完成 6 次，不摆动"],criteriaEn:["12 supported rows with chest on the pad","12 cable rows without shrugging","10 neutral pulldowns with a quiet torso","10 wide pulldowns without leaning back","6 assisted pull-ups without swinging"]},
  {id:"core",zh:"核心稳定",en:"Core control",levels:["Bird_Dog","Dead_Bug","Cable_Pallof_Press","Suitcase_Carry","Plank"],criteriaZh:["每侧完成 8 次，骨盆保持水平","每侧完成 10 次，腰背不离地","每侧完成 12 次，躯干不旋转","每侧行走 30 秒，肩膀保持水平","平板保持 45 秒并自然呼吸"],criteriaEn:["8 each side with level hips","10 each side with low back grounded","12 each side without torso rotation","30 seconds each side with level shoulders","45-second plank with steady breathing"]}
];
const defaultSkillLevels:Record<MovementSkill,number>={push:0,squat:0,hinge:0,pull:0,core:0};
const shuffle=(items:string[])=>{const next=[...items];for(let index=next.length-1;index>0;index-=1){const swapIndex=Math.floor(Math.random()*(index+1));[next[index],next[swapIndex]]=[next[swapIndex],next[index]]}return next};
const dateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const comparePerformance=(candidate:SetPerformance,best:SetPerformance|null)=>!best||candidate.weightKg>best.weightKg||(candidate.weightKg===best.weightKg&&candidate.reps>best.reps);
const bestPerformance=(performances:SetPerformance[],exerciseId:string)=>performances.filter(item=>item.exerciseId===exerciseId).reduce<SetPerformance|null>((best,item)=>comparePerformance(item,best)?item:best,null);
const startOfWeek=(date=new Date())=>{const start=new Date(date.getFullYear(),date.getMonth(),date.getDate());const day=start.getDay()||7;start.setDate(start.getDate()-day+1);return start};
const weekDates=(date=new Date())=>{const start=startOfWeek(date);return Array.from({length:7},(_,index)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+index))};
const workoutStreak=(history:WorkoutLog[])=>{
  const days=new Set(history.map(log=>dateKey(new Date(log.date))));
  if(!days.size)return 0;
  const cursor=new Date();cursor.setHours(0,0,0,0);
  if(!days.has(dateKey(cursor)))cursor.setDate(cursor.getDate()-1);
  let streak=0;
  while(days.has(dateKey(cursor))){streak+=1;cursor.setDate(cursor.getDate()-1)}
  return streak;
};
const initials=(name:string)=>name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"PF";
const shortDate=(language:Language,date=new Date())=>formatShortAppDate(language,date);
const fullDate=(language:Language,date=new Date())=>formatFullAppDate(language,date);
const goalCopy:Record<TrainingGoal,{zh:string;en:string}>={strength:{zh:"增强力量",en:"Build strength"},muscle:{zh:"增加肌肉",en:"Build muscle"},fatloss:{zh:"减脂塑形",en:"Fat loss"},general:{zh:"综合体能",en:"General fitness"}};
const ratingCopy:Record<SessionRating,{zh:string;en:string;icon:string}>={easy:{zh:"偏轻松",en:"Felt easy",icon:"↗"},right:{zh:"刚刚好",en:"Just right",icon:"✓"},hard:{zh:"有点太难",en:"Too hard",icon:"↓"},pain:{zh:"出现疼痛",en:"Felt pain",icon:"!"}};
const goalPlanCopy:Record<TrainingGoal,{zh:string;en:string}>={
  strength:{zh:"较低次数与更充分休息，优先保持力量输出和动作质量。",en:"Lower reps and longer recovery prioritize strength and clean execution."},
  muscle:{zh:"使用中等次数和训练容量，在可控动作中逐步增加负荷。",en:"Moderate reps and volume support progressive muscle gain with controlled form."},
  fatloss:{zh:"较高次数与紧凑休息提高训练密度，同时保留动作质量。",en:"Higher reps and shorter recovery raise training density while preserving form."},
  general:{zh:"均衡安排力量、动作控制与恢复，建立可持续训练习惯。",en:"Balanced strength, movement control, and recovery build a sustainable routine."},
};
type Prescription={reps:string;restSeconds:number;restLabel:string};
const prescribe=(exercise:LibraryExercise,goal:TrainingGoal,novice:boolean):Prescription=>{
  const timed=/秒|sec|hold|walk/i.test(exercise.reps)||exercise.tempo==="HOLD"||exercise.tempo==="WALK";
  const perSide=/侧|each side/i.test(exercise.reps);
  const range=goal==="strength"?(novice?"6–10":"5–8"):goal==="muscle"?(novice?"8–12":"8–15"):goal==="fatloss"?(novice?"10–14":"12–18"):exercise.reps;
  const reps=timed||goal==="general"?exercise.reps:`${range}${perSide?" / 侧":""}`;
  const base=Math.max(20,parseInt(exercise.rest)||45);
  const restSeconds=goal==="strength"?Math.max(base,novice?60:90):goal==="muscle"?Math.max(45,Math.min(75,base)):goal==="fatloss"?Math.max(30,Math.min(45,base)):base;
  return {reps,restSeconds,restLabel:`${restSeconds}s`};
};
const localizedReps=(value:string,language:Language)=>language==="zh"?value:value.replace(/\s*\/\s*侧/g," / side").replace(/\s*秒/g," sec");
const breathingCue=(exercise:LibraryExercise,language:Language)=>{
  if(exercise.tempo==="HOLD")return language==="zh"?"保持自然呼吸；每次呼气重新收紧核心。":"Breathe naturally; reset your brace on each exhale.";
  if(exercise.tempo==="WALK")return language==="zh"?"保持平稳呼吸，不要为了负重憋气。":"Keep a steady breath; do not hold it through the carry.";
  if(exercise.tempo==="BREATH"||mobilityIds.has(exercise.id))return language==="zh"?"呼气进入活动范围，吸气时缓慢回到起点。":"Exhale into the range and inhale as you return with control.";
  return language==="zh"?"准备时吸气，发力阶段呼气，回程保持控制。":"Inhale to prepare, exhale through effort, and control the return.";
};
const readPendingWorkouts=():WorkoutLog[]=>{
  return readPendingWorkoutPayloads<unknown>().filter(item=>isPendingWorkout(item,Object.keys(ids))).map(item=>({...item as Record<string,unknown>,pending:true} as WorkoutLog));
};
const writePendingWorkouts=(logs:WorkoutLog[])=>writePendingWorkoutPayloads(logs);
const LOCAL_LOG_USER_ID=DEFAULT_USER_ID;
const sameWorkoutDay=(left:string,right:string)=>isSameAppDay(left,right);
const toStoredWorkout=(log:WorkoutLog):StoredWorkoutLog=>({id:log.id,userId:LOCAL_LOG_USER_ID,workoutId:log.id,workoutDate:log.date,completed:log.completed!==false,perceivedDifficulty:log.perceivedDifficulty??5,energyLevel:log.energyLevel??5,sorenessLevel:log.sorenessLevel??5,notes:log.notes||"",createdAt:log.date,payload:{...log}});
const fromStoredWorkout=(stored:StoredWorkoutLog):WorkoutLog=>{const payload=(stored.payload||{}) as Partial<WorkoutLog>;return {...payload,id:stored.workoutId,date:stored.workoutDate,focus:payload.focus||"full",duration:payload.duration||0,exercises:payload.exercises||0,sets:payload.sets||0,totalVolume:payload.totalVolume||0,rating:payload.rating||"right",performances:Array.isArray(payload.performances)?payload.performances:[],completed:stored.completed,perceivedDifficulty:stored.perceivedDifficulty,energyLevel:stored.energyLevel,sorenessLevel:stored.sorenessLevel,notes:stored.notes||"",pending:payload.pending===true}};
const queuePendingWorkout=async(log:WorkoutLog)=>{await saveWorkoutLog(toStoredWorkout(log));const current=readPendingWorkouts().filter(item=>item.id!==log.id&&!sameWorkoutDay(item.date,log.date));writePendingWorkouts([{...log,pending:true},...current].slice(0,20))};

export default function HomePage() {
  const [entered,setEntered]=useState<boolean|null>(null);
  useEffect(()=>{setEntered(hasSeenWelcome())},[]);
  if(entered===null)return <main className="start-loading" aria-busy="true"><strong>练一下 · ONE SET</strong><p role="status">正在准备 / Getting ready…</p></main>;
  if(!entered)return <StartScreen onEnter={()=>{markWelcomeSeen();setEntered(true)}}/>;
  return <OneSetApp/>;
}

export function OneSetApp({initialTab="today"}:{initialTab?:Tab}) {
  const [language,setLanguage] = useState<Language>("zh");
  const [tab,setTab] = useState<Tab>(initialTab);
  const [sheet,setSheet] = useState<Sheet>(null);
  const [duration,setDuration] = useState(45);
  const [focus,setFocus] = useState<Focus>("full");
  const [equipment,setEquipment] = useState<Equipment>("gym");
  const [level,setLevel] = useState<Level>("beginner");
  const [noviceMode,setNoviceMode] = useState(true);
  const [pushAbility,setPushAbility] = useState("not-yet");
  const [planIds,setPlanIds] = useState(beginnerPlans.full);
  const [selected,setSelected] = useState<LibraryExercise|null>(null);
  const [swapTarget,setSwapTarget] = useState<LibraryExercise|null>(null);
  const [swapOptions,setSwapOptions] = useState<LibraryExercise[]>([]);
  const [query,setQuery] = useState("");
  const [bodyFilter,setBodyFilter] = useState<BodyPart|"all">("all");
  const [gearFilter,setGearFilter] = useState<Gear|"all">("all");
  const [libraryTarget,setLibraryTarget] = useState<LibraryTarget>("all");
  const [libraryType,setLibraryType] = useState<LibraryType>("all");
  const [listening,setListening] = useState(false);
  const [voiceError,setVoiceError] = useState<"unsupported"|"denied"|"no-speech"|"network"|null>(null);
  const [request,setRequest] = useState("");
  const [building,setBuilding] = useState(false);
  const [workoutMode,setWorkoutMode] = useState(false);
  const [workoutPaused,setWorkoutPaused] = useState(false);
  const [workoutLearning,setWorkoutLearning] = useState(true);
  const [exerciseIndex,setExerciseIndex] = useState(0);
  const [setIndex,setSetIndex] = useState(0);
  const [completed,setCompleted] = useState<Record<string,boolean>>({});
  const [seconds,setSeconds] = useState(0);
  const [restRemaining,setRestRemaining] = useState(0);
  const [skillLevels,setSkillLevels] = useState<Record<MovementSkill,number>>(defaultSkillLevels);
  const [history,setHistory] = useState<WorkoutLog[]>([]);
  const [setInputs,setSetInputs] = useState<Record<string,SetInput>>({});
  const [syncState,setSyncState] = useState<SyncState>("loading");
  const [storageReady,setStorageReady] = useState(false);
  const [cloudProfileReady,setCloudProfileReady] = useState(false);
  const [resumeDraft,setResumeDraft] = useState<SessionDraft|null>(null);
  const [profileName,setProfileName] = useState("Pure Athlete");
  const [completedWorkout,setCompletedWorkout] = useState<WorkoutLog|null>(null);
  const [todayLog,setTodayLog] = useState<WorkoutLog|null>(null);
  const [quickLogOpen,setQuickLogOpen] = useState(false);
  const [quickLogSaving,setQuickLogSaving] = useState(false);
  const [completionHighlights,setCompletionHighlights] = useState<PersonalBestHighlight[]>([]);
  const [nextWorkoutDate,setNextWorkoutDate] = useState<string|null>(null);
  const [trainingGoal,setTrainingGoal] = useState<TrainingGoal>("general");
  const [weeklyGoal,setWeeklyGoal] = useState(4);
  const [builderMode,setBuilderMode] = useState<BuilderMode>("quick");
  const [advancedProfile,setAdvancedProfile] = useState<AdvancedProfile>(defaultAdvancedProfile);
  const [favoriteIds,setFavoriteIds] = useState<string[]>([]);
  const [focusExerciseId,setFocusExerciseId] = useState<string|null>(null);
  const [recentExerciseIds,setRecentExerciseIds] = useState<string[]>([]);
  const [planPersonalization,setPlanPersonalization] = useState<PlanPersonalization|null>(null);
  const [todaySession,setTodaySession] = useState<TodaySession|null>(null);
  const [planSetCounts,setPlanSetCounts] = useState<number[]>([]);
  const [activeWorkoutId,setActiveWorkoutId] = useState<string|null>(null);
  const [generatedWorkout,setGeneratedWorkout] = useState<GeneratedWorkout|null>(null);
  const recognition = useRef<{start:()=>void;stop:()=>void}|null>(null);
  const pendingSyncInFlight = useRef(false);
  const t = text[language];
  const advancedProfileActive=builderMode==="advanced"||hasAdvancedPersonalization(advancedProfile);
  const workout = planIds.map(id => ids[id]).filter(Boolean) as LibraryExercise[];
  const warmupMoves = getWarmupMoves(workout);
  const baseSetCount = duration<=25?2:noviceMode?2:trainingGoal==="strength"?(duration>=55?4:3):trainingGoal==="muscle"?(duration>=45?4:3):trainingGoal==="fatloss"?(duration>=55?3:2):(duration>=55?4:3);
  const setCount = advancedProfileActive&&advancedProfile.recovery==="low"?Math.max(2,baseSetCount-1):baseSetCount;
  const setCountFor=(exerciseIndex:number)=>planSetCounts[exerciseIndex]??setCount;
  const avatarText=initials(profileName);
  const profileBadge=profileName==="Pure Athlete"?(language==="zh"?"档案":"PROFILE"):avatarText;
  const [currentDate,setCurrentDate] = useState<Date|null>(null);
  const currentDayKey=currentDate?appDateKey(currentDate):"";
  const todayDate=currentDate?shortDate(language,currentDate):"—";

  useEffect(()=>{
    const refreshDate=()=>setCurrentDate(new Date());
    const refreshWhenVisible=()=>{if(document.visibilityState==="visible")refreshDate()};
    const initialTimer=window.setTimeout(refreshDate,0);
    const timer=window.setInterval(refreshDate,30000);
    window.addEventListener("focus",refreshDate);
    document.addEventListener("visibilitychange",refreshWhenVisible);
    return()=>{
      window.clearInterval(timer);
      window.clearTimeout(initialTimer);
      window.removeEventListener("focus",refreshDate);
      document.removeEventListener("visibilitychange",refreshWhenVisible);
    };
  },[]);

  useEffect(()=>{
    if(!currentDayKey)return;
    let cancelled=false;
    void getTodayLog(LOCAL_LOG_USER_ID).then(log=>{if(!cancelled)setTodayLog(log?fromStoredWorkout(log):null)});
    return()=>{cancelled=true};
  },[currentDayKey]);

  useEffect(()=>{
    const expectedPath=tab==="progress"?"/progress":"/";
    if(window.location.pathname!==expectedPath)window.history.replaceState(window.history.state,"",expectedPath);
  },[tab]);

  const flushPendingWorkouts=useCallback(async()=>{
    if(pendingSyncInFlight.current)return;
    const queued=trainingRecords(readPendingWorkouts()) as WorkoutLog[];
    if(!queued.length)return;
    pendingSyncInFlight.current=true;
    setSyncState("saving");
    const failed:WorkoutLog[]=[];
    let authenticationFailed=false;
    try{
      for(const pending of queued){
        if(isTestWorkout(pending)){failed.push(pending);continue;}
        try{
          const response=await fetch("/api/workouts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pending)});
          if(!response.ok){if(response.status===401)authenticationFailed=true;throw new Error("sync failed")}
          const data=await response.json() as {workout:WorkoutLog};
          if(!isCurrentPendingWorkout(pending,readPendingWorkouts()))continue;
          const saved:WorkoutLog={...data.workout,rating:["easy","right","hard","pain"].includes(data.workout.rating)?data.workout.rating:"right",performances:Array.isArray(data.workout.performances)?data.workout.performances:[],pending:false};
          await saveWorkoutLog(toStoredWorkout(saved));
          setHistory(current=>[saved,...current.filter(item=>item.id!==pending.id)].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,30));
          if(sameWorkoutDay(saved.date,new Date().toISOString()))setTodayLog(saved);
        }catch{failed.push(pending)}
      }
      const remaining=remainingPendingWorkouts(readPendingWorkouts(),queued,failed);
      writePendingWorkouts(remaining);
      setSyncState(authenticationFailed?"local":trainingRecords(remaining).length?"offline":"synced");
    }finally{pendingSyncInFlight.current=false}
  },[]);

  useEffect(() => {
    try {
      const saved = getUserProfile<Partial<{language:Language;noviceMode:boolean;pushAbility:string;equipment:Equipment;focus:Focus;duration:number;level:Level;skillLevels:Record<MovementSkill,number>;profileName:string;trainingGoal:TrainingGoal;weeklyGoal:number;nextWorkoutDate:string;favoriteIds:string[];focusExerciseId:string;recentExerciseIds:string[];planIds:string[];builderMode:BuilderMode;advancedProfile:AdvancedProfile}>>();
      if (saved) {
        if (saved.language === "zh" || saved.language === "en") setLanguage(saved.language);
        if (typeof saved.noviceMode === "boolean") setNoviceMode(saved.noviceMode);
        if(typeof saved.nextWorkoutDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(saved.nextWorkoutDate))setNextWorkoutDate(saved.nextWorkoutDate);
        if (["not-yet","few","ready"].includes(saved.pushAbility || "")) setPushAbility(saved.pushAbility!);
        if (["gym","dumbbell","bodyweight"].includes(saved.equipment || "")) setEquipment(saved.equipment!);
        if (["full","upper","lower","pushpull","core"].includes(saved.focus || "")) setFocus(saved.focus!);
        if (typeof saved.duration === "number") setDuration(saved.duration);
        if (["beginner","intermediate","advanced"].includes(saved.level || "")) setLevel(saved.level!);
        if (saved.skillLevels) setSkillLevels({...defaultSkillLevels,...saved.skillLevels});
        if (typeof saved.profileName === "string" && saved.profileName.trim()) setProfileName(saved.profileName.trim().slice(0,32));
        if (["strength","muscle","fatloss","general"].includes(saved.trainingGoal || "")) setTrainingGoal(saved.trainingGoal!);
        if (typeof saved.weeklyGoal === "number" && saved.weeklyGoal >= 1 && saved.weeklyGoal <= 7) setWeeklyGoal(Math.round(saved.weeklyGoal));
         if(Array.isArray(saved.favoriteIds))setFavoriteIds([...new Set(saved.favoriteIds.filter(id=>typeof id==="string"&&Boolean(ids[id])))].slice(0,50));
         if(typeof saved.focusExerciseId==="string"&&Boolean(ids[saved.focusExerciseId]))setFocusExerciseId(saved.focusExerciseId);
         if(Array.isArray(saved.recentExerciseIds))setRecentExerciseIds([...new Set(saved.recentExerciseIds.filter(id=>typeof id==="string"&&Boolean(ids[id])))].slice(0,6));
        if(Array.isArray(saved.planIds)){const restored=[...new Set(saved.planIds.filter(id=>typeof id==="string"&&Boolean(ids[id])))].slice(0,10);if(restored.length)setPlanIds(restored)}
        if(saved.builderMode==="quick"||saved.builderMode==="advanced")setBuilderMode(saved.builderMode);
        if(saved.advancedProfile){const profile=saved.advancedProfile;setAdvancedProfile({...defaultAdvancedProfile,...profile,painAreas:Array.isArray(profile.painAreas)?profile.painAreas.filter(area=>["knees","shoulders","back","hips"].includes(area)):[]})}
      }
    } catch { /* A corrupt device-local profile should never block the workout flow. */ }
    const parsedDraft=getActiveWorkout<unknown>(SESSION_STORAGE_KEY);
    if(parsedDraft&&isSessionDraft(parsedDraft,Object.keys(ids))){const draft=parsedDraft as SessionDraft;const completedSets=Object.values(draft.completed||{}).filter(Boolean).length;const hasMovedForward=draft.exerciseIndex>0||draft.setIndex>0||completedSets>0||draft.seconds>=20;if(hasMovedForward)setResumeDraft(draft);else clearActiveWorkout(SESSION_STORAGE_KEY)}else if(parsedDraft)clearActiveWorkout(SESSION_STORAGE_KEY);
    setStorageReady(true);
    void getGeneratedWorkout<GeneratedWorkout>().then(savedWorkout=>{
      if(!savedWorkout?.exercises?.length)return;
      const restored=savedWorkout.exercises.map(exercise=>exercise.id).filter(id=>Boolean(ids[id]));
      if(!restored.length)return;
      setGeneratedWorkout(savedWorkout);
      setPlanIds(restored);
      setPlanSetCounts(savedWorkout.exercises.filter(exercise=>Boolean(ids[exercise.id])).map(exercise=>exercise.sets));
      if(["full","upper","lower","pushpull","core"].includes(savedWorkout.focusArea))setFocus(savedWorkout.focusArea as Focus);
      setDuration(savedWorkout.estimatedMinutes);
      setPlanPersonalization({favoritesUsed:0,painSwaps:0,historyAware:false,targetCount:restored.length,advanced:false,adjustmentReason:savedWorkout.adjustmentReason,intensity:savedWorkout.intensity});
    });
  },[]);
  useEffect(()=>{
    if(!storageReady||cloudProfileReady)return;
    let cancelled=false;
    const localProfile={displayName:profileName,trainingGoal,weeklyDays:weeklyGoal,equipment,level,weightUnit:"lb",notes:advancedProfile.notes,advancedProfile:syncedAdvancedProfile(advancedProfile)};
    fetch("/api/profile",{cache:"no-store"}).then(async response=>{
      if(!response.ok)return null;
      return response.json() as Promise<{profileExists:boolean;profile:{displayName:string|null;trainingGoal:TrainingGoal;weeklyDays:number;equipment:Equipment;level:Level;notes:string;advancedProfile:SyncedAdvancedProfile}}>;
    }).then(async data=>{
      if(cancelled||!data)return;
      if(data.profileExists){
        const profile=data.profile;const synced=normalizeSyncedAdvancedProfile(profile.advancedProfile||{});setProfileName(profile.displayName?.trim()||profileName);setTrainingGoal(profile.trainingGoal);setWeeklyGoal(profile.weeklyDays);setEquipment(profile.equipment);setLevel(profile.level);setAdvancedProfile(current=>({...current,...synced,notes:profile.notes}));if(hasAdvancedPersonalization({...defaultAdvancedProfile,...synced,notes:profile.notes}))setBuilderMode("advanced");
      }else{
        await fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(localProfile)}).catch(()=>{});
      }
      if(!cancelled)setCloudProfileReady(true);
    }).catch(()=>{});
    return()=>{cancelled=true};
  },[storageReady,cloudProfileReady,profileName,trainingGoal,weeklyGoal,equipment,level,advancedProfile]);
  useEffect(()=>{
    if(!storageReady||!cloudProfileReady)return;
    const timer=window.setTimeout(()=>{void fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:profileName,trainingGoal,weeklyDays:weeklyGoal,equipment,level,weightUnit:"lb",notes:advancedProfile.notes,advancedProfile:syncedAdvancedProfile(advancedProfile)})}).catch(()=>{})},650);
    return()=>window.clearTimeout(timer);
  },[storageReady,cloudProfileReady,profileName,trainingGoal,weeklyGoal,equipment,level,advancedProfile]);
  useEffect(() => {
    if (!storageReady) return;
    saveUserProfile({language,noviceMode,pushAbility,equipment,focus,duration,level,skillLevels,profileName,trainingGoal,weeklyGoal,nextWorkoutDate,favoriteIds,focusExerciseId,recentExerciseIds,planIds,builderMode,advancedProfile});
   },[storageReady,language,noviceMode,pushAbility,equipment,focus,duration,level,skillLevels,profileName,trainingGoal,weeklyGoal,nextWorkoutDate,favoriteIds,focusExerciseId,recentExerciseIds,planIds,builderMode,advancedProfile]);
  useEffect(()=>{
    if(!storageReady||!workoutMode)return;
    const draft:SessionDraft={version:1,savedAt:Date.now(),planIds,setCounts:workout.map((_,index)=>setCountFor(index)),activeWorkoutId:activeWorkoutId||undefined,duration,focus,equipment,level,goal:trainingGoal,noviceMode,exerciseIndex,setIndex,seconds,restRemaining,setInputs,completed};
    saveActiveWorkout(SESSION_STORAGE_KEY,draft);
  },[storageReady,workoutMode,planIds,planSetCounts,activeWorkoutId,duration,focus,equipment,level,trainingGoal,noviceMode,exerciseIndex,setIndex,seconds,restRemaining,setInputs,completed]);
  useEffect(() => {
    let cancelled=false;
    void (async()=>{
      const local=(await getWorkoutLogs(LOCAL_LOG_USER_ID)).map(fromStoredWorkout);
      const queued=readPendingWorkouts();
      const localIds=new Set(queued.map(log=>log.id));
      const deviceLogs=trainingRecords([...queued,...local.filter(log=>!localIds.has(log.id))]).slice(0,30) as WorkoutLog[];
      const deviceToday=deviceLogs.find(log=>sameWorkoutDay(log.date,new Date().toISOString()))||null;
      if(!cancelled)setTodayLog(deviceToday);
      if(!cancelled&&deviceLogs.length){setHistory(deviceLogs);setSyncState(queued.length?"offline":"synced")}
      try{
        const response=await fetch("/api/workouts?all=1",{cache:"no-store"});
        if(response.status===401){if(!cancelled){setHistory(deviceLogs);setSyncState("local")}return;}
        if(!response.ok)throw new Error("sync unavailable");
        const data=await response.json() as {workouts:WorkoutLog[]};
        if(cancelled)return;
        const logs=Array.isArray(data.workouts)?data.workouts.map(log=>({...log,rating:["easy","right","hard","pain"].includes(log.rating)?log.rating:"right" as SessionRating,performances:Array.isArray(log.performances)?log.performances:[],pending:false})):[];
        const pendingIds=new Set(queued.map(log=>log.id));
        const cloudIds=new Set(logs.map(log=>log.id));
        const merged=[...queued,...logs.filter(log=>!pendingIds.has(log.id)),...local.filter(log=>!pendingIds.has(log.id)&&!cloudIds.has(log.id))];
        const genuine=trainingRecords(merged).slice(0,30) as WorkoutLog[];
        setHistory(genuine);
        setTodayLog(genuine.find(log=>sameWorkoutDay(log.date,new Date().toISOString()))||null);
        if(trainingRecords(queued).length){setSyncState("offline");void flushPendingWorkouts()}else setSyncState("synced");
      }catch{if(!cancelled){setHistory(deviceLogs);setSyncState(deviceLogs.length?"offline":"error")}}
    })();
    return()=>{cancelled=true};
  },[flushPendingWorkouts]);
  useEffect(()=>{
    const retry=()=>{if(readPendingWorkouts().length)void flushPendingWorkouts()};
    window.addEventListener("online",retry);
    const timer=window.setInterval(()=>{if(window.navigator.onLine)retry()},30000);
    return()=>{window.removeEventListener("online",retry);window.clearInterval(timer)};
  },[flushPendingWorkouts]);
  useEffect(()=>{
    let cancelled=false;
    fetch(`/api/plans/today?day=${new Date().getDay()}`,{cache:"no-store"})
      .then(async response=>response.ok?response.json() as Promise<{today:TodaySession|null}>:null)
      .then(data=>{
        if(cancelled||!data?.today?.exercises?.length)return;
        const restored=data.today.exercises.map(item=>item.exerciseId).filter(id=>Boolean(ids[id]));
        if(!restored.length)return;
        setTodaySession(data.today);
        setPlanIds(restored);
        setPlanSetCounts(data.today.exercises.map(item=>item.sets));
        setFocus(data.today.focus);
        setPlanPersonalization({favoritesUsed:0,painSwaps:0,historyAware:history.length>0,targetCount:restored.length,advanced:false,aiSaved:true,planName:data.today.planName,dayName:data.today.dayName});
      })
      .catch(()=>{/* Saved plans are optional until ChatGPT writes one. */});
    return()=>{cancelled=true};
  },[history.length]);
  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; }, [language]);
  useEffect(() => {
    if (!shouldRunWorkoutClock(workoutMode,workoutPaused,workoutLearning,restRemaining)) return;
    const timer = window.setInterval(() => setSeconds(v => v + 1),1000);
    return () => window.clearInterval(timer);
  },[workoutMode,workoutPaused,workoutLearning,restRemaining>0]);
  useEffect(()=>{if(restRemaining<=0||workoutPaused)return;const timer=window.setInterval(()=>setRestRemaining(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(timer)},[restRemaining,workoutPaused]);
  useEffect(() => () => recognition.current?.stop(),[]);

  const filtered = useMemo(() => exerciseLibrary.filter(ex => {
    const pattern=movementPatternForExercise(ex);
    const patternSearch=pattern==="push"?"推 push pressing":pattern==="pull"?"拉 pull pulling":pattern==="squat"?"深蹲 squat knee":pattern==="hinge"?"髋铰链 hinge hip":pattern==="core"?"核心 core stability":"活动度 mobility prep";
    const hay = `${ex.zh} ${ex.en} ${ex.primaryZh} ${ex.primaryEn} ${ex.secondaryZh} ${ex.secondaryEn} ${ex.stepsZh.join(" ")} ${ex.stepsEn.join(" ")} ${ex.cuesZh.join(" ")} ${ex.cuesEn.join(" ")} ${ex.mistakeZh} ${ex.mistakeEn} ${gearNames[language][ex.gear]} ${patternSearch}`.toLowerCase();
    const typeMatches=libraryType==="all"||libraryType==="favorites"&&favoriteIds.includes(ex.id)||libraryType==="mobility"&&mobilityIds.has(ex.id)||libraryType==="beginner"&&ex.level==="beginner"&&!mobilityIds.has(ex.id)||libraryType==="intermediate"&&ex.level==="intermediate";
    return (bodyFilter === "all" || ex.body === bodyFilter) && matchesSpecificTarget(ex,libraryTarget) && (gearFilter === "all" || ex.gear === gearFilter) && typeMatches && hay.includes(query.trim().toLowerCase());
  }),[query,bodyFilter,libraryTarget,gearFilter,libraryType,language,favoriteIds]);
  const previousSets = useMemo(() => {
    const result:Record<string,SetPerformance>={};
    for(const log of history){
      for(const set of log.performances||[]){
        const key=`${set.exerciseId}-${set.setNumber}`;
        if(!result[key])result[key]=set;
      }
    }
    return result;
  },[history]);
  const latestRatingByExercise=useMemo(()=>{
    const result:Record<string,SessionRating>={};
    for(const log of history)for(const set of log.performances||[])if(!result[set.exerciseId])result[set.exerciseId]=log.rating||"right";
    return result;
  },[history]);
  const selectedStats=useMemo<ExerciseStats|null>(()=>{
    if(!selected)return null;
    const sessions=history.filter(log=>log.performances?.some(set=>set.exerciseId===selected.id));
    if(!sessions.length)return null;
    const lastSession=sessions[0];
    const latestSets=lastSession.performances.filter(set=>set.exerciseId===selected.id);
    const allSets=sessions.flatMap(log=>log.performances.filter(set=>set.exerciseId===selected.id));
    const strongest=(sets:SetPerformance[])=>sets.reduce<SetPerformance|null>((best,set)=>!best||set.weightKg>best.weightKg||set.weightKg===best.weightKg&&set.reps>best.reps?set:best,null);
    return {sessions:sessions.length,lastDate:lastSession.date,latest:strongest(latestSets),best:strongest(allSets),lastRating:lastSession.rating||"right"};
  },[history,selected]);

  const buildPlan = (e?: FormEvent,prompt=request,options?:{focus?:Focus;randomize?:boolean;body?:BuildArea}) => {
    e?.preventDefault();
    setVoiceError(null);
    setBuilding(true);
    const fullPrompt=advancedProfileActive&&advancedProfile.notes.trim()?`${prompt} ${advancedProfile.notes}`:prompt;
    const parsedRequest=parseWorkoutRequest(fullPrompt,{duration,focus,equipment,level,goal:trainingGoal});
    const parsed={...parsedRequest,focus:options?.focus??parsedRequest.focus} as {duration:number;focus:Focus;equipment:Equipment;level:Level;goal:TrainingGoal;intensity?:"light"|"normal"|"hard";excludedExercises?:string[];understood:boolean};
    const adjustment=adjustNextWorkout({durationMinutes:parsed.duration,focus:parsed.focus,intensity:parsed.intensity,preserveFocus:Boolean(fullPrompt.trim()||options?.focus||options?.body)},history);
    parsed.duration=adjustment.durationMinutes;parsed.focus=adjustment.focus as Focus;
    const effectiveNovice=parsed.level==="beginner"||advancedProfileActive&&advancedProfile.experience==="new";
    setDuration(parsed.duration);setFocus(parsed.focus);setEquipment(parsed.equipment);setLevel(parsed.level);setTrainingGoal(parsed.goal);setNoviceMode(effectiveNovice);
    const beginnerNext=parsed.equipment==="bodyweight"?beginnerBodyweightPlans[parsed.focus]:parsed.equipment==="dumbbell"?beginnerDumbbellPlans[parsed.focus]:beginnerPlans[parsed.focus];
    const abilityAdjusted=pushAbility==="ready"?beginnerNext.map(x=>x==="Incline_Push-Up"?"Pushups":x):beginnerNext;
    const skillAdjusted=abilityAdjusted.map(id=>{
      const path=skillPaths.find(item=>item.levels.includes(id));
      if(!path)return id;
      const pushFloor=pushAbility==="ready"?3:pushAbility==="few"?2:0;
      const requestedLevel=path.id==="push"?Math.max(pushFloor,skillLevels.push):skillLevels[path.id];
      return path.levels[Math.min(requestedLevel,path.levels.length-1)];
    });
    const standardTarget=exerciseTargetForDuration(parsed.duration);
    const profileTargetCount=advancedProfileActive
      ?advancedProfile.recovery==="low"
        ?Math.max(3,standardTarget-1)
        :advancedProfile.weeklyDays<=2&&parsed.focus==="full"
          ?Math.min(6,standardTarget+1)
          :advancedProfile.weeklyDays>=5
            ?Math.max(3,standardTarget-1)
            :standardTarget
      :standardTarget;
    const targetCount=Math.max(2,Math.min(8,profileTargetCount+adjustment.exerciseDelta));
    const advancedExclusions=advancedProfileActive?advancedProfile.painAreas.flatMap(area=>painAreaExclusions[area]):[];
    const requestExclusions=exerciseLibrary.filter(exercise=>(parsed.excludedExercises||[]).some(excluded=>`${exercise.id} ${exercise.zh} ${exercise.en}`.toLowerCase().includes(excluded.toLowerCase()))).map(exercise=>exercise.id);
    const excludedIds=[...new Set([...mobilityIds,...advancedExclusions,...requestExclusions])];
    const basePlan = effectiveNovice ? skillAdjusted : parsed.equipment === "bodyweight" ? bodyweightPlans[parsed.focus] : parsed.equipment === "dumbbell" ? dumbbellPlans[parsed.focus] : workoutPlans[parsed.focus];
    const focusBodies:Record<Focus,BodyPart[]>={full:["chest","back","shoulders","arms","lower","core"],upper:["chest","back","shoulders","arms","core"],lower:["lower","core"],pushpull:["chest","back","shoulders","arms"],core:["core"]};
    const selectedLowerTarget=isLowerTarget(options?.body)?options.body:null;
    const selectedSpecificTarget=isSpecificTarget(options?.body)?options.body:null;
    const matchesRequestedArea=(exercise:LibraryExercise)=>!options?.body||(selectedLowerTarget?lowerTargetMatchers[selectedLowerTarget](exercise):selectedSpecificTarget?specificTargetMatchers[selectedSpecificTarget as Exclude<SpecificTarget,LowerTarget>](exercise):exercise.body===options.body);
    const randomPool=shuffle(exerciseLibrary.filter(exercise=>focusBodies[parsed.focus].includes(exercise.body)&&matchesRequestedArea(exercise)&&!excludedIds.includes(exercise.id)&&latestRatingByExercise[exercise.id]!=="pain"&&matchesAvailableEquipment(exercise,parsed.equipment)&&(!effectiveNovice||exercise.level==="beginner")).map(exercise=>exercise.id));
    const recentlyTrainedIds=new Set(history.slice(0,2).flatMap(log=>(log.performances||[]).map(set=>set.exerciseId)));
    const freshRandomPool=randomPool.filter(id=>!recentlyTrainedIds.has(id));
    const diversifiedRandomPool=diversifyExerciseIds(freshRandomPool.length>=targetCount?freshRandomPool:randomPool,exerciseLibrary,targetCount);
    const candidatePlan=options?.randomize&&diversifiedRandomPool.length?diversifiedRandomPool:basePlan;
    const tailored=personalizePlan(candidatePlan,exerciseLibrary,{ratings:latestRatingByExercise,favoriteIds,easierById:easierMove,excludedIds,equipment:parsed.equipment,novice:effectiveNovice,focus:parsed.focus,targetCount});
    const safeFallback=candidatePlan.filter(id=>!excludedIds.includes(id)&&latestRatingByExercise[id]!=="pain"&&matchesAvailableEquipment(ids[id],parsed.equipment)).slice(0,targetCount);
    const plannedIds=tailored.ids.length?tailored.ids:safeFallback;
    const focusExercise=focusExerciseId?ids[focusExerciseId]:null;
    const focusExerciseFits=Boolean(focusExercise&&focusBodies[parsed.focus].includes(focusExercise.body)&&!excludedIds.includes(focusExercise.id)&&latestRatingByExercise[focusExercise.id]!=="pain"&&matchesAvailableEquipment(focusExercise,parsed.equipment)&&(!effectiveNovice||focusExercise.level==="beginner"));
    const prioritizedIds=focusExerciseFits&&focusExercise?[focusExercise.id,...plannedIds.filter(id=>id!==focusExercise.id)].slice(0,targetCount):plannedIds;
    window.setTimeout(() => {
      const generated=generateWorkout({userId:LOCAL_LOG_USER_ID,focusArea:parsed.focus,estimatedMinutes:parsed.duration,intensity:adjustment.intensity,goal:parsed.goal,novice:effectiveNovice,setDelta:adjustment.setDelta,adjustmentReason:adjustment.adjustmentReason,exercises:prioritizedIds.map(id=>ids[id]).filter(Boolean).map(exercise=>{const rx=prescribe(exercise,parsed.goal,effectiveNovice);return {id:exercise.id,name:exercise.en,nameZh:exercise.zh,reps:rx.reps,restSeconds:rx.restSeconds,notes:exercise.cuesZh[0]||exercise.mistakeZh}})});
      setGeneratedWorkout(generated);void saveGeneratedWorkout(generated);
      setTodaySession(null);setPlanSetCounts(generated.exercises.map(exercise=>exercise.sets));setPlanIds(generated.exercises.map(exercise=>exercise.id));setPlanPersonalization({favoritesUsed:tailored.favoritesUsed.length,painSwaps:tailored.painSwaps.length,historyAware:history.length>0,targetCount,advanced:advancedProfileActive,weeklyDays:advancedProfileActive?advancedProfile.weeklyDays:undefined,targetArea:options?.body,focusExerciseId:focusExerciseFits&&focusExercise?focusExercise.id:undefined,adjustmentReason:adjustment.adjustmentReason,intensity:adjustment.intensity});setCompleted({});setBuilding(false);setSheet(null);setTab("plan");
    },900);
  };
  const listen = () => {
    if(listening&&recognition.current){recognition.current.stop();return}
    type Recognition={lang:string;interimResults:boolean;continuous:boolean;onresult:(event:{results:ArrayLike<{0:{transcript:string}}>})=>void;onerror:(event:{error:string})=>void;onend:()=>void;start:()=>void;stop:()=>void};
    const speechWindow=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
    const SR=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    setVoiceError(null);
    if(!SR){setListening(false);setVoiceError("unsupported");setSheet("builder");return}
    let transcript="";
    let failed=false;
    const r=new SR();
    r.lang=language==="zh"?"zh-CN":"en-US";
    r.interimResults=true;
    r.continuous=false;
    r.onresult=event=>{transcript=Array.from(event.results).map(result=>result[0].transcript).join("").trim();setRequest(transcript)};
    r.onerror=event=>{failed=true;setListening(false);setVoiceError(event.error==="not-allowed"||event.error==="service-not-allowed"?"denied":event.error==="network"?"network":"no-speech");setSheet("builder")};
    r.onend=()=>{setListening(false);recognition.current=null;if(failed)return;if(transcript)buildPlan(undefined,transcript);else {setVoiceError("no-speech");setSheet("builder")}};
    recognition.current=r;
    setListening(true);
    try{r.start()}catch{failed=true;setListening(false);setVoiceError("unsupported");recognition.current=null}
  };
  useEffect(()=>{
    const handleHomeVoice=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target?.closest(".one-tap-voice"))return;
      event.preventDefault();
      event.stopPropagation();
      listen();
    };
    document.addEventListener("click",handleHomeVoice,true);
    return()=>document.removeEventListener("click",handleHomeVoice,true);
  },[listen]);
  const openExercise = (ex:LibraryExercise) => { setRecentExerciseIds(current=>[ex.id,...current.filter(id=>id!==ex.id)].slice(0,6)); setSelected(ex); setSheet("exercise"); };
  const toggleFavorite=(id:string)=>setFavoriteIds(current=>current.includes(id)?current.filter(item=>item!==id):[id,...current].slice(0,50));
  const toggleFocusExercise=(id:string)=>setFocusExerciseId(current=>current===id?null:id);
  const detachSavedPlan=()=>{setTodaySession(null);setPlanSetCounts([]);setPlanPersonalization(current=>current?{...current,aiSaved:false}:current)};
  const togglePlan=(id:string)=>{detachSavedPlan();setPlanIds(current=>current.includes(id)?current.length>1?current.filter(item=>item!==id):current:current.length<10?[...current,id]:current)};
  const swap = (id:string) => { if (!selected) return;detachSavedPlan();setPlanIds(current => current.includes(selected.id)?current.includes(id)?current.filter(item=>item!==selected.id):current.map(item=>item===selected.id?id:item):current.includes(id)||current.length>=10?current:[...current,id]); setSheet(null); };
  const makeEasier=(ex:LibraryExercise)=>{
    const replacement=easierMove[ex.id]||ex.alternatives[0];
    const replacementExercise=replacement?ids[replacement]:null;
    const replacementIndex=planIds.indexOf(ex.id);
if(!replacementExercise||!matchesAvailableEquipment(replacementExercise,equipment))return;
    detachSavedPlan();
    if(workoutMode&&replacementIndex>=0){
      setPlanSetCounts(workout.map((_,index)=>setCountFor(index)));
      setWorkoutLearning(true);
      const targetReps=prescribe(replacementExercise,trainingGoal,noviceMode).reps.match(/\d+/)?.[0]||"8";
      setSetInputs(current=>{
        const updated={...current};
        for(const key of Object.keys(updated))if(key.startsWith(`${replacementIndex}-`)&&!completed[key])updated[key]={weight:replacementExercise.gear==="bodyweight"?"0":"",reps:targetReps};
        return updated;
      });
    }
    setPlanIds(current=>current.map(id=>id===ex.id?replacementExercise.id:id));
  };
  const smartSwap = (ex:LibraryExercise) => {
    const gearFits=(candidate:LibraryExercise)=>matchesAvailableEquipment(candidate,equipment);
    const levelFits=(candidate:LibraryExercise)=>!noviceMode||candidate.level==="beginner";
    const reverseAlternatives=exerciseLibrary.filter(candidate=>candidate.alternatives.includes(ex.id)).map(candidate=>candidate.id);
    const sameBody=exerciseLibrary.filter(candidate=>candidate.body===ex.body).map(candidate=>candidate.id);
    const ordered=[...ex.alternatives,...reverseAlternatives,...sameBody];
    const unique=[...new Set(ordered)].map(id=>ids[id]).filter((candidate):candidate is LibraryExercise=>Boolean(candidate)&&candidate.id!==ex.id&&gearFits(candidate)&&levelFits(candidate));
    const available=unique.filter(candidate=>!planIds.includes(candidate.id));
    setSwapTarget(ex);
    setSwapOptions((available.length?available:unique).slice(0,3));
  };
  const chooseSmartSwap=(replacement:LibraryExercise)=>{if(!swapTarget)return;detachSavedPlan();setPlanIds(current=>current.map(id=>id===swapTarget.id?replacement.id:id));setSwapTarget(null);setSwapOptions([])};
  const buildCorrectivePlan=(source:CorrectionSource,metricKeys:string[],startCycle=true)=>{
    const targetFocus:Focus=source==="form"?"lower":"full";
    const fallback=equipment==="bodyweight"?beginnerBodyweightPlans[targetFocus]:equipment==="dumbbell"?beginnerDumbbellPlans[targetFocus]:beginnerPlans[targetFocus];
    const discomfortExclusions=advancedProfileActive?advancedProfile.painAreas.flatMap(area=>painAreaExclusions[area]):[];
    const {ids:chosen,priorities}=buildCorrectiveExerciseIds({source,metricKeys,equipment,exercises:exerciseLibrary,fallbackIds:[...fallback,...beginnerBodyweightPlans[targetFocus]],excludedIds:discomfortExclusions,ratings:latestRatingByExercise,targetCount:5});
    if(!chosen.length){setSheet("builder");setBuilderMode("advanced");return}
    if(startCycle){const baseline=readScanRecords().find((record:{type?:string})=>record.type===source);if(baseline){const cycle=startCorrectionCycle({source,metricKeys:priorities,baselineScore:baseline.score,baselineScanId:baseline.id});if(cycle)trackProductEvent("correction_cycle_started",{source,baselineScore:cycle.baselineScore,targetWorkouts:cycle.targetWorkouts,rescanAfterDays:7,priority:priorities[0]||"unknown"})}}
    trackProductEvent("corrective_plan_built",{source,priority:priorities[0]||"unknown",priorityCount:priorities.length,exerciseCount:chosen.length,equipment});
    setTodaySession(null);setPlanSetCounts([]);setPlanIds(chosen);setDuration(25);setFocus(targetFocus);setLevel("beginner");setTrainingGoal("general");setNoviceMode(true);setBuilderMode("advanced");setPlanPersonalization({favoritesUsed:chosen.filter(id=>favoriteIds.includes(id)).length,painSwaps:0,historyAware:history.length>0,targetCount:chosen.length,advanced:true,correctionSource:source,correctionMetrics:priorities});setCompleted({});setSheet(null);setTab("plan");
  };
  const beginWorkout = () => {
    setWorkoutLearning(true);
    const initial:Record<string,SetInput>={};
    workout.forEach((exercise,exercisePosition)=>{
      const saved=todaySession?.exercises[exercisePosition];
      const fallback=saved?String(saved.repsMax):prescribe(exercise,trainingGoal,noviceMode).reps.match(/\d+/)?.[0]||"8";
      const setsForExercise=setCountFor(exercisePosition);
      for(let i=0;i<setsForExercise;i++){
        const previous=previousSets[`${exercise.id}-${i+1}`];
        const savedWeight=saved?.weightKg&&saved.weightKg>0?String(saved.weightKg):"";
        initial[`${exercisePosition}-${i}`]={weight:previous?String(previous.weightKg):(savedWeight||(exercise.gear==="bodyweight"?"0":"")),reps:previous?String(previous.reps):fallback};
      }
    });
    trackProductEvent("workout_started",{source:"workout",planType:planPersonalization?.aiSaved?"ai_saved":planPersonalization?.correctionSource?"corrective":"generated",scanType:planPersonalization?.correctionSource||"none",duration,exerciseCount:workout.length});
    setActiveWorkoutId(crypto.randomUUID());setResumeDraft(null);setSetInputs(initial); setWorkoutMode(true); setWorkoutPaused(false); setExerciseIndex(0); setSetIndex(0); setSeconds(0); setRestRemaining(0); setCompleted({});
  };
  const clearSessionDraft=()=>{clearActiveWorkout(SESSION_STORAGE_KEY);setResumeDraft(null);setActiveWorkoutId(null)};
  const resumeSavedWorkout=()=>{
    if(!resumeDraft)return;
    setWorkoutLearning(true);
    setPlanIds(resumeDraft.planIds);setDuration(resumeDraft.duration);setFocus(resumeDraft.focus);setEquipment(resumeDraft.equipment);setLevel(resumeDraft.level);setTrainingGoal(resumeDraft.goal);setNoviceMode(resumeDraft.noviceMode);
    setPlanSetCounts(Array.isArray(resumeDraft.setCounts)?resumeDraft.setCounts:[]);setActiveWorkoutId(resumeDraft.activeWorkoutId||crypto.randomUUID());setExerciseIndex(resumeDraft.exerciseIndex);setSetIndex(resumeDraft.setIndex);setSeconds(Math.round(resumeDraft.seconds));setRestRemaining(Math.round(resumeDraft.restRemaining));setSetInputs(resumeDraft.setInputs);setCompleted(resumeDraft.completed);
    setResumeDraft(null);setWorkoutPaused(true);setWorkoutMode(true);
  };
  const updateSetInput = (key:string,field:keyof SetInput,value:string) => setSetInputs(current=>({...current,[key]:{...(current[key]||{weight:"",reps:""}),[field]:value}}));
  const completeSet = () => {
    if(workoutPaused||restRemaining>0||completed[`${exerciseIndex}-${setIndex}`])return;
    if(!validSetInput(setInputs[`${exerciseIndex}-${setIndex}`],workout[exerciseIndex].gear==="bodyweight"))return;
    setWorkoutLearning(true);
    const key = `${exerciseIndex}-${setIndex}`; const input=setInputs[key];setCompleted(v => ({...v,[key]:true}));
    if(activeWorkoutId&&input){void fetch("/api/workouts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"log_set",workoutId:activeWorkoutId,exerciseId:workout[exerciseIndex].id,setNumber:setIndex+1,weightKg:Math.max(0,Number(input.weight)||0),reps:Math.max(1,Math.round(Number(input.reps)||1)),focus})}).catch(()=>{/* local session draft remains the source of truth until finish */})}
    if(!lastSet()) setRestRemaining(prescribe(workout[exerciseIndex],trainingGoal,noviceMode).restSeconds);
    const setsForExercise=setCountFor(exerciseIndex);
    if (setIndex + 1 < setsForExercise) setSetIndex(v => v + 1);
    else if (exerciseIndex + 1 < workout.length) { setExerciseIndex(v => v + 1); setSetIndex(0); }
  };
  const lastSet=()=>exerciseIndex===workout.length-1&&setIndex===setCountFor(exerciseIndex)-1;
  const finishWorkout = async (feedback:WorkoutFeedbackInput,summaryOnly=false) => {
    const rating:SessionRating=feedback.difficulty<=4?"easy":feedback.difficulty>=9?"hard":"right";
    const loggedAt=new Date().toISOString();
    const storedToday=await getTodayLog(LOCAL_LOG_USER_ID);
    const historyToday=history.find(item=>sameWorkoutDay(item.date,loggedAt));
    const previous=historyToday||(storedToday?fromStoredWorkout(storedToday):null);
    const measuredSets:SetPerformance[]=feedback.completed&&!summaryOnly?workout.flatMap((exercise,exercisePosition)=>Array.from({length:setCountFor(exercisePosition)},(_,setPosition)=>{
      if(!completed[`${exercisePosition}-${setPosition}`])return null;
      const input=setInputs[`${exercisePosition}-${setPosition}`];
      return {exerciseId:exercise.id,setNumber:setPosition+1,weightKg:Math.max(0,Number(input?.weight)||0),reps:Math.max(1,Math.round(Number(input?.reps)||1))};
    }).filter((set):set is SetPerformance=>set!==null)):[];
    const measurements=workoutMeasurements({summaryOnly,didComplete:feedback.completed,previous,performances:measuredSets,seconds});
    const performances:SetPerformance[]=measurements.performances;
    const actualDuration=measurements.duration;
    const totalVolume=Math.round(performances.reduce((sum,set)=>sum+set.weightKg*set.reps,0)*10)/10;
    const optimisticId=historyToday?.id||storedToday?.workoutId||activeWorkoutId||generatedWorkout?.id||crypto.randomUUID();
    const log:WorkoutLog={id:optimisticId,date:loggedAt,focus:summaryOnly&&previous?.performances.length?previous.focus:focus,duration:actualDuration,exercises:feedback.completed?(summaryOnly&&previous?.performances.length?previous.exercises:workout.length):0,sets:performances.length,totalVolume,rating,performances,completed:feedback.completed,perceivedDifficulty:feedback.difficulty,energyLevel:feedback.energy,sorenessLevel:feedback.soreness,notes:feedback.notes,pending:true};
    const priorPerformances=history.filter(item=>item.id!==optimisticId).flatMap(item=>item.performances||[]);
    const highlights=Array.from(new Set(performances.map(item=>item.exerciseId))).map(exerciseId=>{
      const currentBest=bestPerformance(performances,exerciseId);
      const priorBest=bestPerformance(priorPerformances,exerciseId);
      if(!currentBest||!priorBest||!comparePerformance(currentBest,priorBest))return null;
      const kind=currentBest.weightKg>priorBest.weightKg?"weight":"reps" as const;
      return {exerciseId,performance:currentBest,kind,delta:kind==="weight"?currentBest.weightKg-priorBest.weightKg:currentBest.reps-priorBest.reps};
    }).filter((item):item is PersonalBestHighlight=>Boolean(item)).sort((a,b)=>b.performance.weightKg-a.performance.weightKg||b.performance.reps-a.performance.reps).slice(0,2);
    await queuePendingWorkout(log);
    trackProductEvent(feedback.completed?"workout_completed":"workout_missed",{source:summaryOnly?"quick_log":"workout",planType:planPersonalization?.aiSaved?"ai_saved":planPersonalization?.correctionSource?"corrective":"generated",scanType:planPersonalization?.correctionSource||"none",duration:actualDuration,exerciseCount:feedback.completed?workout.length:0,setCount:performances.length,rating});
    if(feedback.completed&&planPersonalization?.correctionSource){const cycle=recordCorrectionWorkout(log.date);if(cycle)trackProductEvent("correction_cycle_workout_completed",{source:planPersonalization.correctionSource,workoutsCompleted:cycle.workoutsCompleted,targetWorkouts:cycle.targetWorkouts,rating})}
    clearSessionDraft();
    setHistory(current=>[log,...current.filter(item=>item.id!==log.id&&!sameWorkoutDay(item.date,log.date))].slice(0,30));
    setTodayLog(log);
    setSyncState("saving"); setCompletionHighlights(highlights); setCompletedWorkout(summaryOnly?null:log); setWorkoutMode(false); setTab(summaryOnly?"plan":"progress");
    // Local persistence has succeeded. A slow/offline cloud must not hold the form open.
    void flushPendingWorkouts();
  };
  const chooseSkillLevel = (skill:MovementSkill,index:number,id:string) => {
    setSkillLevels(current=>({...current,[skill]:index}));
    if(selected)setPlanIds(current=>current.map(item=>item===selected.id?id:item));
    setSelected(ids[id]||selected);
  };
  const formatTime = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;

  if (workoutMode) return <WorkoutMode equipment={equipment} t={t} language={language} workout={workout} exerciseIndex={exerciseIndex} setIndex={setIndex} setCounts={workout.map((_,index)=>setCountFor(index))} goal={trainingGoal} noviceMode={noviceMode} learning={workoutLearning} onLearningChange={setWorkoutLearning} paused={workoutPaused} togglePause={()=>setWorkoutPaused(value=>!value)} completed={completed} setInputs={setInputs} previousSets={previousSets} latestRatingByExercise={latestRatingByExercise} time={formatTime} restRemaining={restRemaining} addRest={()=>setRestRemaining(value=>value+15)} skipRest={()=>setRestRemaining(0)} onClose={()=>{clearSessionDraft();setWorkoutMode(false);setWorkoutPaused(false);setRestRemaining(0)}} onDetails={openExercise} onEasier={makeEasier} onInput={updateSetInput} onComplete={completeSet} onFinish={finishWorkout}/>;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><strong>练一下<br/><small>ONE SET</small></strong></div>
      <nav>{primaryNavigation.map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)} aria-current={tab===item.id?"page":undefined}><span className="nav-icon"><AppIcon name={item.icon}/></span><span>{t.tabs[item.copyIndex]}</span>{item.id==="plan"&&planPersonalization?.correctionSource&&<b/>}</button>)}</nav>
      <button className="mini-profile" onClick={()=>setTab("profile")}><span>{profileBadge}</span><div><strong>{profileName}</strong><small> · ONE SET ATHLETE</small></div><i>›</i></button>
    </aside>
    <section className="app-main">
      <header className="app-topbar"><div className="mobile-brand">练一下<span>· ONE SET</span></div><div className="top-context"><span>{t.tabs[primaryNavigation.find(item=>item.id===tab)?.copyIndex??(tab==="profile"?4:2)]}</span><i>/</i><b suppressHydrationWarning>{todayDate}</b></div><div className="top-actions"><div className="lang"><button className={language==="zh"?"active":""} onClick={()=>setLanguage("zh")}>中</button><button className={language==="en"?"active":""} onClick={()=>setLanguage("en")}>EN</button></div><button className="avatar" onClick={()=>setTab("profile")} aria-label={language==="zh"?"打开体能档案":"Open profile"}>{profileBadge}</button></div></header>
      <div className="page-scroll">
        {tab==="today"&&<>{nextWorkoutDate&&<NextWorkoutBooking language={language} date={nextWorkoutDate}/>}
          {todayLog&&<button className={`today-log-confirmation ${todayLog.completed?"done":"missed"}`} onClick={()=>setTab("plan")}><span><small>ONE SET · TODAY</small><strong>{todayLog.completed?(language==="zh"?"今天已完成":"Completed today"):(language==="zh"?"今天记录为未完成":"Marked incomplete today")}</strong><em>{language==="zh"?"记录已保存在此设备 · 点击查看或更新":"Saved on this device · View or update"}</em></span><b>→</b></button>}
          {todaySession?<FormTodayHome language={language} t={t} todaySession={todaySession} workout={workout} duration={duration} setDuration={setDuration} focus={focus} start={beginWorkout} openPlan={()=>setTab("plan")} openBuilder={()=>setSheet("builder")} quickBuild={nextFocus=>buildPlan(undefined,"",{focus:nextFocus,randomize:true})} openProgress={()=>setTab("progress")}/>:<OneTapHome language={language} history={history} equipment={equipment} setEquipment={setEquipment} request={request} setRequest={setRequest} submitRequest={()=>buildPlan(undefined,request)} listening={listening} voiceTranscript={listening?request:""} listen={listen} t={t} duration={duration} setDuration={setDuration} focus={focus} noviceMode={noviceMode} setNoviceMode={value=>{setNoviceMode(value);setLevel(value?"beginner":"intermediate")}} building={building} advancedReady={advancedProfileActive} build={(nextFocus,body)=>buildPlan(undefined,"",{focus:nextFocus,body,randomize:true})} openBuilder={()=>setSheet("builder")} openAdvanced={()=>{setBuilderMode("advanced");setSheet("builder")}}/>}
        </>}
        {tab==="plan"&&<Plan
          t={t} language={language} workout={workout} duration={duration} focus={focus} targetArea={planPersonalization?.targetArea} equipment={equipment} goal={trainingGoal}
          setCounts={workout.map((_,index)=>setCountFor(index))} noviceMode={noviceMode} personalization={planPersonalization} history={history} todayLog={todayLog}
          canLog={Boolean(generatedWorkout?.exercises.length||todaySession?.exercises.length||planPersonalization)} quickLogOpen={quickLogOpen} quickLogSaving={quickLogSaving}
          setNoviceMode={value=>{setNoviceMode(value);setLevel(value?"beginner":"intermediate")}} openOnboarding={()=>setSheet("onboarding")} openBuilder={()=>setSheet("builder")} openWarmup={()=>setSheet("warmup")} openExercise={openExercise}
          makeEasier={makeEasier} smartSwap={smartSwap} start={beginWorkout} complete={()=>setQuickLogOpen(true)} cancelLog={()=>setQuickLogOpen(false)}
          saveLog={async feedback=>{setQuickLogSaving(true);try{await finishWorkout(feedback,true);setQuickLogOpen(false)}finally{setQuickLogSaving(false)}}}
        />}
        {tab==="library"&&<Library t={t} language={language} query={query} setQuery={setQuery} filter={bodyFilter} setFilter={setBodyFilter} targetFilter={libraryTarget} setTargetFilter={setLibraryTarget} gearFilter={gearFilter} setGearFilter={setGearFilter} libraryType={libraryType} setLibraryType={setLibraryType} favoriteIds={favoriteIds} recentIds={recentExerciseIds} exercises={filtered} openExercise={openExercise}/>}
        {tab==="progress"&&<Progress t={t} language={language} syncState={syncState} history={history} weeklyGoal={weeklyGoal} openPlan={()=>setTab("plan")} openToday={()=>setTab("today")} buildFocused={focus=>buildPlan(undefined,"",{focus,randomize:true})} openScan={()=>setSheet("scan")} openPosture={()=>setSheet("posture")} resumeCorrection={(source,metricKeys)=>buildCorrectivePlan(source,metricKeys,false)}/>}
        {tab==="profile"&&<div className="profile-shell"><button className="profile-progress-cta" onClick={()=>setTab("progress")}><span><small>{language==="zh"?"持续你的训练轨迹":"KEEP YOUR MOMENTUM"}</small><strong>{language==="zh"?"查看训练进度与趋势":"View progress and trends"}</strong></span><b>→</b></button><Profile t={t} language={language} setLanguage={setLanguage} history={history} syncState={syncState} name={profileName} goal={trainingGoal} weeklyGoal={weeklyGoal} equipment={equipment} edit={()=>setSheet("profile")} connect={()=>setSheet("integration")} openData={()=>setSheet("data")} openFeedback={()=>setSheet("feedback")}/></div>}
      </div>
    </section>
    <nav className="bottom-nav" aria-label={language==="zh"?"主导航":"Primary navigation"}>{primaryNavigation.map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)} aria-current={tab===item.id?"page":undefined}><span className="nav-icon"><AppIcon name={item.icon}/></span><span>{t.tabs[item.copyIndex]}</span></button>)}</nav>
    {resumeDraft&&<ResumeSessionPrompt language={language} draft={resumeDraft} resume={resumeSavedWorkout} discard={clearSessionDraft}/>}
     {completedWorkout&&<WorkoutCompletionSheet language={language} workout={completedWorkout} highlights={completionHighlights} close={()=>{setCompletedWorkout(null);setCompletionHighlights([]);setTab("progress")}} planNext={date=>{setNextWorkoutDate(date);setCompletedWorkout(null);setCompletionHighlights([]);setTab("today")}} repeat={()=>{setCompletedWorkout(null);setCompletionHighlights([]);window.setTimeout(beginWorkout,0)}}/>}
    {sheet==="builder"&&<Builder t={t} language={language} mode={builderMode} setMode={setBuilderMode} advanced={advancedProfile} setAdvanced={setAdvancedProfile} duration={duration} setDuration={setDuration} focus={focus} setFocus={setFocus} equipment={equipment} setEquipment={setEquipment} level={level} setLevel={setLevel} goal={trainingGoal} setGoal={setTrainingGoal} request={request} setRequest={setRequest} listening={listening} voiceError={voiceError} listen={listen} buildPlan={buildPlan} building={building} close={()=>setSheet(null)}/>}
    {sheet==="warmup"&&<WarmupSheet language={language} moves={warmupMoves} close={()=>setSheet(null)} startWorkout={()=>{setSheet(null);beginWorkout()}}/>}
    {sheet==="onboarding"&&<Onboarding t={t} language={language} noviceMode={noviceMode} setNoviceMode={value=>{setNoviceMode(value);setLevel(value?"beginner":"intermediate")}} ability={pushAbility} setAbility={setPushAbility} equipment={equipment} setEquipment={setEquipment} build={()=>buildPlan(undefined,"新手")} close={()=>setSheet(null)}/>}
    {sheet==="profile"&&<ProfileEditor language={language} name={profileName} goal={trainingGoal} weeklyGoal={weeklyGoal} equipment={equipment} save={(nextName,nextGoal,nextWeeklyGoal,nextEquipment)=>{setProfileName(nextName);setTrainingGoal(nextGoal);setWeeklyGoal(nextWeeklyGoal);setEquipment(nextEquipment);setSheet(null)}} close={()=>setSheet(null)}/>}
    {sheet==="integration"&&<IntegrationSheet language={language} close={()=>setSheet(null)}/>}
    {sheet==="data"&&<DataControlsSheet language={language} close={()=>setSheet(null)}/>}
    {sheet==="feedback"&&<BetaFeedbackSheet language={language} page={tab} close={()=>setSheet(null)}/>}
    {sheet==="scan"&&<FormScanner language={language} close={()=>setSheet(null)} openWorkout={metricKeys=>buildCorrectivePlan("form",metricKeys)}/>}
    {sheet==="posture"&&<PhotoScanner language={language} close={()=>setSheet(null)} openWorkout={metricKeys=>buildCorrectivePlan("posture",metricKeys)}/>}
    {sheet==="exercise"&&selected&&<ExerciseSheet t={t} language={language} exercise={selected} skillLevels={skillLevels} chooseSkillLevel={chooseSkillLevel} stats={selectedStats} favorite={favoriteIds.includes(selected.id)} focused={focusExerciseId===selected.id} inPlan={planIds.includes(selected.id)} planCount={planIds.length} toggleFavorite={()=>toggleFavorite(selected.id)} toggleFocus={()=>toggleFocusExercise(selected.id)} togglePlan={()=>togglePlan(selected.id)} start={()=>{setSheet(null);beginWorkout()}} close={()=>setSheet(null)} swap={swap}/>}
    {swapTarget&&<PlanSwapSheet language={language} original={swapTarget} options={swapOptions} choose={chooseSmartSwap} close={()=>{setSwapTarget(null);setSwapOptions([])}}/>}
  </main>;
}

type Copy = typeof text.zh | typeof text.en;
function ExerciseImage({ex,className="",priority=false}:{ex:LibraryExercise;className?:string;priority?:boolean}) {
  const[videoUnavailable,setVideoUnavailable]=useState(false);
  const tutorial=getExerciseTutorial(ex.id);
  const showControls=className.includes("sheet-motion")||className.includes("focus-motion");
  const isTeachingPreview=className.includes("exercise-preview")||className.includes("cover-motion");
  const autoPlayVideo=priority||showControls||isTeachingPreview;
  const videoSrc=tutorial?.src||`/exercises/videos/${ex.image}.mp4`;
  const poster=tutorial?.poster||`/exercises/${ex.image}-0.jpg`;
  return <span className={`exercise-dual-image ${className} ${videoUnavailable?"video-fallback":"video-ready"} ${tutorial?"coach-footage":"movement-preview"}`} role="img" aria-label={`${ex.en} movement demonstration`} data-motion-format={videoUnavailable?"still":tutorial?"coach-video":"preview-video"}>
    <video className="exercise-video" muted loop autoPlay={autoPlayVideo} playsInline controls={showControls} controlsList={showControls?"nodownload noplaybackrate":"nodownload"} preload={autoPlayVideo?"metadata":"none"} poster={poster} onError={()=>setVideoUnavailable(true)} aria-label={`${ex.en} movement demonstration`}><source src={videoSrc} type="video/mp4"/></video>
    <img className="exercise-frame" src={tutorial?.poster||`/exercises/${ex.image}-0.jpg`} alt={`${ex.en} start position`} loading={priority?"eager":"lazy"} decoding="async" draggable={false}/><img className="exercise-frame" src={tutorial?.poster||`/exercises/${ex.image}-1.jpg`} alt={`${ex.en} finish position`} loading={priority?"eager":"lazy"} decoding="async" draggable={false}/><b><i/>{videoUnavailable?"STILL · GUIDE":tutorial?"COACH · VIDEO":"MOTION · PREVIEW"}</b>
  </span>;
}

function ShortVideoLesson({exercise,language,hasEasier=false,onUseEasier,onContinue,continueLabel}:{exercise:LibraryExercise;language:Language;hasEasier?:boolean;onUseEasier?:()=>void;onContinue:()=>void;continueLabel:string}) {
  const videoRef=useRef<HTMLVideoElement>(null);
  const tutorial=getExerciseTutorial(exercise.id);
  const[videoUnavailable,setVideoUnavailable]=useState(false);
  const[playing,setPlaying]=useState(false);
  const[lessonStage,setLessonStage]=useState(0);
  const[currentTime,setCurrentTime]=useState(0);
  const[videoDuration,setVideoDuration]=useState(tutorial?.durationSeconds||0);
  const[playbackRate,setPlaybackRate]=useState<.5|1>(1);
  const[mirrored,setMirrored]=useState(false);
  const[practiceMode,setPracticeMode]=useState<"idle"|"countdown"|"active"|"feedback"|"done">("idle");
  const[countdown,setCountdown]=useState(3);
  const[practiceRep,setPracticeRep]=useState(0);
  const[practiceSeconds,setPracticeSeconds]=useState(20);
  const[practiceFeeling,setPracticeFeeling]=useState<"hard"|"right"|"easy"|null>(null);
  const zh=language==="zh";
  const steps=zh?exercise.stepsZh:exercise.stepsEn;
  const cues=zh?exercise.cuesZh:exercise.cuesEn;
  const videoSrc=tutorial?.src||`/exercises/videos/${exercise.image}.mp4`;
  const poster=tutorial?.poster||`/exercises/${exercise.image}-0.jpg`;
  const togglePlayback=()=>{
    const video=videoRef.current;
    if(!video)return;
    if(video.paused){void video.play();}else video.pause();
  };
  const replay=()=>{
    const video=videoRef.current;
    if(!video)return;
    video.currentTime=0;
    void video.play();
  };
  const toggleSpeed=()=>{
    const next=playbackRate===1?.5:1;
    setPlaybackRate(next);
    if(videoRef.current)videoRef.current.playbackRate=next;
  };
  const formatVideoTime=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`;
  const lessonSteps=[
    {label:zh?"准备":"SET UP",copy:steps[0]},
    {label:zh?"动作":"MOVE",copy:cues[0]},
    {label:zh?"完成":"FINISH",copy:steps[steps.length-1]},
  ];
  const selectStage=(index:number)=>{
    const video=videoRef.current;
    setLessonStage(index);
    if(!video||!Number.isFinite(video.duration)||video.duration<=0)return;
    video.currentTime=video.duration*([0,.38,.76][index]??0);
    void video.play();
  };
  const syncLessonStage=(event:SyntheticEvent<HTMLVideoElement>)=>{
    const video=event.currentTarget;
    setCurrentTime(video.currentTime);
    if(!Number.isFinite(video.duration)||video.duration<=0)return;
    const progress=video.currentTime/video.duration;
    const nextStage=progress<.34?0:progress<.7?1:2;
    setLessonStage(current=>current===nextStage?current:nextStage);
  };
  useEffect(()=>{
    setPracticeMode("idle");setCountdown(3);setPracticeRep(0);setPracticeSeconds(20);setPracticeFeeling(null);setCurrentTime(0);setVideoDuration(tutorial?.durationSeconds||0);setPlaybackRate(1);setMirrored(false);setVideoUnavailable(false);
  },[exercise.id,tutorial?.durationSeconds]);
  useEffect(()=>{
    if(practiceMode!=="countdown")return;
    const timer=window.setInterval(()=>setCountdown(value=>{
      if(value>1)return value-1;
      setPracticeMode("active");
      setPracticeSeconds(20);
      const video=videoRef.current;
      if(video){video.currentTime=0;void video.play();}
      return 0;
    }),1000);
    return()=>window.clearInterval(timer);
  },[practiceMode]);
  useEffect(()=>{
    if(practiceMode!=="active")return;
    const timer=window.setInterval(()=>setPracticeSeconds(value=>{
      if(value>1)return value-1;
      setPracticeMode("feedback");
      videoRef.current?.pause();
      return 0;
    }),1000);
    return()=>window.clearInterval(timer);
  },[practiceMode]);
  const startPractice=()=>{setPracticeMode("countdown");setCountdown(3);setPracticeRep(0);setPracticeSeconds(20);setPracticeFeeling(null);videoRef.current?.pause();};
  const logPracticeRep=()=>{
    if(practiceMode!=="active")return;
    if("vibrate" in navigator)navigator.vibrate(24);
    setPracticeRep(value=>{
      const next=Math.min(3,value+1);
      if(next>=3){setPracticeMode("feedback");videoRef.current?.pause();}
      return next;
    });
  };
  const chooseFeeling=(feeling:"hard"|"right"|"easy")=>{setPracticeFeeling(feeling);setPracticeMode("done");};
  const activePracticeStep=lessonSteps[Math.min(practiceRep,lessonSteps.length-1)];
  const resultCopy=practiceFeeling==="hard"
    ?(zh?(hasEasier?"先换成更简单的版本，保持完整幅度和稳定控制。":"先减轻重量或缩小幅度，直到动作全程可控。"):(hasEasier?"Use the easier version and keep the full range controlled.":"Reduce load or range until every rep stays controlled."))
    :practiceFeeling==="easy"
      ?(zh?"动作感觉轻松。第一组仍从保守重量开始，稳定后再小幅增加。":"It felt easy. Start conservatively and add only after a clean first set.")
      :(zh?"动作和节奏匹配，可以进入第一组。":"The movement and rhythm fit. You are ready for the first set.");
  return <section className={`short-video-lesson ${tutorial?"licensed-coach-video":"guided-preview"}`} aria-label={zh?`${exercise.zh}动作教学`:`${exercise.en} movement lesson`}>
    <div className={`short-video-player ${videoUnavailable?"fallback":""} ${mirrored?"mirrored":""}`}>
      <video ref={videoRef} muted playsInline preload="metadata" poster={poster} onLoadedMetadata={event=>{setVideoDuration(event.currentTarget.duration);event.currentTarget.playbackRate=playbackRate}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setLessonStage(2)}} onTimeUpdate={syncLessonStage} onError={()=>setVideoUnavailable(true)} aria-label={`${exercise.en} movement demonstration`}><source src={videoSrc} type="video/mp4"/></video>
      <img src={tutorial?.poster||`/exercises/${exercise.image}-0.jpg`} alt={`${exercise.en} start position`} loading="eager" decoding="async" draggable={false}/>
      <span className="short-video-badge">{tutorial?(zh?"真人动作示范":"REAL MOVEMENT DEMO"):(zh?"动作预览":"MOVEMENT PREVIEW")}</span>
      {!videoUnavailable&&<div className="short-video-live-cue" aria-live="polite"><small>{zh?`第 ${lessonStage+1} 步 / 3`:`STEP ${lessonStage+1} / 3`}</small><strong>{lessonSteps[lessonStage].label}</strong><span>{lessonSteps[lessonStage].copy}</span></div>}
      {!videoUnavailable&&<button type="button" className="short-video-play" onClick={togglePlayback} aria-label={playing?(zh?"暂停教学视频":"Pause teaching video"):(zh?"播放短视频教学":"Play short video lesson")}><b>{playing?"Ⅱ":"▶"}</b><span>{playing?(zh?"暂停":"PAUSE"):(zh?"开始教学":"WATCH")}</span></button>}
    </div>
    {hasExternalTutorial(exercise.id)&&<ExternalTutorial key={exercise.id} id={exercise.id} zh={zh}/>}<div className="short-video-copy">
      <small>{tutorial?"ONE SET · LICENSED MOVEMENT VIDEO":"ONE SET · GUIDED MOVEMENT PREVIEW"}</small>
      <strong>{zh?"看一次完整动作，再跟着做 3 次":"Watch one clean rep, then follow along for 3."}</strong>
      <p>{tutorial?(zh?"真人示范负责让你看清路径；下方三步提示负责告诉你此刻应该注意什么。建议先用空杆或更轻重量练习。":"The real-person video shows the path; the three coaching steps tell you what to notice. Rehearse with an empty bar or lighter load first."):(zh?"这个动作暂时使用分步预览，不冒充真人教学视频。请按准备、动作、回程逐步查看，再用轻重量练习。":"This movement currently uses a guided preview, not claimed as real coach footage. Review setup, movement, and return before trying a light practice set.")}</p>
      {!videoUnavailable&&<div className="short-video-controls"><label><span>{formatVideoTime(currentTime)}</span><input type="range" min="0" max={Math.max(videoDuration,1)} step="0.05" value={Math.min(currentTime,Math.max(videoDuration,1))} onChange={event=>{const next=Number(event.target.value);setCurrentTime(next);if(videoRef.current)videoRef.current.currentTime=next}} aria-label={zh?"视频进度":"Video progress"}/><span>{formatVideoTime(videoDuration)}</span></label><div><button type="button" className={playbackRate===.5?"active":""} onClick={toggleSpeed} aria-pressed={playbackRate===.5}>{playbackRate===.5?(zh?"正常速度":"Normal speed"):(zh?"0.5× 慢放":"0.5× slow")}</button><button type="button" className={mirrored?"active":""} onClick={()=>setMirrored(value=>!value)} aria-pressed={mirrored}>{zh?"镜像跟练":"Mirror view"}</button></div></div>}
      {tutorial&&<p className="tutorial-credit">{zh?"示范来源":"Video"}：<a href={tutorial.sourceUrl} target="_blank" rel="noreferrer">{tutorial.author} · {tutorial.provider}</a><a href={tutorial.licenseUrl} target="_blank" rel="noreferrer">{tutorial.license}</a><span>{zh?tutorial.processingNoteZh:tutorial.processingNoteEn}</span></p>}
      <div className="short-video-steps">{lessonSteps.map((item,index)=><button type="button" key={item.label} className={lessonStage===index?"active":""} onClick={()=>selectStage(index)} disabled={videoUnavailable}><b>{String(index+1).padStart(2,"0")}</b><i>{item.label}</i><em>{item.copy}</em><span>{zh?"跳到这一步":"JUMP"} →</span></button>)}</div>
      {!videoUnavailable&&<button type="button" className="short-video-replay" onClick={replay}><span>{zh?"从头重播短视频":"Replay from start"}</span><b>↻</b></button>}
      {videoUnavailable&&<p className="short-video-fallback-note">{zh?"视频暂时不可用，已显示起始姿势；请参考下方三步要点。":"Video is unavailable. Use the start position and the three coaching steps below."}</p>}
      <section className={`guided-practice ${practiceMode}`} aria-live="polite">
        {practiceMode==="idle"&&<><div className="guided-practice-heading"><span><small>ONE SET · FOLLOW ALONG</small><strong>{zh?"不要只看，跟着做 3 次":"Don’t just watch. Try 3 reps."}</strong></span><b>20 SEC</b></div><p>{zh?"App 会逐步提示；每完成一次，点击记录。":"The app will cue each phase. Tap after every rep."}</p><button type="button" className="guided-practice-start" onClick={startPractice}><span>{zh?"开始互动跟练":"Start guided practice"}</span><b>→</b></button></>}
        {practiceMode==="countdown"&&<div className="guided-countdown"><small>{zh?"准备姿势":"GET SET"}</small><strong>{countdown}</strong><span>{lessonSteps[0].copy}</span></div>}
        {practiceMode==="active"&&<><div className="guided-practice-heading"><span><small>{zh?`练习 ${practiceRep} / 3`:`PRACTICE ${practiceRep} / 3`}</small><strong>{activePracticeStep.label}</strong></span><b>00:{String(practiceSeconds).padStart(2,"0")}</b></div><p className="guided-live-cue">{activePracticeStep.copy}</p><div className="guided-rep-track" aria-label={zh?`已完成 ${practiceRep} 次`:`${practiceRep} reps complete`}>{[0,1,2].map(index=><i className={index<practiceRep?"done":""} key={index}>{index<practiceRep?"✓":index+1}</i>)}</div><button type="button" className="guided-rep-button" onClick={logPracticeRep}><span>{zh?"完成 1 次，点这里":"Tap after one clean rep"}</span><b>＋1</b></button><button type="button" className="guided-skip" onClick={()=>{setPracticeMode("feedback");videoRef.current?.pause();}}>{zh?"结束练习":"Finish practice"}</button></>}
        {practiceMode==="feedback"&&<><div className="guided-practice-heading"><span><small>{zh?"快速反馈":"QUICK CHECK"}</small><strong>{zh?"刚才感觉怎么样？":"How did that feel?"}</strong></span><b>{practiceRep}/3</b></div><div className="guided-feeling"><button type="button" onClick={()=>chooseFeeling("hard")}><b>↓</b><span>{zh?"太难":"Too hard"}</span></button><button type="button" onClick={()=>chooseFeeling("right")}><b>✓</b><span>{zh?"正合适":"Just right"}</span></button><button type="button" onClick={()=>chooseFeeling("easy")}><b>↑</b><span>{zh?"太轻松":"Too easy"}</span></button></div></>}
        {practiceMode==="done"&&<><div className={`guided-result ${practiceFeeling||"right"}`}><i>{practiceFeeling==="hard"?"↓":practiceFeeling==="easy"?"↑":"✓"}</i><span><small>{zh?"练一下建议":"ONE SET RECOMMENDS"}</small><strong>{resultCopy}</strong></span></div>{practiceFeeling==="hard"&&hasEasier&&onUseEasier?<button type="button" className="guided-practice-start" onClick={onUseEasier}><span>{zh?"换成更简单的动作":"Use easier movement"}</span><b>→</b></button>:<button type="button" className="guided-practice-start" onClick={onContinue}><span>{continueLabel}</span><b>→</b></button>}<button type="button" className="guided-reset" onClick={startPractice}>{zh?"再练 3 次":"Try 3 more reps"}</button></>}
      </section>
    </div>
  </section>;
}

function LegacyOneTapHome({language,listening,listen,t,duration,setDuration,focus,building,advancedReady,build,openBuilder,openAdvanced}:{language:Language;listening:boolean;listen:()=>void;t:Copy;duration:number;setDuration:(value:number)=>void;focus:Focus;building:boolean;advancedReady:boolean;build:(focus:Focus,body?:BodyPart)=>void;openBuilder:()=>void;openAdvanced:()=>void}){
  const zh=language==="zh"; const [selected,setSelected]=useState<Focus>(focus); const [body,setBody]=useState<BodyPart|"all">("all"); useEffect(()=>{setSelected(focus);setBody("all")},[focus]); useEffect(()=>{document.querySelectorAll<HTMLButtonElement>(".one-tap-home .one-tap-primary,.one-tap-home .one-tap-voice").forEach(button=>{const voice=button.classList.contains("one-tap-voice");button.disabled=building;button.classList.toggle("is-building",building);button.setAttribute("aria-busy",String(building));button.setAttribute("aria-label",building?(zh?"正在生成你的训练":"Building your workout"):(voice?(zh?"语音或随机生成":"Voice or shuffle generate"):(zh?"生成我的训练":"Build my workout")))})},[building,zh]);
  const detailChoices:Record<Focus,Array<{id:BodyPart|"all";zh:string;en:string}>>={full:[{id:"all",zh:"全身",en:"Full body"},{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"lower",zh:"臀腿",en:"Glutes + legs"},{id:"core",zh:"核心",en:"Core"}],upper:[{id:"all",zh:"上肢整体",en:"All upper"},{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"arms",zh:"手臂",en:"Arms"}],lower:[{id:"all",zh:"下肢整体",en:"All lower"},{id:"lower",zh:"臀腿",en:"Glutes + legs"},{id:"core",zh:"核心辅助",en:"Core support"}],pushpull:[{id:"all",zh:"胸背整体",en:"Chest + back"},{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"arms",zh:"手臂",en:"Arms"}],core:[{id:"all",zh:"核心整体",en:"All core"},{id:"core",zh:"腹部",en:"Abs"},{id:"lower",zh:"腰臀稳定",en:"Hip stability"}]};
  const selectedDetail=detailChoices[selected].find(choice=>choice.id===body)||detailChoices[selected][0];
  useEffect(()=>{document.querySelectorAll<HTMLButtonElement>(".one-tap-home .one-tap-voice").forEach(button=>button.setAttribute("aria-label",zh?"语音输入":"Voice input"))},[zh]);
  const names=zh?({full:"全身",upper:"上肢",lower:"下肢",pushpull:"胸背",core:"核心"} as Record<Focus,string>):t;
  useEffect(()=>{document.querySelectorAll<HTMLButtonElement>(".one-tap-home .one-tap-voice").forEach(button=>{button.classList.toggle("listening",listening);button.setAttribute("aria-busy",String(listening));button.setAttribute("aria-label",listening?(zh?"正在聆听":"Listening"):(zh?"语音输入":"Voice input"))})},[listening,zh]);
  return <section className="one-tap-home" aria-label="One tap workout builder"><div className="one-tap-kicker">练一下 · ONE SET</div><div className="one-tap-layout"><div><p className="one-tap-step">01 / {zh?"选择今天想练的部位":"CHOOSE YOUR FOCUS"}</p><h1>{zh?"今天，练什么？":"What are you training today?"}</h1><p className="one-tap-sub">{zh?"选一个部位，再选训练时长；练一下会自动安排动作、组数和休息。":"Choose a focus and a duration. One Set handles the exercises, sets, and rest."}</p></div><button className="one-tap-voice" onClick={listen} aria-label={listening?(zh?"停止语音输入":"Stop voice input"):(zh?"开始语音输入":"Start voice input")}><strong>●</strong><span>{zh?"语音输入":"VOICE"}</span></button></div><div className="one-tap-focus">{(["full","upper","lower","pushpull","core"] as Focus[]).map(item=><button key={item} className={selected===item?"active":""} onClick={()=>{setSelected(item);setBody("all")}}><i>{({full:"◌",upper:"↑",lower:"↓",pushpull:"↔",core:"◎"} as Record<Focus,string>)[item]}</i>{names[item]}</button>)}</div><div className="one-tap-area"><div><small>02 / {zh?"想练更细一点？":"MAKE IT SPECIFIC"}</small><strong>{zh?"选择具体部位，仍然一键生成":"Choose an area. Still one tap."}</strong></div><section>{detailChoices[selected].map(choice=><button key={choice.id} className={body===choice.id?"active":""} onClick={()=>setBody(choice.id)}>{zh?choice.zh:choice.en}</button>)}</section></div><div className="one-tap-options"><div><span>03 / {zh?"训练时长":"DURATION"}</span>{[20,30,45,60].map(value=><button key={value} className={duration===value?"active":""} onClick={()=>setDuration(value)}>{value}<small>MIN</small></button>)}</div><button className="one-tap-advanced" onClick={openBuilder}>{zh?"手动输入需求":"Type request"}<b>→</b></button></div><button className="one-tap-primary" onClick={()=>build(selected,body==="all"?undefined:body)}><span>{zh?"生成我的训练":"Build my workout"}<small>{duration} MIN · {zh?selectedDetail.zh:selectedDetail.en} · {zh?"随机动作组合":"Fresh exercise mix"}</small></span><b>→</b></button><button className={`one-tap-personalization ${advancedReady?"ready":""}`} onClick={openAdvanced}><i>{advancedReady?"✓":"＋"}</i><span><small>{advancedReady?(zh?"个性化已开启":"PERSONALIZED"):(zh?"可选：高级资料":"OPTIONAL · ADVANCED PROFILE")}</small><strong>{advancedReady?(zh?"经验、恢复和疼痛区域会参与生成":"Experience, recovery and pain areas inform your plan"):(zh?"补充经验、恢复或疼痛区域，让计划更贴合你":"Add experience, recovery or pain areas for a closer fit")}</strong></span><b>{advancedReady?(zh?"更新":"EDIT"):(zh?"添加资料":"ADD DETAILS")} →</b></button><div className="one-tap-steps" aria-label={zh?"使用流程":"How it works"}><span><b>01</b><strong>{zh?"选择":"CHOOSE"}</strong><small>{zh?"部位 + 时长":"focus + time"}</small></span><i>→</i><span><b>02</b><strong>{zh?"生成":"BUILD"}</strong><small>{zh?"动作 + 组数":"sets + rest"}</small></span><i>→</i><span><b>03</b><strong>{zh?"开始":"TRAIN"}</strong><small>{zh?"逐组记录":"log each set"}</small></span></div></section>;
}

function OneTapHome({language,history,equipment,setEquipment,listening,voiceTranscript,listen,request,setRequest,submitRequest,t,duration,setDuration,focus,noviceMode,setNoviceMode,building,advancedReady,build,openBuilder,openAdvanced}:{language:Language;history:WorkoutLog[];equipment:Equipment;setEquipment:(value:Equipment)=>void;listening:boolean;voiceTranscript:string;listen:()=>void;request:string;setRequest:(value:string)=>void;submitRequest:()=>void;t:Copy;duration:number;setDuration:(value:number)=>void;focus:Focus;noviceMode:boolean;setNoviceMode:(value:boolean)=>void;building:boolean;advancedReady:boolean;build:(focus:Focus,area?:BuildArea)=>void;openBuilder:()=>void;openAdvanced:()=>void}){
  const zh=language==="zh";
  const [selectedFocus,setSelectedFocus]=useState<Focus>(focus);
  const [area,setArea]=useState<BuildArea|"all">("all");
  const [customOpen,setCustomOpen]=useState(false);
  useEffect(()=>{setSelectedFocus(focus);setArea("all")},[focus]);
  const focusChoices:Focus[]=["full","upper","lower","pushpull","core"];
  const labels:Record<Focus,{zh:string;en:string;icon:AppIconName}>={full:{zh:"全身",en:"Full body",icon:"full-body"},upper:{zh:"上肢",en:"Upper body",icon:"upper-body"},lower:{zh:"下肢",en:"Lower body",icon:"lower-body"},pushpull:{zh:"胸背",en:"Chest + back",icon:"push-pull"},core:{zh:"核心",en:"Core",icon:"core"}};
  const areas:Record<Focus,Array<{id:BuildArea|"all";zh:string;en:string}>>={
    full:[{id:"all",zh:"全身",en:"Full body"},{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"biceps",zh:"手臂前侧",en:"Biceps"},{id:"triceps",zh:"手臂后侧",en:"Triceps"},{id:"lower",zh:"臀腿",en:"Glutes + legs"},{id:"core",zh:"核心",en:"Core"}],
    upper:[{id:"all",zh:"上肢整体",en:"All upper"},{id:"chest",zh:"胸部",en:"Chest"},{id:"lats",zh:"背阔肌",en:"Lats"},{id:"upperBack",zh:"上背",en:"Upper back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"biceps",zh:"二头",en:"Biceps"},{id:"triceps",zh:"三头",en:"Triceps"}],
    lower:[{id:"all",zh:"下肢整体",en:"All lower"},{id:"glutes",zh:"臀部",en:"Glutes"},{id:"quads",zh:"大腿前侧",en:"Front thighs"},{id:"hamstrings",zh:"大腿后侧",en:"Back thighs"}],
    pushpull:[{id:"all",zh:"胸背整体",en:"Chest + back"},{id:"chest",zh:"胸部",en:"Chest"},{id:"lats",zh:"背阔肌",en:"Lats"},{id:"upperBack",zh:"上背",en:"Upper back"},{id:"biceps",zh:"二头",en:"Biceps"},{id:"triceps",zh:"三头",en:"Triceps"}],
    core:[{id:"all",zh:"核心整体",en:"All core"},{id:"abs",zh:"腹肌",en:"Abs"},{id:"stability",zh:"稳定核心",en:"Core stability"}],
  };
  const selectedArea=areas[selectedFocus].find(item=>item.id===area)||areas[selectedFocus][0];
  const lastFocus=recentAdjustmentLogs(history).find(log=>log.completed!==false)?.focus;
  const baseRecommendedFocus:Focus=lastFocus==="upper"||lastFocus==="pushpull"?"lower":lastFocus==="lower"?"upper":lastFocus==="core"?"full":"full";
  const homeAdjustment=adjustNextWorkout({durationMinutes:duration,focus:baseRecommendedFocus},history);
  const recommendedFocus:Focus=homeAdjustment.focus as Focus;
  const recommendedLabel=zh?labels[recommendedFocus].zh:labels[recommendedFocus].en;
  const recommendationReason=homeAdjustment.adjustmentReason?describeAdjustment(homeAdjustment.adjustmentReason,language):lastFocus==="upper"||lastFocus==="pushpull"
    ?(zh?"上次重点在上肢，今天换到下肢，让同一肌群有恢复空间。":"Your last session emphasized upper body, so today shifts to lower body for recovery.")
    :lastFocus==="lower"
      ?(zh?"上次练了下肢，今天安排上肢，让腿部得到恢复。":"Your last session was lower body, so today shifts to upper body while your legs recover.")
      :lastFocus==="core"
        ?(zh?"上次是核心训练，今天从一套平衡的全身训练继续。":"After core work, a balanced full-body session is a good next step.")
        :(zh?"从一套平衡的全身训练开始，动作、组数和休息都会自动安排。":"Start with a balanced full-body session. Moves, sets, and rest are planned for you.");
  const runBuild=()=>build(selectedFocus,area==="all"?undefined:area);
  return <section className="one-tap-home simple-home" aria-label="One tap workout builder">
    <header className="home-intro"><h1>{zh?"今日训练":"Today's workout"}</h1><p>{zh?"选择器械，一键生成。想练哪里、练多久，也可以自己调整。":"Choose equipment and build your workout. You can adjust the focus and duration."}</p></header>

    <section className="one-tap-recommendation" aria-label={zh?"今日推荐训练":"Recommended workout"}>
      <div><small>{zh?"今天推荐":"TODAY'S PICK"}</small><strong>{recommendedLabel}</strong><details className="recommendation-detail"><summary>{zh?"为什么推荐这套？":"Why this workout?"}</summary><p>{recommendationReason}</p></details><span>{homeAdjustment.durationMinutes} {zh?"分钟":"min"} · {homeAdjustment.intensity==="light"?(zh?"轻量调整":"light adjustment"):noviceMode?(zh?"新手友好":"starter friendly"):(zh?"自动匹配难度":"matched difficulty")} · {zh?"每次动作不同":"fresh mix"}</span></div>
      <label className="home-equipment"><span>{zh?"你有哪些器械？":"What equipment do you have?"}</span><select aria-label={zh?"可用器械":"Available equipment"} value={equipment} disabled={building} onChange={event=>setEquipment(event.target.value as Equipment)}><option value="bodyweight">{zh?"没有器械 · 徒手练":"No equipment · Bodyweight"}</option><option value="dumbbell">{zh?"只有哑铃":"Dumbbells only"}</option><option value="gym">{zh?"健身房器械":"Gym equipment"}</option></select></label>
      <button type="button" disabled={building} aria-busy={building} onClick={()=>build(recommendedFocus)}><span>{building?(zh?"正在生成…":"Building…"):(zh?"一键生成训练":"Build recommended workout")}</span><b><AppIcon name="arrow-right"/></b></button>
    </section>

    <form className="home-quick-request" onSubmit={event=>{event.preventDefault();if(request.trim()&&!building)submitRequest()}}>
      <label htmlFor="today-request">{zh?"有自己的想法？":"Have something in mind?"}</label>
      <div className="home-request-field"><input id="today-request" value={request} onChange={event=>setRequest(event.target.value)} placeholder={zh?"30 分钟，练胸和背":"30-minute chest and back workout"} disabled={building}/><button type="submit" disabled={building||!request.trim()} aria-label={zh?"按输入生成训练":"Generate from request"}><AppIcon name="arrow-right"/></button></div>
      <button type="button" className="home-voice-compact" disabled={building} onClick={listen} aria-pressed={listening}><AppIcon name={listening?"listening":"voice"}/><span>{listening?(zh?"说完了，生成训练":"Done speaking — build workout"):(zh?"用语音说出训练需求":"Describe workout by voice")}</span></button>
      {listening&&<p role="status">{voiceTranscript||(zh?"正在听你说…":"Listening…")}</p>}
    </form>

    <button type="button" className={`home-customize-toggle ${customOpen?"active":""}`} onClick={()=>setCustomOpen(open=>!open)} aria-expanded={customOpen} aria-controls="home-customize"><span><small>{zh?"想自己选择？":"WANT MORE CONTROL?"}</small><strong>{zh?"选择部位和时长":"Choose focus and duration"}</strong></span><b><AppIcon name={customOpen?"minus":"plus"}/></b></button>

    {customOpen&&<section id="home-customize" className="home-customize">
      <div className="home-control-heading"><small>01</small><strong>{zh?"今天练哪里？":"What are you training?"}</strong></div>
      <div className="one-tap-focus" role="group" aria-label={zh?"训练范围":"Training region"}>{focusChoices.map(item=><button type="button" disabled={building} key={item} className={selectedFocus===item?"active":""} onClick={()=>{setSelectedFocus(item);setArea("all")}} aria-pressed={selectedFocus===item}><i><AppIcon name={labels[item].icon}/></i><span>{zh?labels[item].zh:labels[item].en}</span></button>)}</div>
      <div className="home-target-heading"><strong>{zh?"重点练哪个部位？":"Choose your focus"}</strong><p>{zh?"选一个重点，或保留整体训练。":"Pick one target, or keep a balanced session."}</p></div>
      <div className="one-tap-area"><section role="group" aria-label={zh?"重点训练部位":"Target muscle group"}>{areas[selectedFocus].map(choice=><button type="button" disabled={building} key={choice.id} className={area===choice.id?"active":""} aria-pressed={area===choice.id} onClick={()=>setArea(choice.id)}>{area===choice.id&&<AppIcon name="check"/>}{zh?choice.zh:choice.en}</button>)}</section></div>
      <div className="home-control-heading"><small>02</small><strong>{zh?"练多久？":"How long?"}</strong></div>
      <div className="home-duration" role="group" aria-label={zh?"训练时长":"Workout duration"}>{[20,30,45,60].map(value=><button type="button" disabled={building} key={value} className={duration===value?"active":""} aria-pressed={duration===value} onClick={()=>setDuration(value)}><strong>{value}</strong><small>{zh?"分钟":"MIN"}</small></button>)}</div>
      <button type="button" disabled={building} className={`one-tap-starter ${noviceMode?"active":""}`} onClick={()=>setNoviceMode(!noviceMode)} aria-pressed={noviceMode}><i><AppIcon name={noviceMode?"check":"starter"}/></i><span><small>{zh?"新手模式":"STARTER MODE"}</small><strong>{noviceMode?(zh?"已开启：优先简单动作和充分休息":"On: easier movements and more recovery"):(zh?"第一次训练？使用更简单动作和充分休息":"New to training? Easier moves & more recovery")}</strong></span><b>{noviceMode?(zh?"已开启":"ON"):(zh?"开启":"TURN ON")}</b></button>
      <p className="home-selection-summary" role="status">{zh?"已选择：":"Selected: "}{zh?selectedArea.zh:selectedArea.en} · {duration} {zh?"分钟":"min"} · {equipment==="gym"?(zh?"健身房":"Gym"):equipment==="dumbbell"?(zh?"哑铃":"Dumbbells"):(zh?"徒手":"Bodyweight")}</p>
      <button className="one-tap-primary" disabled={building} aria-busy={building} onClick={runBuild}><span>{building?(zh?"正在生成…":"Building…"):(zh?"按我的选择生成":"Build with my choices")}</span><b><AppIcon name="arrow-right"/></b></button>
      <div className="home-secondary-links"><button onClick={openBuilder}>{zh?"手动输入完整需求":"Type a full request"}</button><button className={advancedReady?"ready":""} onClick={openAdvanced}>{advancedReady?(zh?"更新个性化资料":"Edit personalized profile"):(zh?"添加个性化资料":"Add personalized profile")}</button></div>
    </section>}
    <div className="home-extra-links"><a href="/onboarding">{zh?"建立四周计划":"Build a 4-week plan"} <span>→</span></a><button onClick={openAdvanced}>{zh?"个人训练资料":"Training profile"} <span>→</span></button></div>
    <a className="home-start-guide" href="/start"><AppIcon name="info"/>{zh?"第一次用？查看使用指南":"First time? View the getting-started guide"}</a>
  </section>;
}

function NextWorkoutBooking({language,date}:{language:Language;date:string}){
  const zh=language==="zh";
  const [year,month,day]=date.split("-").map(Number);
  const scheduled=new Date(year,month-1,day);
  const today=new Date();today.setHours(0,0,0,0);
  const daysAway=Math.round((scheduled.getTime()-today.getTime())/86400000);
  if(!Number.isFinite(scheduled.getTime())||daysAway<0)return null;
  const timing=daysAway===0?(zh?"今天":"TODAY"):daysAway===1?(zh?"明天":"TOMORROW"):(zh?`${daysAway} 天后`:`IN ${daysAway} DAYS`);
  return <section className="next-workout-booking" aria-label={zh?"下一次训练已安排":"Next workout scheduled"}><i>✓</i><div><small>{zh?"下一次训练已安排":"NEXT WORKOUT SCHEDULED"}</small><strong>{timing} · {fullDate(language,scheduled)}</strong><span>{zh?"回到这里即可继续一键生成或开始你的训练。":"Return here to build or start your next session in one tap."}</span></div></section>;
}

function BodyFocusRail({language,focus,build}:{language:Language;focus:Focus;build:(focus:Focus,body?:BodyPart)=>void}){
  const zh=language==="zh";
  const choices:Record<Focus,Array<{id:BodyPart;zh:string;en:string}>>={full:[{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"arms",zh:"手臂",en:"Arms"},{id:"lower",zh:"臀腿",en:"Glutes + legs"},{id:"core",zh:"核心",en:"Core"}],upper:[{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"arms",zh:"手臂",en:"Arms"}],lower:[{id:"lower",zh:"臀腿",en:"Glutes + legs"},{id:"core",zh:"核心辅助",en:"Core support"}],pushpull:[{id:"chest",zh:"胸部",en:"Chest"},{id:"back",zh:"背部",en:"Back"},{id:"shoulders",zh:"肩部",en:"Shoulders"},{id:"arms",zh:"手臂",en:"Arms"}],core:[{id:"core",zh:"腹部",en:"Abs"},{id:"lower",zh:"腰臀稳定",en:"Hip stability"}]};
  return <section className="body-focus-rail" aria-label={zh?"细分训练部位":"Specific training area"}><header><div><small>03 / SPECIFIC AREA</small><strong>{zh?"想更精准？选择具体部位":"Make it more specific"}</strong></div><span>{zh?"生成对应动作组合":"Build a targeted exercise mix"}</span></header><div>{choices[focus].map(choice=>{const count=exerciseLibrary.filter(ex=>ex.body===choice.id).length;return <button key={choice.id} onClick={()=>build(focus,choice.id)}><i>+</i><span>{zh?choice.zh:choice.en}<small>{count} {zh?"个动作":"moves"}</small></span><b>→</b></button>})}</div></section>;
}

function FormTodayHome({language,t,todaySession,workout,duration,setDuration,focus,start,openPlan,openBuilder,quickBuild,openProgress}:{language:Language;t:Copy;todaySession:TodaySession|null;workout:LibraryExercise[];duration:number;setDuration:(value:number)=>void;focus:Focus;start:()=>void;openPlan:()=>void;openBuilder:()=>void;quickBuild:(focus?:Focus)=>void;openProgress:()=>void}){
  const zh=language==="zh";
  const [quickFocus,setQuickFocus]=useState<Focus>(focus);
  useEffect(()=>setQuickFocus(focus),[focus]);
  const quickFocusLabel=zh?({full:"全身",upper:"上肢",lower:"下肢",pushpull:"胸背",core:"核心"} as Record<Focus,string>)[quickFocus]:t[quickFocus];
  const totalSets=workout.reduce((sum,_,index)=>sum+(todaySession?.exercises[index]?.sets??0),0)||workout.length*3;
  return <div className="page"><section className="today-quick-picker" aria-label={zh?"Quick workout focus":"Quick workout focus"}><header><div><small>ONE SET · ONE-TAP WORKOUT</small><strong>{zh?"选择部位，立刻生成新方案":"Choose a focus. Get a fresh workout."}</strong></div><button onClick={()=>quickBuild(quickFocus)}>{zh?"随机换一套":"Shuffle"}<i><AppIcon name="refresh"/></i></button></header><div className="quick-focus-row">{(["full","upper","lower","pushpull","core"] as Focus[]).map(item=><button key={item} className={quickFocus===item?"active":""} onClick={()=>setQuickFocus(item)} aria-pressed={quickFocus===item}><i><AppIcon name={focusIconNames[item]}/></i><span>{zh?({full:"全身",upper:"上肢",lower:"下肢",pushpull:"胸背",core:"核心"} as Record<Focus,string>)[item]:t[item]}</span></button>)}</div><div className="quick-duration-row"><span>{zh?"训练时长":"DURATION"}</span>{[20,30,45,60].map(value=><button key={value} className={duration===value?"active":""} onClick={()=>setDuration(value)}>{value}<small>min</small></button>)}</div><p>{zh?"选择部位与时长后，一键生成会刷新动作组合，并保留你的安全设置。":"Choose focus and duration; generation refreshes the exercise mix while preserving your safeguards."}</p></section>
    <section className="hello"><div><p>{t.today} · {fullDate(language)}</p><h1>{t.greeting}</h1><span>{t.subtitle}</span></div></section>
    <section className="today-refresh-card" aria-label={zh?"快速生成新的训练":"Build a fresh workout"}>
      <header><div><small>ONE-TAP · FRESH SESSION</small><strong>{todaySession?.isRestDay?(zh?"想练一点？生成一套轻量训练。":"Want to move? Build a lighter session."):(zh?"想换一套？按下面的选择重新生成。":"Want something different? Build a fresh session.")}</strong><p>{zh?"不会覆盖你的高级资料、器械与安全设置。":"Your advanced profile, equipment and safety settings stay in place."}</p></div></header>
      <div className="today-refresh-focus" role="group" aria-label={zh?"训练部位":"Workout focus"}>{(["full","upper","lower","pushpull","core"] as Focus[]).map(item=><button key={item} className={quickFocus===item?"active":""} onClick={()=>setQuickFocus(item)} aria-pressed={quickFocus===item}><i><AppIcon name={focusIconNames[item]}/></i><span>{zh?({full:"全身",upper:"上肢",lower:"下肢",pushpull:"胸背",core:"核心"} as Record<Focus,string>)[item]:t[item]}</span></button>)}</div>
      <div className="today-refresh-footer"><div role="group" aria-label={zh?"训练时长":"Workout duration"}>{[20,30,45,60].map(value=><button key={value} className={duration===value?"active":""} onClick={()=>setDuration(value)} aria-pressed={duration===value}>{value}<small>MIN</small></button>)}</div><button className="today-refresh-primary" onClick={()=>quickBuild(quickFocus)}><span><small>{duration} MIN · {quickFocusLabel}</small><strong>{zh?"生成新的训练":"Build fresh workout"}</strong></span><b><AppIcon name="arrow-right"/></b></button></div>
    </section>
    {todaySession?<>
      <section className="today-workout card-dark"><div className="card-label"><span>{todaySession.isRestDay?(zh?`休息日 · ${todaySession.daysUntil} 天后训练`:`REST DAY · IN ${todaySession.daysUntil} DAY${todaySession.daysUntil===1?"":"S"}`):todaySession.dayLabel}</span><b>{todaySession.planName}</b></div><div className="workout-cover"><ExerciseImage ex={workout[0]} className="cover-motion"/><div className="cover-shade"/><div className="cover-copy"><small>{todaySession.isRestDay?(zh?`下一次 · ${todaySession.dayLabel}`:`NEXT · ${todaySession.dayLabel}`):todaySession.dayName}</small><h2>{t[focus]}</h2><div><span>◇ {workout.length} {t.exercises}</span><span>▤ {totalSets} {t.sets}</span></div></div></div><div className="workout-actions"><button onClick={start}>{todaySession.isRestDay?(zh?"提前开始这次训练":"Start this workout early"):t.start}<i>→</i></button><button onClick={openPlan}>{zh?"查看计划":"View plan"}</button></div></section>
      <section className="card-dark plan-preview"><small>{zh?"今日动作":"TODAY'S MOVES"}</small>{todaySession.exercises.slice(0,5).map((item,index)=>{const ex=ids[item.exerciseId];return <p key={item.exerciseId}><b>{String(index+1).padStart(2,"0")}</b><span>{ex?(zh?ex.zh:ex.en):item.name}</span><em>{item.sets} × {item.repsMin}–{item.repsMax}</em></p>})}</section>
    </>:<section className="card-dark empty-plan legacy-empty-plan"><small>ONE SET · READY WHEN YOU ARE</small><h2>{zh?"今天想练什么？先从一键训练开始。":"Ready to train? Start with one tap."}</h2><p>{zh?"练一下会按你已保存的时长、器械与训练偏好生成一套今天就能执行的训练。需要更多细节时，再进入高级定制；ChatGPT 保存的计划也会自动出现在这里。":"ONE SET creates an executable workout using your saved time, equipment, and preferences. Open Advanced for more detail, or have ChatGPT save a structured plan here anytime."}</p><div><button onClick={()=>quickBuild(focus)}>{zh?"一键生成今日训练":"Generate today's workout"}</button><button onClick={openBuilder}>{zh?"自定义训练":"Customize workout"}</button></div><small className="empty-plan-note">{zh?"可选：在 ChatGPT 中创建计划后，使用 Save to Form 直接同步。":"Optional: create a plan in ChatGPT, then use Save to Form to sync it here."}</small></section>}
  </div>;
}

function CameraFirstHome({language,scan,openPosture,openProgress}:{language:Language;scan:()=>void;openPosture:()=>void;openProgress:()=>void}){
  const zh=language==="zh";
  const[scans,setScans]=useState<{id:string;date:string;score:number;confidence:number;type:"form";pending?:boolean}[]>([]);
  useEffect(()=>{
    const apply=(records:unknown)=>setScans(Array.isArray(records)?records.filter(item=>item&&typeof item==="object"&&(item as {type?:string}).type==="form") as typeof scans:[]);
    const load=()=>{try{apply(readScanRecords())}catch{setScans([])}};
    load();void loadSyncedScans().then(apply);void syncPendingScans().then(result=>apply(result.records));window.addEventListener("form-ai-scans-changed",load);return()=>window.removeEventListener("form-ai-scans-changed",load);
  },[]);
  const latest=scans[0],previous=scans[1];
  const change=latest&&previous?latest.score-previous.score:null;
  return <div className="page camera-first-home">
    <header className="camera-first-head"><small>{zh?"动作与体态分析":"MOVEMENT & POSTURE"}</small><h1>{zh?"今天想检查什么？":"What do you want to check?"}</h1><p>{zh?"拍一段动作视频，马上知道哪里需要改；或用一张正面照片建立快速体态趋势。":"Film a movement to see what to fix, or use one front photo for a quick posture trend."}</p></header>
    <section className="scan-choice-grid">
      <button className="scan-choice primary" onClick={scan}><div className="scan-choice-icon"><i>●</i><span>{zh?"动作视频":"MOVEMENT VIDEO"}</span></div><div className="scan-choice-copy"><small>{zh?"动作扫描":"MOVEMENT SCAN"}</small><h2>{zh?"我的深蹲做对了吗？":"Am I squatting correctly?"}</h2><p>{zh?"录制 3–5 次深蹲，几秒内获得动作评分、最重要的改进点和纠正训练。":"Record 3–5 squats. Get a score, the most important fix, and a corrective workout in seconds."}</p><span className="scan-choice-cta">{latest?(zh?"再次扫描":"Rescan squat"):(zh?"开始免费扫描":"Start free scan")}<b>→</b></span></div><aside><small>{latest?(zh?"上次评分":"LAST SCORE"):(zh?"首次扫描":"FIRST SCAN")}</small><strong>{latest?.score??"--"}<i>/100</i></strong><span>{change===null?(zh?"免费建立基准":"FREE BASELINE"):change===0?(zh?"基准已建立":"BASELINE SET"):`${change>0?"↑ +":"↓ "}${change}`}</span></aside></button>
      <button className="scan-choice posture" onClick={openPosture}><div className="scan-choice-icon"><i>◎</i><span>{zh?"体态照片":"POSTURE PHOTO"}</span></div><div className="scan-choice-copy"><small>{zh?"1 张正面照片":"1 FRONT PHOTO"}</small><h2>{zh?"我的训练重点在哪里？":"What should I focus on?"}</h2><p>{zh?"正面即可建立快速趋势；侧面照片可选，用于补充头肩细节。不评价外貌、不估算体脂。":"One front photo creates a quick baseline. Add an optional side photo for head-to-shoulder detail."}</p><span className="scan-choice-cta secondary">{zh?"拍照并查看结果":"Take photo & see result"}<b>→</b></span></div></button>
    </section>
    <section className="simple-loop"><div><b>1</b><span><strong>{zh?"拍摄":"SCAN"}</strong>{zh?"视频或照片":"Video or photos"}</span></div><i>→</i><div><b>2</b><span><strong>{zh?"改进":"FIX"}</strong>{zh?"一个明确重点":"One clear priority"}</span></div><i>→</i><div><b>3</b><span><strong>{zh?"训练":"TRAIN"}</strong>{zh?"自动生成纠正计划":"Corrective workout"}</span></div>{latest&&<button onClick={openProgress}>{zh?"查看我的进度":"View my progress"}<b>→</b></button>}</section>
    <p className="camera-privacy-note">✓ {zh?"视频和照片只在本机进行姿态分析，不上传原始影像；反馈不是医疗诊断。":"Videos and photos are analyzed on this device. Original media is not uploaded, and feedback is not medical diagnosis."}</p>
  </div>;
}

function FormAIHome({language,workout,duration,focus,history,setTab,scan,openPosture,openBuilder}:{language:Language;workout:LibraryExercise[];duration:number;focus:Focus;history:WorkoutLog[];setTab:(tab:Tab)=>void;scan:()=>void;openPosture:()=>void;openBuilder:()=>void}){
  const zh=language==="zh";
  const[scans,setScans]=useState<{id:string;date:string;score:number;confidence:number;metrics:{key:string;score:number}[];type:"form";pending?:boolean}[]>([]);
  useEffect(()=>{
    const apply=(records:unknown)=>setScans(Array.isArray(records)?records.filter(item=>item&&typeof item==="object"&&(item as {type?:string}).type==="form") as typeof scans:[]);
    const load=()=>{try{apply(readScanRecords())}catch{setScans([])}};
    load();void loadSyncedScans().then(apply);void syncPendingScans().then(result=>apply(result.records));window.addEventListener("form-ai-scans-changed",load);return()=>window.removeEventListener("form-ai-scans-changed",load);
  },[]);
  const latest=scans[0];
  const previous=scans[1];
  const change=latest&&previous?latest.score-previous.score:0;
  const recentCount=scans.filter(item=>Date.now()-new Date(item.date).getTime()<28*86400000).length;
  const consistencyScore=Math.min(100,recentCount*18);
  const trainingScore=latest?Math.round(latest.score*.82+consistencyScore*.18):null;
  return <div className="page form-home">
    <section className="form-hero">
      <div className="form-hero-copy"><small>练一下 · ONE SET · CAMERA COACH</small><h1>{zh?<>拍下动作。<br/><em>马上知道怎么改。</em></>:<>Film your lift.<br/><em>Know what to fix.</em></>}</h1><p>{zh?"录制 3–5 次深蹲，几秒内得到动作评分、3 个具体改进点和下一组建议。":"Record 3–5 squats and get a form score, three specific fixes, and your next-set recommendation."}</p><div className="hero-trust"><span>✓ {zh?"本机分析":"On-device"}</span><span>✓ {zh?"不评价外貌":"No appearance rating"}</span><span>✓ {zh?"中英文":"中文 / EN"}</span></div><button onClick={scan}><i>●</i><span><strong>{zh?"扫描我的深蹲":"Scan my squat"}</strong><small>{zh?"录制或上传 5–12 秒视频":"Record or upload a 5–12 sec video"}</small></span><b>→</b></button></div>
      <div className="form-demo-card"><header><span>LIVE FORM MAP</span><b>● READY</b></header><div className="pose-stage"><i className="pose-head"/><i className="pose-body"/><i className="pose-arm left"/><i className="pose-arm right"/><i className="pose-leg left"/><i className="pose-leg right"/><span className="pose-joint j1"/><span className="pose-joint j2"/><span className="pose-joint j3"/><span className="pose-joint j4"/></div><footer><div><small>SQUAT SCORE</small><strong>{latest?.score||"--"}<i>/100</i></strong></div><span>{latest?(change===0?"→":change>0?`↑ +${change}`:`↓ ${change}`):(zh?"完成扫描后显示":"SCAN TO REVEAL")}</span></footer></div>
    </section>
    <section className="training-score-card"><div className="training-score-main"><small>{zh?"你的训练表现分":"YOUR TRAINING SCORE"}</small><strong>{trainingScore??"--"}<i>/100</i></strong><span className={change>=0?"positive":"negative"}>{latest?(change===0?(zh?"首次基准已建立":"Baseline established"):zh?`较上次 ${change>0?"+":""}${change}`:`${change>0?"+":""}${change} since last scan`):(zh?"完成第一次免费扫描建立基准":"Complete your first free scan to set a baseline")}</span></div><div className="training-score-breakdown"><p><span>{zh?"动作表现":"Form"}</span><b>{latest?.score??"--"}</b></p><p><span>{zh?"复扫一致性":"Consistency"}</span><b>{latest?consistencyScore:"--"}</b></p><p><span>{zh?"本月扫描":"Scans this month"}</span><b>{recentCount}</b></p></div><button onClick={scan}>{latest?(zh?"再次扫描":"Rescan"):(zh?"开始免费扫描":"Start free scan")}<b>→</b></button></section>
    <section className="camera-moments"><header><div><small>{zh?"一个镜头，一个明确行动":"ONE CAMERA MOMENT"}</small><h2>{zh?"现实世界 → AI → 下一步":"Real world → AI → next action"}</h2></div><p>{zh?"先把最真实的新手痛点做透：我练得对不对？":"Starting with the question beginners cannot answer alone: am I doing this right?"}</p></header><div className="moment-grid">
      <button className="moment-card active" onClick={scan}><span>01</span><i>▶</i><div><small>{zh?"现在可用":"AVAILABLE NOW"}</small><strong>{zh?"动作扫描":"Exercise scan"}</strong><p>{zh?"深蹲评分 · 关节轨迹 · 3 个改进点":"Squat score · joint paths · 3 fixes"}</p></div><b>→</b></button>
      <button className="moment-card active posture-beta" onClick={openPosture}><span>02</span><i>◎</i><div><small>{zh?"测试版可用":"BETA AVAILABLE"}</small><strong>{zh?"体态趋势":"Posture trends"}</strong><p>{zh?"一张正面照片，几秒获得快速结果":"One front photo for a quick observable result"}</p></div><b>→</b></button>
      <article className="moment-card"><span>03</span><i>▣</i><div><small>{zh?"下一阶段":"NEXT"}</small><strong>{zh?"器械识别":"Machine scan"}</strong><p>{zh?"识别器械、讲解设置并加入训练":"Identify, set up safely, and add to workout"}</p></div></article>
    </div></section>
    <section className="scan-to-action"><div><small>{zh?"评分之后，不让用户自己猜":"FROM SCORE TO ACTION"}</small><h2>{zh?"扫描结果直接进入训练计划":"Turn your scan into today’s workout"}</h2><p>{zh?"练一下 · ONE SET 会把需要改善的动作模式交给训练引擎。你可以一键生成，也可以进入高级模式补充经验、恢复、疼痛区域与目标。":"ONE SET passes your movement focus to the workout engine. Generate in one tap or add experience, recovery, pain areas, and goals in Advanced mode."}</p><div><button onClick={openBuilder}>{zh?"生成量身训练":"Build personalized workout"}<b>→</b></button><button onClick={()=>setTab("plan")}>{zh?"查看当前训练":"View current workout"}</button></div></div><aside><small>{zh?"当前训练":"CURRENT WORKOUT"}</small><strong>{zh?bodyNames.zh[focus==="lower"?"lower":workout[0]?.body||"core"]:focus.toUpperCase()}</strong><span>{duration} MIN · {workout.length} {zh?"个动作":"MOVES"}</span><div>{workout.slice(0,3).map((exercise,index)=><p key={exercise.id}><b>{String(index+1).padStart(2,"0")}</b><span>{zh?exercise.zh:exercise.en}</span></p>)}</div><em>{history.length} {zh?"次训练已记录":"WORKOUTS LOGGED"}</em></aside></section>
  </div>;
}

function Today({t,language,workout,duration,focus,history,profileName,weeklyGoal,setTab,startVoice,start}:{t:Copy;language:Language;workout:LibraryExercise[];duration:number;focus:Focus;history:WorkoutLog[];profileName:string;weeklyGoal:number;setTab:(x:Tab)=>void;startVoice:()=>void;start:()=>void}) {
  const dayLabels = language==="zh"?["一","二","三","四","五","六","日"]:["M","T","W","T","F","S","S"];
  const calendarDays=weekDates();
  const weekStart=calendarDays[0].getTime();
  const weekEnd=new Date(calendarDays[6].getFullYear(),calendarDays[6].getMonth(),calendarDays[6].getDate()+1).getTime();
  const weekly=history.filter(log=>{const time=new Date(log.date).getTime();return time>=weekStart&&time<weekEnd});
  const trainedDays=new Set(weekly.map(log=>dateKey(new Date(log.date))));
  const dailySets=calendarDays.map(day=>weekly.filter(log=>dateKey(new Date(log.date))===dateKey(day)).reduce((sum,log)=>sum+log.sets,0));
  const weeklyVolume=weekly.reduce((sum,log)=>sum+log.totalVolume,0);
  const hoursSinceLast=history[0]?Math.max(0,(Date.now()-new Date(history[0].date).getTime())/3600000):72;
  const recoveryScore=Math.min(94,Math.round(62+hoursSinceLast*.45));
  const firstName=profileName.trim().split(/\s+/)[0]||profileName;
  const streak=workoutStreak(history);
  return <div className="page dashboard">
    <section className="hello"><div><p>{t.today} · {fullDate(language)}</p><h1>{t.greeting}，{firstName}</h1><span>{t.subtitle}</span></div><button className="voice-orb" onClick={startVoice}><i>●</i><span>{language==="zh"?"一键语音生成":"One-tap voice plan"}</span></button></section>
    <section className="week-strip">{calendarDays.map((day,i)=>{const today=dateKey(day)===dateKey(new Date());const done=trainedDays.has(dateKey(day));return <div className={today?"today":done?"done":""} key={dateKey(day)}><span>{dayLabels[i]}</span><b>{day.getDate()}</b><i>{done?"✓":""}</i></div>})}</section>
    <div className="dashboard-grid">
      <section className="today-workout card-dark"><div className="card-label"><span>{t.plan}</span><b>{t.made}</b></div><div className="workout-cover"><ExerciseImage ex={workout[0]}/><div className="cover-shade"/><div className="cover-copy"><small>ONE SET PROGRAM 01</small><h2>{t[focus]}</h2><div><span>◷ {duration} MIN</span><span>◇ {workout.length} {t.exercises}</span></div></div></div><div className="workout-actions"><button onClick={start}>{t.start}<i>→</i></button><button onClick={()=>setTab("plan")}>{language==="zh"?"查看计划":"View plan"}</button></div></section>
      <section className="recovery-card panel"><div className="panel-title"><div><span>{t.recovery}</span><h3>{language==="zh"?"基于训练间隔的恢复估算":"Recovery estimate from training interval"}</h3></div><button>•••</button></div><div className="recovery-score"><strong>{recoveryScore}</strong><span>/100</span><i>{recoveryScore>=80?t.fresh:(language==="zh"?"降低强度":"Go lighter")}</i></div><div className="muscle-list"><Muscle label={language==="zh"?"胸部":"Chest"} value={Math.min(96,recoveryScore+5)}/><Muscle label={language==="zh"?"背部":"Back"} value={recoveryScore}/><Muscle label={language==="zh"?"腿部":"Legs"} value={Math.max(55,recoveryScore-8)}/><Muscle label={language==="zh"?"肩部":"Shoulders"} value={Math.min(94,recoveryScore+2)}/></div></section>
      <section className="weekly-card panel"><div className="panel-title"><div><span>{t.weekly}</span><h3>{t.goal}</h3></div><strong>{weekly.length} / {weeklyGoal}</strong></div><div className="week-bars">{dailySets.map((sets,i)=>{const value=sets?Math.min(100,30+sets*4):12;return <i key={dateKey(calendarDays[i])} className={dateKey(calendarDays[i])===dateKey(new Date())&&sets?"hot":""} style={{height:`${value}%`}}/>})}</div><div className="metric-row"><div><strong>{weekly.length}</strong><span>{t.workouts}</span></div><div><strong>{weeklyVolume>=1000?`${(weeklyVolume/1000).toFixed(1)}t`:`${Math.round(weeklyVolume)}kg`}</strong><span>{t.volume}</span></div><div><strong>{streak}</strong><span>{t.streak}</span></div></div></section>
    </div>
  </div>;
}

function Muscle({label,value}:{label:string;value:number}) { return <div className="muscle-row"><span>{label}</span><i><b style={{width:`${value}%`}}/></i><strong>{value}%</strong></div>; }

function ResumeSessionPrompt({language,draft,resume,discard}:{language:Language;draft:SessionDraft;resume:()=>void;discard:()=>void}) {
  const move=ids[draft.planIds[draft.exerciseIndex]];
  const completedSets=Object.values(draft.completed).filter(Boolean).length;
  const savedTime=new Date(draft.savedAt).toLocaleTimeString(language==="zh"?"zh-CN":"en-US",{hour:"2-digit",minute:"2-digit"});
  return <aside className="resume-session-card" aria-live="polite"><div className="resume-session-icon">↻</div><div className="resume-session-copy"><small>ONE SET SESSION · {savedTime}</small><strong>{language==="zh"?"发现未完成的训练":"Unfinished workout found"}</strong><span>{move?(language==="zh"?move.zh:move.en):language==="zh"?"训练进行中":"Workout in progress"} · {completedSets} {language==="zh"?"组已完成":"sets complete"} · {formatCountdown(draft.seconds)}</span></div><div className="resume-session-actions"><button onClick={resume}>{language==="zh"?"继续训练":"Resume"}<b>→</b></button><button onClick={discard}>{language==="zh"?"放弃":"Discard"}</button></div></aside>;
}

function PlanWhy({t,language,goal,duration,equipment,noviceMode,history}:{t:Copy;language:Language;goal:TrainingGoal;duration:number;equipment:Equipment;noviceMode:boolean;history:WorkoutLog[]}) {
  const zh=language==="zh";
  const latest=history[0];
  const feedback=latest?.rating==="hard" ? (zh?"上次训练偏难，所以这次降低复杂度并保留更多余力。":"Your last session felt hard, so this session keeps more reps in reserve.") : latest?.rating==="easy" ? (zh?"上次训练完成得很轻松，这次保留渐进空间。":"Your last session felt easy, so this session leaves room to progress.") : (zh?"先用清晰、可完成的结构建立稳定训练节奏。":"A clear, achievable structure builds a reliable training rhythm.");
  return <section className="plan-why" aria-label={zh?"训练计划说明":"Why this plan"}>
    <header><span>WHY THIS SESSION</span><strong>{zh?"这套训练为什么这样安排":"Why this session is built this way"}</strong></header>
    <div className="plan-why-grid">
      <article><i>01</i><div><small>{zh?"目标":"GOAL"}</small><b>{zh?goalCopy[goal].zh:goalCopy[goal].en}</b><p>{zh?goalPlanCopy[goal].zh:goalPlanCopy[goal].en}</p></div></article>
      <article><i>02</i><div><small>{zh?"时长与器械":"TIME + GEAR"}</small><b>{duration} {zh?"分钟":"minutes"} · {t[equipment]}</b><p>{zh?"动作数量和休息时间会随时长自动调整。":"Exercise count and rest are scaled to your available time."}</p></div></article>
      <article><i>03</i><div><small>{zh?"你的反馈":"YOUR FEEDBACK"}</small><b>{noviceMode?(zh?"Foundation 安全起步":"Foundation safe start"):(latest?latest.rating.toUpperCase():(zh?"首次训练":"FIRST SESSION"))}</b><p>{feedback}</p></div></article>
    </div>
  </section>;
}

function PlanSwapSheet({language,original,options,choose,close}:{language:Language;original:LibraryExercise;options:LibraryExercise[];choose:(exercise:LibraryExercise)=>void;close:()=>void}){
  const zh=language==="zh";
  return <div className="plan-swap-overlay" role="dialog" aria-modal="true" aria-label={zh?"选择替换动作":"Choose a replacement exercise"}><section className="plan-swap-sheet"><header><div><small>{zh?"替换动作":"SWAP THIS MOVE"}</small><h2>{zh?"选一个更适合今天的替代动作":"Choose a better fit for today"}</h2><p>{zh?`正在替换：${original.zh}`:`Replacing: ${original.en}`}</p></div><button onClick={close} aria-label={zh?"关闭":"Close"}>×</button></header>{options.length?<div className="plan-swap-options">{options.map(option=><button key={option.id} onClick={()=>choose(option)}><span className="swap-option-motion"><ExerciseImage ex={option}/><i>{zh?"短视频":"SHORT VIDEO"}</i></span><span className="swap-option-copy"><small>{bodyNames[language][option.body]} · {gearNames[language][option.gear]}</small><strong>{zh?option.zh:option.en}</strong><em>{zh?option.primaryZh:option.primaryEn} · {option.level==="beginner"?(zh?"新手友好":"BEGINNER FRIENDLY"):(zh?"进阶":"INTERMEDIATE")}</em></span><b>选择 <i>→</i></b></button>)}</div>:<div className="plan-swap-empty"><i>!</i><div><strong>{zh?"当前条件下没有合适的替换动作":"No compatible replacement found"}</strong><span>{zh?"可以调整器械或难度后，再生成这套训练。":"Adjust equipment or difficulty, then regenerate this workout."}</span></div></div>}<button className="plan-swap-cancel" onClick={close}>{zh?"保留原动作":"Keep current movement"}</button></section></div>;
}

function Plan({t,language,workout,duration,focus,targetArea,equipment,goal,setCounts,noviceMode,personalization,history,todayLog,canLog,quickLogOpen,quickLogSaving,setNoviceMode,openOnboarding,openBuilder,openWarmup,openExercise,makeEasier,smartSwap,start,complete,cancelLog,saveLog}:{t:Copy;language:Language;workout:LibraryExercise[];duration:number;focus:Focus;targetArea?:BuildArea;equipment:Equipment;goal:TrainingGoal;setCounts:number[];noviceMode:boolean;personalization:PlanPersonalization|null;history:WorkoutLog[];todayLog:WorkoutLog|null;canLog:boolean;quickLogOpen:boolean;quickLogSaving:boolean;setNoviceMode:(x:boolean)=>void;openOnboarding:()=>void;openBuilder:()=>void;openWarmup:()=>void;openExercise:(x:LibraryExercise)=>void;makeEasier:(x:LibraryExercise)=>void;smartSwap:(x:LibraryExercise)=>void;start:()=>void;complete:()=>void;cancelLog:()=>void;saveLog:(feedback:WorkoutFeedbackInput)=>void|Promise<void>}) {
  const [showExercises,setShowExercises] = useState(false);
  const [easierNotice,setEasierNotice] = useState<{from:string;to:string}|null>(null);
  const previousWorkout=useRef<string[]>([]);
  useEffect(()=>{document.querySelectorAll<HTMLInputElement>(".mode-switch input[type=checkbox]").forEach(input=>input.setAttribute("aria-label",language==="zh"?"新手保护模式":"Beginner protection"))},[language]);
  useEffect(()=>{if(!easierNotice)return;const timer=window.setTimeout(()=>setEasierNotice(null),4200);return()=>window.clearTimeout(timer)},[easierNotice]);
  useEffect(()=>{const current=workout.map(ex=>ex.id);const previous=previousWorkout.current;if(previous.length){const removed=previous.find(id=>!current.includes(id));const added=current.find(id=>!previous.includes(id));if(removed&&added&&(easierMove[removed]===added||ids[removed]?.alternatives.includes(added)))setEasierNotice({from:language==="zh"?"已换成更容易的动作":"Easier move ready",to:added})}previousWorkout.current=current},[workout,language]);
  const totalSets=setCounts.reduce((sum,count)=>sum+count,0);
  const timeEstimate=estimateWorkoutMinutes(workout.map((ex,index)=>({...prescribe(ex,goal,noviceMode),sets:setCounts[index]})));
  const firstMove=workout[0];
  const previewCount=Math.min(3,workout.length);
  const visibleWorkout=showExercises?workout:workout.slice(0,previewCount);
  const visibleTarget=targetArea?buildAreaNames[language][targetArea]:t[focus];
  const intensity=personalization?.intensity||"normal";
  const intensityLabel=language==="zh"?({light:"轻量",normal:"标准",hard:"高强度"} as const)[intensity]:({light:"Light",normal:"Normal",hard:"Hard"} as const)[intensity];
  const latestByExercise=useMemo(()=>{
    const latest=new Map<string,SetPerformance>();
    [...history].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).forEach(log=>log.performances.forEach(performance=>{
      if(!latest.has(performance.exerciseId))latest.set(performance.exerciseId,performance);
    }));
    return latest;
  },[history]);
  return <div className="page plan-page fitbod-plan" data-easier-notice={easierNotice?`${easierNotice.from} · ${language==="zh"?ids[easierNotice.to]?.zh:ids[easierNotice.to]?.en||""}`:undefined}>{easierNotice&&<span className="easier-notice-sr" role="status" aria-live="polite">{easierNotice.from}</span>}
    <section className="workout-app-head"><div><p suppressHydrationWarning>{fullDate(language)}</p><h1>{t.plan}</h1></div><button className="regenerate-btn" onClick={openBuilder}><i>✦</i><span>{t.regenerate}<small>{language==="zh"?"时间 · 部位 · 器械":"Time · focus · equipment"}</small></span></button></section>
    {personalization?.correctionSource&&<section className="correction-origin"><div className="correction-loop"><span>SCAN</span><i>→</i><span>FIX</span><i>→</i><span>TRAIN</span><i>→</i><span>RESCAN</span></div><div><small>{personalization.correctionSource==="form"?(language==="zh"?"来自深蹲动作扫描":"FROM SQUAT FORM SCAN"):(language==="zh"?"来自体态趋势扫描":"FROM POSTURE TREND SCAN")}</small><strong>{language==="zh"?"这不是普通训练计划，而是针对最低指标的纠正训练":"This workout targets your lowest observable metrics"}</strong><p>{(personalization.correctionMetrics||[]).map(key=>language==="zh"?correctionMetricCopy[key]?.zh:correctionMetricCopy[key]?.en).filter(Boolean).join(" · ")} · {language==="zh"?"完成后使用相同机位复扫":"Rescan from the same camera angle after training"}</p></div><b>25 MIN</b></section>}
    {personalization?.adjustmentReason&&<section className="next-workout-adjustment" role="status"><i>↘</i><div><small>{personalization.adjustmentReason.startsWith("baseline:")?(language==="zh"?"训练记录提示":"TRAINING RECORDS"):personalization.adjustmentReason==="request:light"?(language==="zh"?"根据你的要求已调整":"ADJUSTED TO YOUR REQUEST"):(language==="zh"?"根据你的记录，已自动调整下一次训练":"NEXT WORKOUT AUTO-ADJUSTED")}</small><strong>{describeAdjustment(personalization.adjustmentReason,language)}</strong></div></section>}
    <section className="plan-summary"><div className="plan-title"><span>{language==="zh"?goalCopy[goal].zh:goalCopy[goal].en} · {noviceMode?"FOUNDATION":"ONE SET PROGRAM"}</span><h2>{visibleTarget}</h2><p>{noviceMode?(language==="zh"?`先掌握动作并保留 3–4 次余力。${goalPlanCopy[goal].zh}`:`Learn the movements with 3–4 reps in reserve. ${goalPlanCopy[goal].en}`):(language==="zh"?goalPlanCopy[goal].zh:goalPlanCopy[goal].en)}</p></div><div className="plan-stats"><div><small>{language==="zh"?"时间预算":"TIME BUDGET"}</small><strong>{duration}<i> MIN</i></strong></div><div><small>{t.exercises}</small><strong>{workout.length}</strong></div><div><small>{t.level}</small><strong>{noviceMode?t.beginner:t.intermediate}</strong></div><div><small>{language==="zh"?"强度":"Intensity"}</small><strong>{intensityLabel}</strong></div></div></section>
    <p className="plan-time-estimate">{language==="zh"?`预计 ${timeEstimate.min}–${timeEstimate.max} 分钟（含约 5 分钟准备与放松）；按当前组数粗估，教学停留和额外休息另计，不必凑满预算。`:`Estimated ${timeEstimate.min}–${timeEstimate.max} minutes, including about 5 minutes for preparation and cooldown. Learning and extra rest vary; no need to fill the budget.`}</p><div className="plan-start prominent plan-start-top"><div><span>{language==="zh"?goalCopy[goal].zh:goalCopy[goal].en}</span><b>{language==="zh"?"预算":"Budget"} {duration} MIN · {workout.length} {t.exercises} · {totalSets} {t.sets}</b></div><button onClick={start}><span>{language==="zh"?"开始本次训练":t.start}<small>{language==="zh"?"逐组引导与目标化休息":"Guided sets & goal-based rest"}</small></span><i>→</i></button></div>
    <details className="plan-help-details"><summary>{language==="zh"?"第一次做？查看动作教学与热身":"New to these moves? See demos & warm-up"}</summary>
    {firstMove&&<section className="session-preflight"><header><div><small>{language==="zh"?"开始前 · 30 秒":"BEFORE YOU START · 30 SEC"}</small><strong>{language==="zh"?"先看第一个动作，再开始训练":"See your first movement, then start"}</strong></div><span>{language==="zh"?"可选，但推荐新手先完成":"OPTIONAL · RECOMMENDED FOR BEGINNERS"}</span></header><div className="session-preflight-main"><ExerciseImage ex={firstMove} className="preflight-motion" priority/><div><small>{language==="zh"?"第一个动作":"FIRST MOVEMENT"} · 01 / {String(workout.length).padStart(2,"0")}</small><h3>{language==="zh"?firstMove.zh:firstMove.en}</h3><p>{language==="zh"?`目标：${firstMove.primaryZh}。先用视频确认姿势和节奏。`:`Target: ${firstMove.primaryEn}. Use the short video to confirm setup and rhythm.`}</p></div></div><div className="session-preflight-actions"><button onClick={()=>openExercise(firstMove)}><span>▶</span>{language==="zh"?"看短视频教学":"Watch short demo"}<b>→</b></button><button onClick={openWarmup}><span>↗</span>{language==="zh"?"开始 5 分钟热身":"Start 5-min warm-up"}<b>→</b></button></div></section>}
    </details>
    <div className="list-heading"><span>{language==="zh"?"训练动作":"YOUR EXERCISES"}<small>{language==="zh"?(showExercises?"点击动作看短视频教学":"先看前三个动作，需要时再展开完整清单"):"Tap a movement for its short video"}</small></span><b>{showExercises?workout.length:visibleWorkout.length}/{workout.length} {t.exercises} · {totalSets} {t.sets}</b></div>
    <section className="exercise-list novice-list">{visibleWorkout.map((ex,i)=>{const canEase=Boolean(easierMove[ex.id]);const rx=prescribe(ex,goal,noviceMode);const previous=latestByExercise.get(ex.id);const previousLabel=previous?(previous.weightKg>0?`${previous.weightKg} kg × ${previous.reps}`:`${previous.reps} ${language==="zh"?"次":"reps"}`):null;return <article key={`${ex.id}-${i}`}><span className="exercise-number">{String(i+1).padStart(2,"0")}</span><button className="exercise-photo" onClick={()=>openExercise(ex)}><ExerciseImage ex={ex} className="exercise-preview"/><i>▶</i></button><div className="exercise-info"><div className="exercise-badges"><small>{language==="zh"?ex.primaryZh:ex.primaryEn}</small><em>{noviceMode?(language==="zh"?"基础":"FOUNDATION"):(ex.level==="beginner"?"L1":"L2")}</em></div><button onClick={()=>openExercise(ex)}>{language==="zh"?ex.zh:ex.en}</button><span><b>{setCounts[i]}</b> × {localizedReps(rx.reps,language)} <i>·</i> {rx.restLabel} {t.rest}</span>{previousLabel&&<small className="plan-previous-set"><i>↗</i>{language==="zh"?`上次：${previousLabel} · 作为今天的参考起点`:`Last: ${previousLabel} · Use it as today’s reference`}</small>}<p>{noviceMode?(language==="zh"?"目标：动作稳定，结束时还能再做 3 次":"Goal: clean reps with 3 reps left"):(language==="zh"?goalPlanCopy[goal].zh:goalPlanCopy[goal].en)}</p><div className="exercise-actions"><button onClick={()=>openExercise(ex)}><b>▶</b>{t.howTo}</button>{canEase&&<button className="easier" onClick={()=>makeEasier(ex)}><b>↓</b>{t.tooHard}</button>}</div></div><button className="card-swap-btn" onClick={()=>smartSwap(ex)} aria-label={`${language==="zh"?"换动作":"Swap"} ${language==="zh"?ex.zh:ex.en}`}><i>↻</i><span>{language==="zh"?"换动作":"SWAP"}</span></button></article>})}</section>
    {workout.length>previewCount&&<button className={`plan-exercise-toggle ${showExercises?"expanded":""}`} aria-expanded={showExercises} onClick={()=>setShowExercises(value=>!value)}><span><small>{showExercises?(language==="zh"?"精简视图":"SIMPLIFIED VIEW"):(language==="zh"?"完整计划":"FULL WORKOUT")}</small><strong>{showExercises?(language==="zh"?"收起后续动作，保持首页清爽":"Show only the next three movements"):(language==="zh"?`查看后续 ${workout.length-previewCount} 个动作`:`View the remaining ${workout.length-previewCount} movements`)}</strong></span><b>{showExercises?"−":"+"}</b></button>}
    {canLog&&<section className={`plan-complete-card ${todayLog?.completed?"done":todayLog?"missed":""}`} role="status">
      <div><small>ONE SET · QUICK LOG</small><strong>{todayLog?(todayLog.completed?(language==="zh"?"今天已完成":"Completed today"):(language==="zh"?"今天记录为未完成":"Marked incomplete today")):(language==="zh"?"练完了吗？15 秒记录状态":"Finished? Log it in 15 seconds")}</strong><span>{language==="zh"?"难度、精力和酸痛会用于自动调整下一次训练。":"Difficulty, energy, and soreness will adjust your next workout."}</span></div>
      <button onClick={complete}><span>{language==="zh"?"完成训练":"Finish workout"}</span><b>→</b></button>
    </section>}
    {canLog&&quickLogOpen&&<WorkoutFeedback
      inline
      language={language}
      finishing={quickLogSaving}
      initial={todayLog?{completed:todayLog.completed!==false,difficulty:todayLog.perceivedDifficulty??7,energy:todayLog.energyLevel??7,soreness:todayLog.sorenessLevel??4,notes:todayLog.notes||""}:undefined}
      back={cancelLog}
      choose={saveLog}
    />}
    <details className="plan-help-details"><summary>{language==="zh"?"训练设置与计划说明":"Training settings & plan details"}</summary>
    <section className={`beginner-banner ${noviceMode?"active":""}`}><div className="beginner-shield">✓</div><div><span>{t.beginnerMode}</span><strong>{noviceMode?(language==="zh"?"已开启 · 安全起步":"ON · SAFE START"):(language==="zh"?"已关闭":"OFF")}</strong><p>{t.beginnerDesc}</p></div><button className="ability-btn" onClick={openOnboarding}>{t.abilityCheck}<i>→</i></button><label className="mode-switch"><input type="checkbox" checked={noviceMode} onChange={e=>setNoviceMode(e.target.checked)}/><i/></label></section>
    <div className="quick-controls"><button onClick={openBuilder}><i>◷</i><span>{t.duration}<b>{duration} min</b></span><strong>{language==="zh"?"修改":"Edit"}</strong></button><button onClick={openBuilder}><i>◎</i><span>{t.focus}<b>{t[focus]}</b></span><strong>{language==="zh"?"修改":"Edit"}</strong></button><button onClick={openBuilder}><i>◇</i><span>{t.equipment}<b>{t[equipment]}</b></span><strong>{language==="zh"?"修改":"Edit"}</strong></button></div>
    {personalization&&<section className="personalization-strip"><i>✦</i><div><small>ONE SET · PERSONALIZED</small><strong>{language==="zh"?"这套计划已经根据你调整":"This plan was adjusted for you"}</strong><span>{personalization.painSwaps>0?(language==="zh"?`已替换 ${personalization.painSwaps} 个最近报告疼痛的动作`:`Replaced ${personalization.painSwaps} movement${personalization.painSwaps===1?"":"s"} with recent pain feedback`):(language==="zh"?"当前动作未发现需要规避的疼痛记录":"No recent pain flags in this plan")}</span></div><div className="personalization-tags">{personalization.advanced&&<b>✦ {language==="zh"?"高级资料已应用":"ADVANCED PROFILE"}</b>}<b>◷ {language==="zh"?`${duration} 分钟 · ${personalization.targetCount} 个动作`:`${duration} MIN · ${personalization.targetCount} MOVES`}</b>{personalization.favoritesUsed>0&&<b>★ {language==="zh"?`${personalization.favoritesUsed} 个收藏动作`:`${personalization.favoritesUsed} favorite${personalization.favoritesUsed===1?"":"s"}`}</b>}{personalization.historyAware&&<b>↗ {language==="zh"?"已检查训练历史":"HISTORY CHECKED"}</b>}<b>◇ {language==="zh"?"器械已匹配":"GEAR MATCHED"}</b></div></section>}
    <button className="warmup-row" onClick={openWarmup}><span className="warmup-icon">↗</span><div><small>00 · ONE SET PREP</small><strong>{t.warmup}</strong><p>{language==="zh"?"5 个动作 · 根据今天的训练自动匹配":"5 moves · Matched to today’s workout"}</p></div><span>5:00</span><b>›</b></button>
      <PlanWhy t={t} language={language} goal={goal} duration={duration} equipment={equipment} noviceMode={noviceMode} history={history}/>
    </details>
  </div>;
}

function LibraryLayerSwitch({language,layer,setLayer}:{language:Language;layer:LibraryLayer;setLayer:(layer:LibraryLayer)=>void}){
  const zh=language==="zh";
  return <section className="library-layer-switch" aria-label={zh?"选择动作库范围":"Choose exercise library scope"}>
    <button className={layer==="ready"?"active":""} aria-pressed={layer==="ready"} onClick={()=>setLayer("ready")}><span><small>{zh?"可直接加入训练":"WORKOUT READY"}</small><strong>{zh?"精选动作":"Curated exercises"}</strong></span><b>{exerciseLibrary.length}</b></button>
    <button className={layer==="catalog"?"active":""} aria-pressed={layer==="catalog"} onClick={()=>setLayer("catalog")}><span><small>{zh?"完整动作资料":"FULL REFERENCE"}</small><strong>{zh?"全部资料库":"Full catalog"}</strong></span><b>{EXERCISE_CATALOG_COUNT.toLocaleString()}</b></button>
  </section>;
}

const catalogBodyCopy:Record<string,{zh:string;en:string}>={waist:{zh:"核心",en:"Waist"},"upper legs":{zh:"大腿",en:"Upper legs"},back:{zh:"背部",en:"Back"},"lower legs":{zh:"小腿",en:"Lower legs"},chest:{zh:"胸部",en:"Chest"},"upper arms":{zh:"上臂",en:"Upper arms"},cardio:{zh:"心肺",en:"Cardio"},shoulders:{zh:"肩部",en:"Shoulders"},"lower arms":{zh:"前臂",en:"Lower arms"},neck:{zh:"颈部",en:"Neck"}};
const catalogLabel=(value:string,language:Language)=>catalogBodyCopy[value]?.[language]||value;

function FullExerciseCatalog({language,openExercise}:{language:Language;openExercise:(exercise:LibraryExercise)=>void}){
  const zh=language==="zh";
  const[items,setItems]=useState<CatalogExerciseIndex[]|null>(null);
  const[status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const[query,setQuery]=useState("");
  const[body,setBody]=useState("all");
  const[equipment,setEquipment]=useState("all");
  const[media,setMedia]=useState<"video"|"all">("video");
  const[visibleCount,setVisibleCount]=useState(40);
  const[selected,setSelected]=useState<CatalogExerciseDetail|null>(null);
  const[detailStatus,setDetailStatus]=useState<"idle"|"loading"|"error">("idle");
  const detailCache=useRef(new Map<string,CatalogExerciseDetail[]>());
  const loadIndex=useCallback(()=>{setStatus("loading");fetch(EXERCISE_CATALOG_INDEX_URL,{cache:"force-cache"}).then(async response=>{if(!response.ok)throw new Error("catalog unavailable");return response.json() as Promise<CatalogExerciseIndex[]>}).then(data=>{setItems(data);setStatus("ready")}).catch(()=>setStatus("error"))},[]);
  useEffect(()=>{loadIndex()},[loadIndex]);
  useEffect(()=>{setVisibleCount(40)},[query,body,equipment,media]);
  const bodies=useMemo(()=>[...new Set((items||[]).map(item=>item.bodyPart))].sort(),[items]);
  const equipmentOptions=useMemo(()=>[...new Set((items||[]).map(item=>item.equipment))].sort(),[items]);
  const videoCount=useMemo(()=>(items||[]).filter(item=>Boolean(item.trainingReadyId&&getExerciseTutorial(item.trainingReadyId))).length,[items]);
  const filtered=useMemo(()=>{const needle=query.trim().toLowerCase();return (items||[]).filter(item=>(media==="all"||Boolean(item.trainingReadyId&&getExerciseTutorial(item.trainingReadyId)))&&(body==="all"||item.bodyPart===body)&&(equipment==="all"||item.equipment===equipment)&&(!needle||`${item.name} ${item.target} ${item.muscleGroup} ${item.secondaryMuscles.join(" ")} ${item.equipment}`.toLowerCase().includes(needle)))},[items,query,body,equipment,media]);
  const openCatalogDetail=async(item:CatalogExerciseIndex)=>{setDetailStatus("loading");setSelected(null);const shard=item.id.slice(0,2);try{let entries=detailCache.current.get(shard);if(!entries){const response=await fetch(exerciseCatalogDetailUrl(item.id),{cache:"force-cache"});if(!response.ok)throw new Error("detail unavailable");entries=await response.json() as CatalogExerciseDetail[];detailCache.current.set(shard,entries)}const detail=entries.find(entry=>entry.id===item.id);if(!detail)throw new Error("detail missing");setSelected(detail);setDetailStatus("idle")}catch{setDetailStatus("error")}};
  const closeDetail=()=>{setSelected(null);setDetailStatus("idle")};
  const openReady=(id:string)=>{const exercise=exerciseLibrary.find(item=>item.id===id);if(exercise){closeDetail();openExercise(exercise)}};
  const selectedTutorial=selected?.trainingReadyId?getExerciseTutorial(selected.trainingReadyId):null;
  const selectedSteps=selected?(zh&&selected.instructionStepsZh.length?selected.instructionStepsZh:selected.instructionStepsEn):[];
  const selectedSource=selected?.source==="free-exercise-db"?"FREE EXERCISE DB":selected?.source==="wger"?"WGER COMMUNITY":"EXERCISES DATASET";
  return <>
    <section className="catalog-intro video-first"><div><small>ONE SET · LICENSED VIDEO FIRST</small><h2>{zh?"先看真人动作，再读训练要点":"Watch the movement first. Read the coaching second."}</h2><p>{zh?`默认展示 ${videoCount} 个已精确匹配、确认授权的真人视频动作；其余资料可切换查看，但不会伪装成视频教学。`:`Showing ${videoCount} exactly matched, licensed real-person demos first. Text-only references remain optional and are never presented as video coaching.`}</p></div><b>▶ {zh?"真人短视频":"REAL VIDEO"}</b></section>
    <section className="catalog-search video-search" aria-label={zh?"搜索完整动作资料库":"Search the full exercise catalog"}><label><span>{zh?"搜索动作或肌群":"SEARCH MOVEMENT OR MUSCLE"}</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={zh?"例如：squat、glutes、dumbbell":"Try squat, glutes, or dumbbell"}/></label><label><span>{zh?"演示类型":"DEMO TYPE"}</span><select value={media} onChange={event=>setMedia(event.target.value as "video"|"all")}><option value="video">{zh?`真人视频 ${videoCount}`:`Real video ${videoCount}`}</option><option value="all">{zh?`全部资料 ${EXERCISE_CATALOG_COUNT.toLocaleString()}`:`All ${EXERCISE_CATALOG_COUNT.toLocaleString()} references`}</option></select></label><label><span>{zh?"身体部位":"BODY AREA"}</span><select value={body} onChange={event=>setBody(event.target.value)}><option value="all">{zh?"全部部位":"All areas"}</option>{bodies.map(value=><option key={value} value={value}>{catalogLabel(value,language)}</option>)}</select></label><label><span>{zh?"器械":"EQUIPMENT"}</span><select value={equipment} onChange={event=>setEquipment(event.target.value)}><option value="all">{zh?"全部器械":"All equipment"}</option>{equipmentOptions.map(value=><option key={value} value={value}>{value}</option>)}</select></label></section>
    {status==="error"?<section className="catalog-state" role="alert"><strong>{zh?"动作资料暂时无法载入":"The catalog could not load"}</strong><span>{zh?"请检查网络后重试。精选动作仍然可以正常使用。":"Check your connection and retry. Curated exercises still work normally."}</span><button onClick={loadIndex}>{zh?"重新载入":"Retry"}</button></section>:status==="loading"?<section className="catalog-state catalog-loading" aria-live="polite"><strong>{zh?"正在载入完整动作库…":"Loading the full catalog…"}</strong><span>{zh?"首页和一键训练不会因此变慢。":"The home screen and workout generator stay fast."}</span></section>:<>
      <div className="catalog-results"><span><strong>{filtered.length.toLocaleString()}</strong> {media==="video"?(zh?"个真人视频动作":"real-video movements"):(zh?"条匹配资料":"matching references")}</span>{(query||body!=="all"||equipment!=="all"||media!=="video")&&<button onClick={()=>{setQuery("");setBody("all");setEquipment("all");setMedia("video")}}>{zh?"重置":"Reset"} ↻</button>}</div>
      {filtered.length?<section className="catalog-list video-catalog-list">{filtered.slice(0,visibleCount).map(item=>{const tutorial=item.trainingReadyId?getExerciseTutorial(item.trainingReadyId):null;return <button key={item.id} onClick={()=>void openCatalogDetail(item)}>{tutorial?<i className="catalog-video-thumb"><img src={tutorial.poster} width="96" height="96" loading="lazy" alt=""/><b>▶</b></i>:<i>{item.id}</i>}<span><small>{catalogLabel(item.bodyPart,language)} · {item.equipment}</small><strong>{item.name}</strong><em>{item.target}{tutorial?` · ${zh?"真人视频":"REAL VIDEO"}`:item.trainingReadyId?` · ${zh?"训练就绪":"WORKOUT READY"}`:""}</em></span><b>›</b></button>})}</section>:<section className="catalog-state"><strong>{zh?"没有找到匹配动作":"No matching movement"}</strong><span>{zh?"试试英文动作名、目标肌群，或减少筛选条件。":"Try an English exercise name, target muscle, or fewer filters."}</span></section>}
      {visibleCount<filtered.length&&<button className="catalog-load-more" onClick={()=>setVisibleCount(count=>count+40)}><span>{zh?"加载更多":"Load more"}<small>{Math.min(visibleCount,filtered.length)} / {filtered.length}</small></span><b>＋</b></button>}
    </>}
    {(detailStatus!=="idle"||selected)&&<div className="catalog-detail-backdrop" role="presentation" onClick={closeDetail}><section className="catalog-detail" role="dialog" aria-modal="true" aria-label={zh?"动作资料详情":"Exercise reference detail"} onClick={event=>event.stopPropagation()}><button className="catalog-detail-close" onClick={closeDetail} aria-label={zh?"关闭动作资料":"Close exercise detail"}>×</button>{detailStatus==="loading"?<div className="catalog-detail-state">{zh?"正在载入动作说明…":"Loading instructions…"}</div>:detailStatus==="error"?<div className="catalog-detail-state"><strong>{zh?"动作说明载入失败":"Instructions could not load"}</strong><button onClick={closeDetail}>{zh?"关闭":"Close"}</button></div>:selected&&<><header><small>{selectedSource} · ID {selected.sourceId}</small><h2>{selected.name}</h2><p>{catalogLabel(selected.bodyPart,language)} · {selected.equipment}</p></header>{selectedTutorial&&<section className="catalog-video-player" aria-label={zh?"真人动作视频演示":"Real-person exercise video demonstration"}><div><video controls playsInline preload="metadata" poster={selectedTutorial.poster}><source src={selectedTutorial.src} type="video/mp4"/></video><span>▶ {zh?"真人短视频演示":"REAL-PERSON DEMO"}</span></div><p>{zh?`来源：${selectedTutorial.provider} · ${selectedTutorial.license}`:`Source: ${selectedTutorial.provider} · ${selectedTutorial.license}`} · <a href={selectedTutorial.sourceUrl} target="_blank" rel="noreferrer">{zh?"查看授权来源":"View licensed source"}</a></p></section>}<div className="catalog-detail-facts"><span><small>{zh?"主要目标":"TARGET"}</small><strong>{selected.target}</strong></span><span><small>{zh?"肌群":"MUSCLE GROUP"}</small><strong>{selected.muscleGroup}</strong></span><span><small>{zh?"协同肌群":"SECONDARY"}</small><strong>{selected.secondaryMuscles.slice(0,3).join(" · ")||"—"}</strong></span></div><section><small>{zh?"分步说明":"STEP-BY-STEP"}</small>{zh&&!selected.instructionStepsZh.length&&<p className="catalog-reference-note">中文翻译待审核，以下暂显示英文来源说明。</p>}<ol>{selectedSteps.map((step,index)=><li key={`${selected.id}-${index}`}><b>{String(index+1).padStart(2,"0")}</b><span>{step}</span></li>)}</ol></section>{selected.trainingReadyId?<button className="catalog-ready-action" onClick={()=>openReady(selected.trainingReadyId!)}><span>{zh?"打开完整 ONE SET 教学":"Open complete ONE SET coaching"}<small>{zh?"查看关键要点、常见错误和替代动作":"See cues, common mistakes, and alternatives"}</small></span><b>→</b></button>:<p className="catalog-reference-note">{zh?"资料库动作 · 暂未进入自动训练计划。说明仅供训练参考，不替代医疗建议。":"Reference movement · Not yet available in generated workouts. Training guidance is not medical advice."}</p>}<footer>{selected.source==="free-exercise-db"?(zh?"Free Exercise DB 公共领域文字资料；来源未核验的图片未导入。":"Free Exercise DB public-domain text; images with unverified provenance are excluded."):selected.source==="wger"?<>{zh?`wger 社区文字资料 · ${selected.licenseAuthor} · ${selected.license}`:`wger community text · ${selected.licenseAuthor} · ${selected.license}`} {selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank" rel="noreferrer">{zh?"查看原始记录":"View source"} ↗</a>}</>:(zh?"MIT 动作文字资料；Gym Visual 图片和 GIF 未导入。":"MIT exercise text; Gym Visual images and GIFs are excluded.")}</footer></>}</section></div>}
  </>;
}

function Library({t,language,query,setQuery,filter,setFilter,targetFilter,setTargetFilter,gearFilter,setGearFilter,libraryType,setLibraryType,favoriteIds,recentIds,exercises,openExercise}:{t:Copy;language:Language;query:string;setQuery:(x:string)=>void;filter:BodyPart|"all";setFilter:(x:BodyPart|"all")=>void;targetFilter:LibraryTarget;setTargetFilter:(x:LibraryTarget)=>void;gearFilter:Gear|"all";setGearFilter:(x:Gear|"all")=>void;libraryType:LibraryType;setLibraryType:(x:LibraryType)=>void;favoriteIds:string[];recentIds:string[];exercises:LibraryExercise[];openExercise:(x:LibraryExercise)=>void}) {
  useEffect(()=>{document.querySelectorAll<HTMLInputElement>(".library-page .search-box input").forEach(input=>input.setAttribute("aria-label",language==="zh"?"搜索动作":"Search exercises"))},[language]);
  const[filtersOpen,setFiltersOpen]=useState(false);
  const zh=language==="zh";
  const[layer,setLayer]=useState<LibraryLayer>("ready");
  const filters:(BodyPart|"all")[]=["all","chest","back","lower","shoulders","arms","core"];
  const targets:LibraryTarget[]=["all","glutes","quads","hamstrings","lats","upperBack","biceps","triceps","abs","stability"];
  const gears:(Gear|"all")[]=["all","bodyweight","dumbbell","machine","cable","kettlebell","barbell"];
  const types:LibraryType[]=["all","favorites","beginner","intermediate","mobility"];
  const targetName=(target:LibraryTarget)=>target==="all"?t.all:buildAreaNames[language][target];
  const hasFilters=Boolean(query.trim())||filter!=="all"||targetFilter!=="all"||gearFilter!=="all"||libraryType!=="all";
  const activeFilterCount=[filter!=="all",targetFilter!=="all",gearFilter!=="all",libraryType!=="all"].filter(Boolean).length;
  const reset=()=>{setQuery("");setFilter("all");setTargetFilter("all");setGearFilter("all");setLibraryType("all")};
  const beginnerCount=exerciseLibrary.filter(ex=>ex.level==="beginner"&&!mobilityIds.has(ex.id)).length;
  const bodyweightCount=exerciseLibrary.filter(ex=>ex.gear==="bodyweight").length;
  const mobilityCount=exerciseLibrary.filter(ex=>mobilityIds.has(ex.id)).length;
  const chooseCollection=(collection:"beginner"|"bodyweight"|"mobility")=>{setQuery("");setFilter("all");setTargetFilter("all");setGearFilter(collection==="bodyweight"?"bodyweight":"all");setLibraryType(collection==="bodyweight"?"all":collection);setFiltersOpen(false)};
  const patterns=[{id:"push",icon:"↑",zh:"推",en:"Push",zhHint:"胸、肩与三头",enHint:"Chest · shoulders · triceps"},{id:"pull",icon:"←",zh:"拉",en:"Pull",zhHint:"背、背阔与二头",enHint:"Back · lats · biceps"},{id:"squat",icon:"↓",zh:"深蹲",en:"Squat",zhHint:"膝主导下肢",enHint:"Knee-dominant lower body"},{id:"hinge",icon:"↘",zh:"髋铰链",en:"Hinge",zhHint:"臀部与后侧链",enHint:"Glutes · posterior chain"},{id:"core",icon:"◎",zh:"核心",en:"Core",zhHint:"稳定与控制",enHint:"Stability · control"}] as const;
  const choosePattern=(pattern:(typeof patterns)[number]["id"])=>{setQuery(pattern);setFilter("all");setTargetFilter("all");setGearFilter("all");setLibraryType("all");setFiltersOpen(false)};
  const bodyFocusIcons:Record<BodyPart,string>={chest:"↗",back:"↙",shoulders:"↑",arms:"↔",lower:"↓",core:"◎"};
  const bodyFocus=(["chest","back","shoulders","arms","lower","core"] as BodyPart[]).map(area=>{const moves=exerciseLibrary.filter(ex=>ex.body===area&&!mobilityIds.has(ex.id));return {area,count:moves.length,preview:moves.find(ex=>ex.level==="beginner")||moves[0]}});
  const chooseBodyFocus=(area:BodyPart)=>{setQuery("");setFilter(area);setTargetFilter("all");setGearFilter("all");setLibraryType("all");setFiltersOpen(false)};
  const typeName=(type:LibraryType)=>type==="all"?t.all:type==="favorites"?(language==="zh"?`收藏 ${favoriteIds.length}`:`Favorites ${favoriteIds.length}`):type==="beginner"?(language==="zh"?`入门动作 ${exerciseLibrary.filter(ex=>ex.level==="beginner"&&!mobilityIds.has(ex.id)).length}`:`Beginner · ${exerciseLibrary.filter(ex=>ex.level==="beginner"&&!mobilityIds.has(ex.id)).length}`):type==="intermediate"?(language==="zh"?`进阶动作 ${exerciseLibrary.filter(ex=>ex.level==="intermediate").length}`:`Intermediate · ${exerciseLibrary.filter(ex=>ex.level==="intermediate").length}`):(language==="zh"?`活动度 ${exerciseLibrary.filter(ex=>mobilityIds.has(ex.id)).length}`:`Mobility · ${exerciseLibrary.filter(ex=>mobilityIds.has(ex.id)).length}`);
  const recentExercises=recentIds.map(id=>exerciseLibrary.find(ex=>ex.id===id)).filter(Boolean) as LibraryExercise[];
  const favoriteExercises=favoriteIds.map(id=>exerciseLibrary.find(ex=>ex.id===id)).filter(Boolean) as LibraryExercise[];
  if(layer==="catalog")return <div className="page library-page"><section className="page-heading"><div><p>ONE SET MOVEMENT DATABASE</p><h1>{t.library}</h1></div><span className="database-count">{EXERCISE_CATALOG_COUNT.toLocaleString()}<small>REFERENCES</small></span></section><LibraryLayerSwitch language={language} layer={layer} setLayer={setLayer}/><FullExerciseCatalog language={language} openExercise={openExercise}/><p className="source">{zh?"资料来源：Exercises Dataset + Free Exercise DB + wger。仅接入许可明确的文字资料；媒体继续逐条审核。":"Sources: Exercises Dataset + Free Exercise DB + wger. Only clearly licensed text data is imported; media remains individually reviewed."}</p></div>;
  return <div className="page library-page"><section className="page-heading"><div><p>ONE SET MOVEMENT DATABASE</p><h1>{t.library}</h1></div><span className="database-count">{exerciseLibrary.length}<small>READY</small></span></section><LibraryLayerSwitch language={language} layer={layer} setLayer={setLayer}/>
     <div className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/><button className={query?"visible":""} disabled={!query} onClick={()=>setQuery("")} aria-label={language==="zh"?"清除搜索":"Clear search"}>×</button></div>
     {recentExercises.length>0&&!query.trim()&&<section className="library-recent" aria-label={language==="zh"?"最近查看的动作":"Recently viewed movements"}><header><div><small>{language==="zh"?"最近查看":"RECENTLY VIEWED"}</small><strong>{language==="zh"?"继续你的动作学习":"Pick up where you left off"}</strong></div><span>{recentExercises.length}/6</span></header><div>{recentExercises.map(ex=><button key={ex.id} onClick={()=>openExercise(ex)}><ExerciseImage ex={ex}/><span>{language==="zh"?ex.zh:ex.en}</span></button>)}</div></section>}
     {favoriteExercises.length>0&&!query.trim()&&<section className="library-recent library-favorites-quick" aria-label={language==="zh"?"我的收藏动作":"Favorite movements"}><header><div><small>{language==="zh"?"我的收藏":"FAVORITES"}</small><strong>{language==="zh"?"快速复习常用动作":"Your go-to movements"}</strong></div><span>{favoriteExercises.length}</span></header><div>{favoriteExercises.slice(0,6).map(ex=><button key={ex.id} onClick={()=>openExercise(ex)}><ExerciseImage ex={ex}/><span>{language==="zh"?ex.zh:ex.en}</span></button>)}</div></section>}
     {!hasFilters&&<section className="library-body-focus" aria-label={zh?"按训练部位浏览动作":"Browse exercises by body area"}><header><div><small>{zh?"想练哪里？":"CHOOSE A BODY AREA"}</small><strong>{zh?"先选部位，再看适合你的短视频动作":"Pick an area. We’ll show the right short-video movements."}</strong></div><span>{zh?"每个动作均含教学":"EVERY MOVE TEACHES"}</span></header><div>{bodyFocus.map(item=><button onClick={()=>chooseBodyFocus(item.area)} key={item.area}><span className="library-body-motion">{item.preview&&<ExerciseImage ex={item.preview}/>}</span><i>{bodyFocusIcons[item.area]}</i><span><small>{item.count} {zh?"个动作":"MOVES"}</small><strong>{bodyNames[language][item.area]}</strong><em>{zh?"查看教学":"Watch & learn"}</em></span><b>→</b></button>)}</div></section>}
     {!hasFilters&&<section className="library-start-here" aria-label={zh?"动作学习起点":"Where to start learning"}><header><div><small>{zh?"从这里开始":"START HERE"}</small><strong>{zh?"不知道选什么？先选一种学习方式":"Not sure where to begin? Pick a learning path."}</strong></div><span>{zh?"全部都有短视频":"SHORT VIDEO INCLUDED"}</span></header><div><button onClick={()=>chooseCollection("beginner")}><i>01</i><span><small>{zh?"适合第一次训练":"NEW TO TRAINING"}</small><strong>{zh?"新手动作":"Beginner moves"}</strong><em>{beginnerCount} {zh?"个基础动作":"foundation moves"}</em></span><b>→</b></button><button onClick={()=>chooseCollection("bodyweight")}><i>02</i><span><small>{zh?"不用器械":"NO EQUIPMENT"}</small><strong>{zh?"徒手可练":"Bodyweight only"}</strong><em>{bodyweightCount} {zh?"个随时可练":"train-anywhere moves"}</em></span><b>→</b></button><button onClick={()=>chooseCollection("mobility")}><i>03</i><span><small>{zh?"训练前准备":"PREP YOUR BODY"}</small><strong>{zh?"活动度准备":"Mobility prep"}</strong><em>{mobilityCount} {zh?"个动态准备":"dynamic prep moves"}</em></span><b>→</b></button></div></section>}
     {!hasFilters&&<section className="library-patterns" aria-label={zh?"按动作模式学习":"Browse by movement pattern"}><header><div><small>{zh?"按动作模式浏览":"MOVEMENT PATTERNS"}</small><strong>{zh?"不知道动作名？从你想练的动作方式开始":"Don’t know the name? Start with how you want to move."}</strong></div><span>{zh?"短视频教学":"SHORT VIDEO COACHING"}</span></header><div>{patterns.map(pattern=><button key={pattern.id} onClick={()=>choosePattern(pattern.id)}><i>{pattern.icon}</i><span><strong>{zh?pattern.zh:pattern.en}</strong><small>{zh?pattern.zhHint:pattern.enHint}</small></span><b>→</b></button>)}</div></section>}
    <section className="library-filter-summary">
      <button className="library-filter-toggle" onClick={()=>setFiltersOpen(open=>!open)} aria-expanded={filtersOpen} aria-label={zh?"展开动作筛选":"Expand exercise filters"}><span><small>{zh?"快速找到动作":"QUICK BROWSE"}</small><strong>{activeFilterCount>0?(zh?`已应用 ${activeFilterCount} 个筛选`:`${activeFilterCount} filter${activeFilterCount===1?"":"s"} applied`):(zh?"按部位、器械或难度筛选":"Filter by body area, equipment or level")}</strong></span><b>{filtersOpen?"−":"+"}</b></button>
    {filtersOpen&&<section className="library-filters" aria-label={language==="zh"?"动作筛选":"Exercise filters"}>
      <div className="filter-group"><header><span>01</span><strong>{language==="zh"?"身体部位":"BODY AREA"}</strong></header><div className="filter-chips">{filters.map(x=><button className={filter===x?"active":""} aria-pressed={filter===x} key={x} onClick={()=>setFilter(x)}>{x==="all"?t.all:bodyNames[language][x]}</button>)}</div></div>
      <div className="filter-group library-muscle-filter"><header><span>02</span><strong>{language==="zh"?"细分肌群":"MUSCLE FOCUS"}</strong></header><div className="filter-chips">{targets.map(target=><button className={targetFilter===target?"active":""} aria-pressed={targetFilter===target} key={target} onClick={()=>setTargetFilter(target)}>{targetName(target)}</button>)}</div></div>
      <div className="filter-group"><header><span>03</span><strong>{language==="zh"?"可用器械":"EQUIPMENT"}</strong></header><div className="filter-chips">{gears.map(x=><button className={gearFilter===x?"active":""} aria-pressed={gearFilter===x} key={x} onClick={()=>setGearFilter(x)}>{x==="all"?t.all:gearNames[language][x]}</button>)}</div></div>
      <div className="filter-group"><header><span>04</span><strong>{language==="zh"?"动作类型":"MOVEMENT TYPE"}</strong></header><div className="filter-chips">{types.map(x=><button className={libraryType===x?"active":""} aria-pressed={libraryType===x} key={x} onClick={()=>setLibraryType(x)}>{typeName(x)}</button>)}</div></div>
    </section>}</section>
    <div className="library-results"><span><strong>{exercises.length}</strong> {language==="zh"?"个匹配动作":"matching movements"}</span>{hasFilters&&<button onClick={reset}>{language==="zh"?"重置全部":"Reset all"} ↻</button>}</div>
    {exercises.length?<section className="library-list">{exercises.map(ex=>{const mobility=mobilityIds.has(ex.id);const favorite=favoriteIds.includes(ex.id);const levelLabel=mobility?"PREP":ex.level==="beginner"?(language==="zh"?"新手":"BEGINNER"):(language==="zh"?"进阶":"INTERMEDIATE");const teachingLabel=mobility?(language==="zh"?"动态活动度 · 点击学习":"DYNAMIC MOBILITY · TAP TO LEARN"):(language==="zh"?"短视频示范 · 点击学习":"SHORT VIDEO · TAP TO LEARN");const mediaLabel=mobility?(language==="zh"?"活动度":"MOBILITY"):(language==="zh"?"短视频":"VIDEO");return <button key={ex.id} onClick={()=>openExercise(ex)} aria-label={`${language==="zh"?ex.zh:ex.en} · ${teachingLabel}`}><div className="library-photo sequence"><ExerciseImage ex={ex}/><span>{levelLabel}</span>{favorite&&<b className="favorite-mark" aria-label={language==="zh"?"已收藏":"Favorite"}>★</b>}<em>{mediaLabel}</em></div><div><small>{bodyNames[language][ex.body]} · {gearNames[language][ex.gear]}</small><strong>{language==="zh"?ex.zh:ex.en}</strong><p>{language==="zh"?ex.primaryZh:ex.primaryEn} · {localizedReps(ex.reps,language)}</p><b className="library-teaching-label">{teachingLabel}</b></div><i>›</i></button>})}</section>:<section className="library-empty"><i>{libraryType==="favorites"?"☆":"⌕"}</i><strong>{libraryType==="favorites"?(language==="zh"?"还没有收藏动作":"No favorite movements yet"):(language==="zh"?"没有找到符合条件的动作":"No movements match these filters")}</strong><span>{libraryType==="favorites"?(language==="zh"?"打开动作详情，点击收藏后会显示在这里。":"Open a movement and tap Favorite to keep it here."):(language==="zh"?"可以减少一个筛选条件，或重置后重新搜索。":"Remove one filter or reset everything to search again.")}</span><button onClick={reset}>{language==="zh"?"重置全部筛选":"Reset all filters"}</button></section>}<p className="source">{t.source}</p>
  </div>;
}

function ScanProgressPanel({language,openScan,openPosture,resumeCorrection}:{language:Language;openScan:()=>void;openPosture:()=>void;resumeCorrection:(source:CorrectionSource,metricKeys:string[])=>void}){
  type ScanRow={id:string;date:string;score:number;confidence:number;pending?:boolean};
  const[formScans,setFormScans]=useState<ScanRow[]>([]);const[postureScans,setPostureScans]=useState<ScanRow[]>([]);
  const[cycle,setCycle]=useState<ReturnType<typeof correctionCycleState>>(null);
  useEffect(()=>{const apply=(records:unknown)=>{const rows=Array.isArray(records)?records:[];setFormScans(rows.filter(item=>item&&typeof item==="object"&&(item as {type?:string}).type==="form") as ScanRow[]);setPostureScans(rows.filter(item=>item&&typeof item==="object"&&(item as {type?:string}).type==="posture") as ScanRow[])};const load=()=>{try{apply(readScanRecords())}catch{apply([])}};load();void loadSyncedScans().then(apply);void syncPendingScans().then(result=>apply(result.records));window.addEventListener("form-ai-scans-changed",load);const online=()=>{void syncPendingScans().then(result=>apply(result.records))};window.addEventListener("online",online);return()=>{window.removeEventListener("form-ai-scans-changed",load);window.removeEventListener("online",online)}},[]);
  useEffect(()=>{const load=()=>setCycle(correctionCycleState(readCorrectionCycle()));load();window.addEventListener(CORRECTION_CYCLE_EVENT,load);return()=>window.removeEventListener(CORRECTION_CYCLE_EVENT,load)},[]);
  const zh=language==="zh";const recentCount=[...formScans,...postureScans].filter(row=>Date.now()-new Date(row.date).getTime()<28*86400000).length;const consistency=Math.min(100,recentCount*16);const latestForm=formScans[0];const latestPosture=postureScans[0];const score=latestForm&&latestPosture?Math.round(latestForm.score*.65+latestPosture.score*.2+consistency*.15):latestForm?Math.round(latestForm.score*.82+consistency*.18):latestPosture?Math.round(latestPosture.score*.82+consistency*.18):null;const change=latestForm&&formScans[1]?latestForm.score-formScans[1].score:null;
  const timeline=[...formScans.map(row=>({...row,type:"form" as const})),...postureScans.map(row=>({...row,type:"posture" as const}))].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,5);
  const rescan=()=>cycle?.source==="posture"?openPosture():openScan();
  const focusLabel=cycle?.source==="posture"?(zh?"体态控制":"Posture control"):(zh?"深蹲动作":"Squat form");
   const dayNumber=cycle?Math.min(7,Math.max(1,8-cycle.daysLeft)):1;
   useEffect(()=>{const action=document.querySelector<HTMLButtonElement>(".scan-progress-actions button:first-child");const title=action?.querySelector("strong");const detail=action?.querySelector("small");if(title)title.textContent=latestForm?(zh?"复扫深蹲":"Rescan squat"):(zh?"开始深蹲扫描":"Start squat scan");if(detail)detail.textContent=latestForm?(zh?"验证修正是否有效":"Check whether the fix worked"):(zh?"免费建立第一次基准":"Create your free baseline")},[latestForm,zh]);
  return <section className="scan-progress-panel"><header><div><small>练一下 · ONE SET · PROGRESS LOOP</small><h2>{zh?"训练表现分":"Training Score"}</h2><p>{zh?"只汇总可观察的动作、体态趋势和复扫一致性。":"Built only from observable movement, posture trends, and rescan consistency."}</p></div><strong>{score??"--"}<i>/100</i></strong></header>
    {cycle&&<section className={`correction-cycle-card ${cycle.status}`}><header><div><small>{cycle.status==="active"?`7-DAY FIX · DAY ${dayNumber}`:"FIX CYCLE · COMPLETE"}</small><h3>{cycle.status==="active"?(zh?`${focusLabel}纠正周期`:`${focusLabel} fix cycle`):(zh?"本轮复扫已完成":"Rescan complete")}</h3><p>{cycle.status==="active"?(cycle.rescanReady?(zh?"纠正训练已达标，现在复扫验证变化。":"Your correction work is complete. Rescan to verify the change."):(zh?`先完成 ${cycle.targetWorkouts} 次短训练，再用相同角度复扫。`:`Complete ${cycle.targetWorkouts} short sessions, then rescan from the same angle.`)):(zh?`从 ${cycle.baselineScore} 到 ${cycle.latestScore}，只比较可观察表现。`:`From ${cycle.baselineScore} to ${cycle.latestScore}, based only on observable performance.`)}</p></div>{cycle.status==="active"?<b>{cycle.workoutsCompleted}<i>/{cycle.targetWorkouts}</i></b>:<b className={(cycle.improvement??0)>=0?"positive":"negative"}>{(cycle.improvement??0)>0?"+":""}{cycle.improvement??0}</b>}</header>
      {cycle.status==="active"?<><div className="cycle-session-track">{Array.from({length:cycle.targetWorkouts}).map((_,index)=><i className={index<cycle.workoutsCompleted?"done":""} key={index}>{index<cycle.workoutsCompleted?"✓":index+1}</i>)}<span><small>{zh?"建议复扫":"RESCAN TARGET"}</small><strong>{cycle.rescanReady?(zh?"现在可以复扫":"Ready now"):(zh?`${cycle.daysLeft} 天后`:`In ${cycle.daysLeft} day${cycle.daysLeft===1?"":"s"}`)}</strong></span></div><div className="cycle-actions"><button onClick={cycle.rescanReady?rescan:()=>resumeCorrection(cycle.source,cycle.metricKeys)}><span>{cycle.rescanReady?(zh?"开始复扫":"Start rescan"):(zh?`继续第 ${Math.min(cycle.targetWorkouts,cycle.workoutsCompleted+1)} 次纠正训练`:`Continue session ${Math.min(cycle.targetWorkouts,cycle.workoutsCompleted+1)}`)}</span><b>→</b></button>{!cycle.rescanReady&&<button onClick={rescan}>{zh?"提前复扫":"Rescan early"}</button>}</div></>:<div className="cycle-complete-row"><span><small>{zh?"个人基准":"BASELINE"}</small><strong>{cycle.baselineScore}</strong></span><i>→</i><span><small>{zh?"最新复扫":"LATEST"}</small><strong>{cycle.latestScore}</strong></span><button onClick={rescan}>{zh?"开始下一轮":"Start next cycle"} →</button></div>}
    </section>}
    <div className="scan-score-grid"><article><span>{zh?"深蹲动作":"Squat form"}</span><b>{latestForm?.score??"--"}</b><small>{change===null?(zh?"等待基准":"No comparison yet"):change===0?"→ 0":`${change>0?"↑ +":"↓ "}${change}`}</small></article><article><span>{zh?"体态趋势":"Posture trend"}</span><b>{latestPosture?.score??"--"}</b><small>{latestPosture?(zh?"基准已保存":"BASELINE SAVED"):(zh?"尚未扫描":"NOT SCANNED")}</small></article><article><span>{zh?"复扫一致性":"Consistency"}</span><b>{score===null?"--":consistency}</b><small>{recentCount} {zh?"次 / 28 天":"SCANS / 28 DAYS"}</small></article></div><div className="scan-progress-actions"><button onClick={openScan}><i>▶</i><span><strong>{zh?"复扫深蹲":"Rescan squat"}</strong><small>{zh?"验证修正是否有效":"Check whether the fix worked"}</small></span><b>→</b></button><button onClick={openPosture}><i>◎</i><span><strong>{zh?"体态趋势照片":"Posture trend photos"}</strong><small>{zh?"保持相同拍摄条件":"Use the same photo setup"}</small></span><b>→</b></button></div>{timeline.length>0&&<div className="scan-timeline"><small>{zh?"最近扫描":"RECENT SCANS"}</small>{timeline.map(row=>{const date=new Date(row.date);return <p key={`${row.type}-${row.id}`}><i>{row.type==="form"?"▶":"◎"}</i><span><strong>{row.type==="form"?(zh?"深蹲动作扫描":"Squat form scan"):(zh?"体态趋势扫描":"Posture trend scan")}</strong><small>{date.toLocaleDateString(zh?"zh-CN":"en-US",{month:"short",day:"numeric",year:"numeric"})} · {row.confidence}% {zh?"可信度":"confidence"}{row.pending?(zh?" · 等待同步":" · Pending sync"):""}</small></span><b>{row.score}</b></p>})}</div>}</section>;
}

function Progress({t,language,syncState,history,weeklyGoal,openPlan,openToday,buildFocused,openScan,openPosture,resumeCorrection}:{t:Copy;language:Language;syncState:SyncState;history:WorkoutLog[];weeklyGoal:number;openPlan:()=>void;openToday:()=>void;buildFocused:(focus:Focus)=>void;openScan:()=>void;openPosture:()=>void;resumeCorrection:(source:CorrectionSource,metricKeys:string[])=>void}) {
  const[deviceRecent,setDeviceRecent]=useState<WorkoutLog[]>([]);
  useEffect(()=>{let active=true;void getLogsForLast7Days(DEFAULT_USER_ID).then(logs=>{if(active)setDeviceRecent(logs.map(fromStoredWorkout))});return()=>{active=false}},[history.length]);
  const recentHistory=useMemo(()=>{
    const merged=trainingRecords([...history,...deviceRecent]) as WorkoutLog[];
    return merged.filter((log,index,items)=>items.findIndex(candidate=>sameWorkoutDay(candidate.date,log.date))===index);
  },[history,deviceRecent]);
  useEffect(()=>{document.querySelectorAll<HTMLSelectElement>(".progress-page .heading-actions select").forEach(select=>select.setAttribute("aria-label",language==="zh"?"时间范围":"Time range"))},[language]);
  const syncCopy=syncState==="local"?(language==="zh"?"本机模式 · 未连接云端":"DEVICE ONLY · CLOUD NOT CONNECTED"):syncState==="synced"?(language==="zh"?"已同步":"SYNCED"):syncState==="saving"?(language==="zh"?"正在保存":"SAVING"):syncState==="loading"?(language==="zh"?"正在载入":"LOADING"):syncState==="offline"?(language==="zh"?"本机已保存 · 云端未同步":"SAVED ON DEVICE · NOT SYNCED"):(language==="zh"?"同步失败":"SYNC ERROR");
  return <div className="page progress-page focused-progress"><section className="page-heading"><div><p>{language==="zh"?"训练 · 进度 · 扫描修正":"TRAIN · PROGRESS · SCAN · FIX · RESCAN"}</p><h1>{t.progress}</h1></div><span className={`sync-badge ${syncState}`}>● {syncCopy}</span></section>
    <SevenDayReviewCard language={language} history={recentHistory} weeklyGoal={weeklyGoal}/>
<WeeklyCoachCard language={language} history={recentHistory} weeklyGoal={weeklyGoal} openPlanBase={openPlan} openToday={openToday} buildFocused={buildFocused}/>
    <LastSessionGuide language={language} history={recentHistory}/>
    <TrainingHistoryPreview language={language} history={recentHistory} openPlan={openPlan}/>
    <ScanProgressPanel language={language} openScan={openScan} openPosture={openPosture} resumeCorrection={resumeCorrection}/>
  </div>;
}

function SevenDayReviewCard({language,history,weeklyGoal}:{language:Language;history:WorkoutLog[];weeklyGoal:number}){
  const zh=language==="zh";const review=buildSevenDayReview(history,weeklyGoal) as {plannedWorkouts:number;completedWorkouts:number;completionRate:number;averageEnergy:number;averageSoreness:number;averageDifficulty:number;riskFlags:string[];nextWorkoutSuggestion:string;nextWeekAdjustment:string;recent:WorkoutLog[]};
  const insufficientData=review.recent.length<2;
  const riskCopy:Record<string,{zh:string;en:string}>={low_completion:{zh:"完成率低于 60%，下周训练量应减少 15%。",en:"Completion is below 60%; reduce next week's volume by 15%."},high_soreness:{zh:"平均酸痛高于 7/10，下一次降低强度并增加恢复。",en:"Average soreness is above 7/10; lower intensity and add recovery."},low_energy:{zh:"平均精力低于 5/10，优先检查睡眠、饮食和恢复。",en:"Average energy is below 5/10; prioritize sleep, nutrition, and recovery."},high_difficulty:{zh:"平均难度高于 8.5/10，下一次减少一组或一个动作。",en:"Average difficulty is above 8.5/10; remove one set or one movement next time."},repeated_misses:{zh:"连续两次未完成，建议缩短单次训练或降低每周频率。",en:"Two consecutive misses suggest shorter sessions or a lower weekly frequency."}};
  const suggestion:Record<string,{zh:string;en:string}>={light_recovery:{zh:"下一次：轻量恢复训练，避开高酸痛部位。",en:"Next: a light recovery session away from sore areas."},short_light_session:{zh:"下一次：30 分钟以内的轻量训练。",en:"Next: a light session of 30 minutes or less."},shorter_more_realistic_session:{zh:"下一次：缩短 15 分钟，先恢复可执行的节奏。",en:"Next: shorten by 15 minutes and rebuild a realistic rhythm."},small_progression:{zh:"下一次：主要动作可增加 1 组。",en:"Next: add one set to the main movements."},repeat_baseline:{zh:"下一次：保持当前容量，再完成一次稳定训练。",en:"Next: repeat the current baseline with stable execution."}};
  return <section className="seven-day-review" aria-label={zh?"最近七天训练复盘":"Seven-day training review"}><header><div><small>ONE SET · 7 DAY REVIEW</small><h2>{zh?"最近 7 天复盘":"Last 7 days review"}</h2><p>{zh?"滚动 7 天（含今天）；与下方周一至周日的本周进度不同。已明确标记的测试记录不计入。":"Rolling 7 days including today, separate from the Monday–Sunday week below. Explicit test records are excluded."}</p></div><strong>{review.completedWorkouts}<i>/{review.plannedWorkouts}</i></strong></header><div className="seven-day-stats"><span><small>{zh?"每周目标":"WEEKLY TARGET"}</small><b>{review.plannedWorkouts}</b></span><span><small>{zh?"7 天完成":"DONE IN 7 DAYS"}</small><b>{review.completedWorkouts}</b></span><span><small>{zh?"完成率":"COMPLETION"}</small><b>{review.completionRate}%</b></span><span><small>{zh?"平均精力":"AVG ENERGY"}</small><b>{review.averageEnergy||"—"}<i>/10</i></b></span><span><small>{zh?"平均酸痛":"AVG SORENESS"}</small><b>{review.averageSoreness||"—"}<i>/10</i></b></span><span><small>{zh?"平均难度":"AVG DIFFICULTY"}</small><b>{review.averageDifficulty||"—"}<i>/10</i></b></span></div><div className={`seven-day-decision ${review.riskFlags.length?"risk":"ready"}`}><i>{review.recent.length?(review.riskFlags.length?"!":"↗"):"＋"}</i><div><small>{zh?"明天建议":"NEXT WORKOUT DECISION"}</small><strong>{insufficientData?(zh?"需要更多训练记录":"More training records needed"):(zh?suggestion[review.nextWorkoutSuggestion].zh:suggestion[review.nextWorkoutSuggestion].en)}</strong>{insufficientData&&<p>{zh?"先完成 2 次训练，再判断趋势。":"Complete 2 workouts before judging the trend."}</p>}<p className="risk-heading">{zh?"风险提醒":"Risk alerts"}</p>{review.riskFlags.length?review.riskFlags.map(flag=><p key={flag}>{zh?riskCopy[flag].zh:riskCopy[flag].en}</p>):<p>{zh?"暂未发现需要调整的风险。":"No adjustment risk detected yet."}</p>}</div></div></section>;
}

function WeeklyCoachCard({language,history,weeklyGoal,openPlanBase,openToday,buildFocused}:{language:Language;history:WorkoutLog[];weeklyGoal:number;openPlanBase:()=>void;openToday:()=>void;buildFocused:(focus:Focus)=>void}){
  const zh=language==="zh";
  const weekStart=startOfWeek().getTime();
  const weekly=history.filter(log=>new Date(log.date).getTime()>=weekStart&&log.completed!==false);
  const completed=Math.min(weeklyGoal,weekly.length);
  const remaining=Math.max(0,weeklyGoal-weekly.length);
  const volume=weekly.reduce((sum,log)=>sum+log.totalVolume,0);
  const last=history.find(log=>log.completed!==false);
  const coverageGroups=[
    {id:"upper",bodies:["chest","back","shoulders","arms"] as BodyPart[],zh:"上肢",en:"Upper body"},
    {id:"lower",bodies:["lower"] as BodyPart[],zh:"下肢",en:"Lower body"},
    {id:"core",bodies:["core"] as BodyPart[],zh:"核心",en:"Core"},
  ];
  const focusBodies:Record<Focus,BodyPart[]>={full:["chest","back","shoulders","arms","lower","core"],upper:["chest","back","shoulders","arms"],lower:["lower"],pushpull:["chest","back","shoulders","arms"],core:["core"]};
  const loggedSetCount=weekly.reduce((count,log)=>count+log.performances.length,0);
  const coverage=coverageGroups.map(group=>{
    const setCount=weekly.reduce((count,log)=>count+log.performances.filter(set=>group.bodies.includes(ids[set.exerciseId]?.body as BodyPart)).length,0);
    const inferredSessions=loggedSetCount===0?weekly.filter(log=>focusBodies[log.focus].some(body=>group.bodies.includes(body))).length:0;
    return {...group,setCount,inferredSessions,covered:setCount>0||inferredSessions>0};
  });
  const nextCoverage=coverage.find(group=>!group.covered);
  const todayStart=new Date();todayStart.setHours(0,0,0,0);
  const weekDays=Array.from({length:7},(_,index)=>{const date=new Date(weekStart);date.setDate(date.getDate()+index);const next=new Date(date);next.setDate(next.getDate()+1);const trained=history.some(log=>{if(log.completed===false)return false;const logged=new Date(log.date).getTime();return logged>=date.getTime()&&logged<next.getTime()});return {date,label:zh?["一","二","三","四","五","六","日"][index]:["M","T","W","T","F","S","S"][index],trained,today:date.getTime()===todayStart.getTime()}});
  const hoursSinceLast=last?Math.max(0,(Date.now()-new Date(last.date).getTime())/3600000):Infinity;
  const recommendedFocus=nextCoverage?.id as "upper"|"lower"|"core"|undefined;
  const recommendAnother=Boolean(weekly.length>0&&remaining>0&&recommendedFocus);
  const recoveryNeeded=Boolean(last&&isInLast7AppDays(last.date)&&((last.sorenessLevel??0)>=8||(last.energyLevel??10)<=4||last.rating==="pain"));
  const openPlan=()=>{if(recoveryNeeded){openToday();return;}if(recommendAnother&&recommendedFocus){buildFocused(recommendedFocus);return;}(weekly.length===0?openToday:openPlanBase)()};
  const action=recoveryNeeded
    ? {eyebrow:zh?"先考虑恢复":"RECOVERY FIRST",title:zh?"不必为了完成目标勉强加练":"Do not force extra training to hit a target",detail:zh?"最近的酸痛、精力或疼痛反馈需要优先处理。下一次生成训练会参考这些记录。":"Recent soreness, energy or pain feedback takes priority. Your next workout uses these records.",cta:zh?"查看今日建议":"View today's suggestion"}
    : recommendAnother&&recommendedFocus
    ? {eyebrow:zh?"下一场优先练这里":"NEXT TRAINING FOCUS",title:zh?`补足本周的${nextCoverage?.zh}`:`Build your ${nextCoverage?.en} session`,detail:zh?`这项尚未出现在本周已完成的训练组中。练一下会为你生成一套新的${nextCoverage?.zh}训练。`:`This area is not yet covered by your completed sets this week. ONE SET will build a fresh ${nextCoverage?.en} session.`,cta:zh?`生成${nextCoverage?.zh}训练`:`Build ${nextCoverage?.en} workout`}
    : weekly.length===0
    ? {eyebrow:zh?"本周第一步":"YOUR NEXT STEP",title:zh?"完成第一场训练，建立本周节奏":"Complete your first workout and set the week in motion",detail:zh?`你的目标是每周 ${weeklyGoal} 次。今天从一套能执行的训练开始。`:`Your goal is ${weeklyGoal} workouts this week. Start with an executable session today.`,cta:zh?"开始今日训练":"Start today's workout"}
    : remaining>0
      ? {eyebrow:zh?"保持节奏":"KEEP THE STREAK",title:zh?`本周还差 ${remaining} 次训练`:`${remaining} workout${remaining===1?"":"s"} left this week`,detail:zh?`已经完成 ${weekly.length}/${weeklyGoal} 次；下一场训练会自动进入你的记录。`:`You have completed ${weekly.length}/${weeklyGoal}. Your next session will automatically enter your history.`,cta:zh?"打开我的训练":"Open my workout"}
      : {eyebrow:zh?"本周目标已完成":"WEEKLY GOAL COMPLETE",title:zh?"保持恢复质量，再决定是否加练":"Protect recovery before adding more work",detail:hoursSinceLast<24?(zh?"刚完成训练，优先补水、饮食和睡眠。":"You trained recently. Prioritize hydration, food, and sleep."):(zh?"如果感觉恢复良好，可以选择一套轻量技术训练。":"If recovery feels good, choose a lighter technique-focused session."),cta:zh?"查看训练":"View workout"};
  return <section className="weekly-coach-card">
    <header><div><small>{action.eyebrow}</small><h2>{action.title}</h2><p>{action.detail}</p></div><div className="weekly-coach-count"><strong>{completed}<i>/{weeklyGoal}</i></strong><span>{zh?"本周训练（周一至周日）":"THIS WEEK · MON–SUN"}</span></div></header>
    <div className="weekly-coach-stats"><span><b>{weekly.reduce((sum,log)=>sum+log.sets,0)}</b>{zh?"组已记录":"SETS LOGGED"}</span><span><b>{volume>=1000?`${(volume/1000).toFixed(1)}t`:`${Math.round(volume)}kg`}</b>{zh?"训练容量":"VOLUME"}</span><span><b>{last?new Date(last.date).toLocaleDateString(zh?"zh-CN":"en-US",{month:"short",day:"numeric"}):"--"}</b>{zh?"最近一次":"LAST SESSION"}</span></div>
    <section className="weekly-coverage" aria-label={zh?"本周实际训练覆盖":"This week’s completed training coverage"}><header><div><small>{zh?"本周实际覆盖":"COMPLETED COVERAGE"}</small><strong>{recoveryNeeded?(zh?"先恢复，再决定训练部位":"Recover before choosing the next focus"):nextCoverage?(zh?`下一场可优先补${nextCoverage.zh}`:`Consider ${nextCoverage.en} next`):(zh?"上肢、下肢与核心都已训练":"Upper, lower, and core are all covered")}</strong></div><span>{loggedSetCount>0?(zh?"根据已完成组数":"FROM COMPLETED SETS"):(zh?"根据已完成训练":"FROM COMPLETED WORKOUTS")}</span></header><div>{coverage.map(group=><article className={group.covered?"covered":"next"} key={group.id}><i>{group.covered?"✓":"＋"}</i><span><strong>{zh?group.zh:group.en}</strong><small>{group.covered?(group.setCount>0?(zh?`${group.setCount} 组已记录`:`${group.setCount} sets logged`):(zh?`${group.inferredSessions} 次训练`:`${group.inferredSessions} workout logged`)):(zh?"尚未覆盖":"Not covered yet")}</small></span></article>)}</div></section>
    <div className="weekly-rhythm"><div><small>{zh?"本周节奏":"WEEKLY RHYTHM"}</small><span>{zh?"训练日会自动标记":"Training days are marked automatically"}</span></div><section aria-label={zh?"本周训练节奏":"Weekly training rhythm"}>{weekDays.map(day=><span className={`${day.trained?"trained":""} ${day.today?"today":""}`} key={day.date.toISOString()}><small>{day.label}</small><i suppressHydrationWarning>{day.trained?"✓":day.today?"•":""}</i></span>)}</section></div>
    <button onClick={openPlan}><span>{action.cta}</span><b>→</b></button>
  </section>;
}

function LastSessionGuide({language,history}:{language:Language;history:WorkoutLog[]}){
  const zh=language==="zh";
  const last=recentAdjustmentLogs(history)[0] as WorkoutLog|undefined;
  if(!last)return null;
  const rating=last.rating||"right";
  const recoveryLabel=(last.sorenessLevel??0)>=8||(last.energyLevel??10)<=4;
  const summaryLabel=recoveryLabel?(zh?"优先恢复":"Recovery first"):(zh?ratingCopy[rating].zh:ratingCopy[rating].en);
  const guide:Record<SessionRating,{zh:string;en:string}>={
    easy:{zh:"上次动作稳定而且偏轻松：下次可小幅增加重量，或多完成 1–2 次。",en:"Last session was clean and easy: add a small amount of load or 1–2 reps next time."},
    right:{zh:"上次强度刚好：先再完成一次稳定基准，再考虑加重。",en:"Last session was on target: repeat one more clean baseline before progressing."},
    hard:{zh:"上次偏难：下次先维持重量或略微降低，优先恢复动作控制。",en:"Last session was hard: keep or slightly reduce the load and rebuild control first."},
    pain:{zh:"上次记录了疼痛：下次避开相关动作；疼痛持续或异常时请寻求专业帮助。",en:"Pain was logged last time: avoid the related movement and seek professional help for persistent or unusual pain."},
  };
  const focusLabel=zh?({full:"全身",upper:"上肢",lower:"下肢",pushpull:"胸背",core:"核心"} as Record<Focus,string>)[last.focus]:last.focus.replace("pushpull","Push + pull");
  return <section className={`last-session-guide ${rating}`}><i>{rating==="pain"?"!":"↗"}</i><div><small>{zh?"来自上一次训练":"FROM YOUR LAST SESSION"}</small><strong>{zh?`${focusLabel}训练 · ${summaryLabel}`:`${focusLabel} · ${summaryLabel}`}</strong><p>{rating==="pain"?(zh?guide.pain.zh:guide.pain.en):describeAdjustment(adjustNextWorkout({durationMinutes:30,focus:last.focus},history).adjustmentReason,language)||(zh?guide[rating].zh:guide[rating].en)}</p></div></section>;
}

function TrainingHistoryPreview({language,history,openPlan}:{language:Language;history:WorkoutLog[];openPlan:()=>void}){
  const zh=language==="zh";
  const recent=history.filter(log=>isInLast7AppDays(log.date));
  const formatVolume=(log:WorkoutLog)=>log.totalVolume>0?(log.totalVolume>=1000?`${(log.totalVolume/1000).toFixed(1)}t`:`${Math.round(log.totalVolume)} kg`):`${log.sets} ${zh?"组":"sets"}`;
  const historyLabel="ONE SET TRAINING HISTORY";
  return <section className="training-history-preview"><header><div><small>ONE SET · LAST 7 DAYS</small><h2>{zh?"最近 7 天":"Last 7 days"}</h2><p>{zh?"每条记录都来自你的真实训练，并用于调整下一次。":"Every completed session stays here to inform what you do next. Missed sessions also shape the next adjustment."}</p></div><b>{recent.length}<i>{zh?"条":"LOGS"}</i></b></header>{recent.length?<div className="training-history-list">{recent.map(log=>{const date=new Date(`${appDateKey(log.date)}T12:00:00Z`);const done=log.completed!==false;return <article className={done?"":"missed"} key={log.id}><time><small>{date.toLocaleDateString(zh?"zh-CN":"en-US",{month:"short",timeZone:"America/Vancouver"}).toUpperCase()}</small><strong>{appDateKey(log.date).slice(8,10)}</strong></time><div><small>{done?(zh?"已完成":"COMPLETED"):(zh?"未完成":"MISSED")}</small><strong>{zh?({full:"全身",upper:"上肢",lower:"下肢",pushpull:"胸背",core:"核心"} as Record<Focus,string>)[log.focus]:log.focus.replace("pushpull","Push + pull")}</strong><span>{done?`${log.exercises} ${zh?"个动作":"moves"} · ${log.sets} ${zh?"组":"sets"} · ${log.duration>0?`${log.duration} min`:(zh?"未计时":"Not timed")}`:(zh?"已记录为未完成":"Saved as missed")}</span><p className="training-log-metrics"><b>{zh?"难度":"Difficulty"} {log.perceivedDifficulty??"—"}/10</b><b>{zh?"精力":"Energy"} {log.energyLevel??"—"}/10</b><b>{zh?"酸痛":"Soreness"} {log.sorenessLevel??"—"}/10</b></p>{log.notes&&<p className="training-log-notes">{zh?"备注：":"Notes: "}{log.notes}</p>}</div><aside><strong>{done?formatVolume(log):"—"}</strong><small>{done?(zh?"真实记录":"REAL LOG"):(zh?"调整下次训练":"ADJUST NEXT")}</small></aside></article>})}</div>:<div className="training-history-empty"><i>＋</i><div><strong>{zh?"需要更多训练记录":"More training records needed"}</strong><span>{zh?"完成第一场训练后，难度、精力和酸痛会自动出现在这里。":"Complete your first workout to see difficulty, energy, and soreness here."}</span></div></div>}<button onClick={openPlan}><span>{history.length?(zh?"打开我的训练":"Open my workout"):(zh?"生成第一场训练":"Build my first workout")}</span><b>→</b></button></section>
}

function LegacyProgress({t,language,history,skillLevels,syncState,weeklyGoal,openScan,openPosture}:{t:Copy;language:Language;history:WorkoutLog[];skillLevels:Record<MovementSkill,number>;syncState:SyncState;weeklyGoal:number;openScan:()=>void;openPosture:()=>void}) {
  const cutoff=startOfWeek().getTime();
  const weeklyCount=history.filter(log=>new Date(log.date).getTime()>=cutoff).length;
  const totalSets=history.reduce((sum,log)=>sum+log.sets,0);
  const totalMinutes=history.reduce((sum,log)=>sum+log.duration,0);
  const totalVolume=history.reduce((sum,log)=>sum+log.totalVolume,0);
  const goalPercent=Math.min(100,Math.round(weeklyCount/weeklyGoal*100));
  const recentVolumes=history.slice(0,12).reverse().map(log=>log.totalVolume);
  const maxVolume=Math.max(1,...recentVolumes);
  const chart=Array.from({length:12},(_,i)=>i<12-recentVolumes.length?8:Math.max(10,Math.round(recentVolumes[i-(12-recentVolumes.length)]/maxVolume*100)));
  const recordMap=new Map<string,SetPerformance>();
  history.forEach(log=>log.performances.forEach(set=>{const current=recordMap.get(set.exerciseId);if(set.weightKg>0&&(!current||set.weightKg>current.weightKg||(set.weightKg===current.weightKg&&set.reps>current.reps)))recordMap.set(set.exerciseId,set)}));
  const records=Array.from(recordMap.values()).sort((a,b)=>b.weightKg-a.weightKg).slice(0,3);
  const syncCopy=syncState==="local"?(language==="zh"?"本机模式 · 未连接云端":"DEVICE ONLY · CLOUD NOT CONNECTED"):syncState==="synced"?(language==="zh"?"已同步":"SYNCED"):syncState==="saving"?(language==="zh"?"正在保存":"SAVING"):syncState==="loading"?(language==="zh"?"正在载入":"LOADING"):syncState==="offline"?(language==="zh"?"等待联网同步":"WAITING FOR NETWORK"):(language==="zh"?"同步失败":"SYNC ERROR");
  return <div className="page progress-page"><section className="page-heading"><div><p>{language==="zh"?"你的表现":"YOUR PERFORMANCE"}</p><h1>{t.progress}</h1></div><div className="heading-actions"><span className={`sync-badge ${syncState}`}>● {syncCopy}</span><select><option>{language==="zh"?"最近 30 天":"Last 30 days"}</option></select></div></section>
    <ScanProgressPanel language={language} openScan={openScan} openPosture={openPosture} resumeCorrection={()=>{}}/>
    <div className="progress-grid"><section className="progress-hero panel"><div className="panel-title"><div><span>{t.strength}</span><h3>{language==="zh"?"真实训练容量":"Recorded volume"}</h3></div><b className="positive">{history.length} {t.workouts}</b></div><strong className="big-number">{totalVolume>=1000?(totalVolume/1000).toFixed(1):Math.round(totalVolume)} <i>{totalVolume>=1000?"TONNES":"KG"}</i></strong><div className="bar-chart">{chart.map((h,i)=><div key={i}><i style={{height:`${h}%`}} className={i===11?"active":""}/></div>)}</div><div className="chart-labels"><span>{totalMinutes} MIN</span><span>{history.length} {t.workouts}</span><span>{totalSets} {language==="zh"?"组":"SETS"}</span></div></section>
      <section className="goal-ring panel"><div className="panel-title"><div><span>{t.goal}</span><h3>{language==="zh"?"本周训练频率":"Weekly frequency"}</h3></div></div><div className="ring" style={{background:`conic-gradient(#d6ff2f ${goalPercent}%,#293024 0)`}}><strong>{goalPercent}%</strong><span>{weeklyCount} / {weeklyGoal} {t.workouts}</span></div><p>{weeklyCount>=weeklyGoal?(language==="zh"?"本周目标已完成，优先恢复质量。":"Weekly goal complete. Prioritize recovery quality."):(language==="zh"?`还差 ${weeklyGoal-weeklyCount} 次训练达成本周目标`:`${weeklyGoal-weeklyCount} workout${weeklyGoal-weeklyCount===1?"":"s"} to reach this week's goal`)}</p></section>
      <section className="records panel"><div className="panel-title"><div><span>{language==="zh"?"个人纪录":"PERSONAL RECORDS"}</span><h3>{language==="zh"?"按动作记录的最高工作重量":"Best logged working sets"}</h3></div></div>{records.length?records.map((record,index)=>{const move=ids[record.exerciseId];return <div className="record-row" key={record.exerciseId}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{move?(language==="zh"?move.zh:move.en):record.exerciseId}</strong><small>{record.reps} {language==="zh"?"次":"reps"}</small></div><b>{record.weightKg} KG</b><i>PR</i></div>}):<div className="mini-empty">{language==="zh"?"记录一次负重训练后，这里会显示个人纪录。":"Log a weighted workout to start personal records."}</div>}</section>
      <section className="records skill-matrix panel"><div className="panel-title"><div><span>{language==="zh"?"动作能力":"MOVEMENT SKILLS"}</span><h3>{language==="zh"?"五类基础动作路径":"Five foundation patterns"}</h3></div></div>{skillPaths.map(path=>{const level=skillLevels[path.id];const move=ids[path.levels[level]];return <div className="skill-row" key={path.id}><span>{language==="zh"?path.zh:path.en}</span><div><strong>{language==="zh"?move.zh:move.en}</strong><small>{language==="zh"?`等级 ${level+1} · ${path.criteriaZh[level]}`:`Level ${level+1} · ${path.criteriaEn[level]}`}</small></div><div className="skill-dots">{path.levels.map((_,i)=><i className={i<=level?"active":""} key={i}/>)}</div></div>})}</section>
      <section className="history-card panel"><div className="panel-title"><div><span>{t.history}</span><h3>{language==="zh"?"训练日志":"Workout log"}</h3></div><b>{history.length}</b></div>{history.length===0?<div className="empty-history"><i>＋</i><strong>{language==="zh"?"完成第一场训练后，这里会自动记录":"Your first completed workout will appear here"}</strong><span>{language==="zh"?"重量、次数和训练容量会保存到你的账户。":"Weight, reps and volume will save to your account."}</span></div>:history.slice(0,4).map(log=>{const date=new Date(log.date);return <div className="history-row" key={log.id}><span>{date.toLocaleString(language==="zh"?"zh-CN":"en-US",{month:"short"}).toUpperCase()} <b>{String(date.getDate()).padStart(2,"0")}</b></span><div><strong>{t[log.focus]}</strong><small>{log.exercises} {t.exercises} · {log.sets} {language==="zh"?"组":"sets"} · {Math.round(log.totalVolume)} KG · {log.duration} MIN · {language==="zh"?ratingCopy[log.rating||"right"].zh:ratingCopy[log.rating||"right"].en}{log.pending?(language==="zh"?" · 等待同步":" · Pending sync"):""}</small></div><i className={`history-rating ${log.rating||"right"}`}>{log.pending?"…":ratingCopy[log.rating||"right"].icon}</i></div>})}</section>
    </div>
  </div>;
}

function Profile({t,language,setLanguage,history,syncState,name,goal,weeklyGoal,equipment,edit,connect,openData,openFeedback}:{t:Copy;language:Language;setLanguage:(x:Language)=>void;history:WorkoutLog[];syncState:SyncState;name:string;goal:TrainingGoal;weeklyGoal:number;equipment:Equipment;edit:()=>void;connect:()=>void;openData:()=>void;openFeedback:()=>void}) {
  const minutes=history.reduce((sum,log)=>sum+log.duration,0);
  const streak=workoutStreak(history);
  const profileBadge=name==="Pure Athlete"?(language==="zh"?"档":"ME"):initials(name);
  const[accountState,setAccountState]=useState<"checking"|"local"|"connected">("checking");
  useEffect(()=>{let cancelled=false;fetch("/api/account",{cache:"no-store"}).then(response=>{if(!cancelled)setAccountState(response.ok?"connected":"local")}).catch(()=>{if(!cancelled)setAccountState("local")});return()=>{cancelled=true}},[]);
  const localOnly=accountState==="local";
  return <div className="page profile-page"><section className="profile-hero"><div className="profile-avatar">{profileBadge}<span>{language==="zh"?"档案":"PROFILE"}</span></div><div><p>{localOnly?(language==="zh"?"ONE SET · 本机模式":"ONE SET · LOCAL MODE"):"ONE SET MEMBER · " + new Date().getFullYear()}</p><h1>{name}</h1><span>{language==="zh"?`${goalCopy[goal].zh} · 每周目标 ${weeklyGoal} 天`:`${goalCopy[goal].en} · ${weeklyGoal} days/week`}</span><small className={`profile-sync ${localOnly?"offline":syncState}`}>● {localOnly?(language==="zh"?"当前训练保存在此设备":"Training is currently saved on this device"):syncState==="synced"?(language==="zh"?"训练数据已同步":"Workout data synced"):syncState==="saving"?(language==="zh"?"正在保存训练":"Saving workout"):syncState==="loading"?(language==="zh"?"正在载入训练记录":"Loading workout history"):syncState==="offline"?(language==="zh"?"训练已保存在本机，联网后自动同步":"Saved on this device; syncs when online"):(language==="zh"?"训练同步暂不可用":"Workout sync unavailable")}</small>{localOnly&&<a className="account-sync-cta" href="/signin-with-chatgpt?return_to=%2F" onClick={()=>trackProductEvent("account_sync_started",{source:"profile"})}><span>{language==="zh"?"使用 ChatGPT 登录以同步训练":"Sign in with ChatGPT to sync training"}</span><b>→</b></a>}{accountState==="connected"&&<small className="account-connected">✓ {language==="zh"?"账号已连接 · 可在任意设备继续":"Account connected · continue on another device"}</small>}</div><button onClick={edit}>{language==="zh"?"编辑资料":"Edit profile"}</button></section>
    <div className="profile-stats"><div><strong>{history.length}</strong><span>{t.workouts}</span></div><div><strong>{streak}</strong><span>{t.streak}</span></div><div><strong>{minutes<60?`${minutes}m`:`${Math.round(minutes/60)}h`}</strong><span>{language==="zh"?"总时长":"Total time"}</span></div></div>
    <h2>{t.settings}</h2><section className="settings-list"><Setting icon="◎" title={t.goalLabel} value={language==="zh"?goalCopy[goal].zh:goalCopy[goal].en} onClick={edit}/><Setting icon="⌂" title={t.gymLabel} value={t[equipment]} onClick={edit}/><div className="setting-row"><i>文</i><div><strong>{t.language}</strong><span>{language==="zh"?"应用语言":"App language"}</span></div><div className="inline-lang"><button className={language==="zh"?"active":""} onClick={()=>setLanguage("zh")}>中文</button><button className={language==="en"?"active":""} onClick={()=>setLanguage("en")}>EN</button></div></div><Setting icon="⌁" title={language==="zh"?"ChatGPT 与 Cursor":"ChatGPT & Cursor"} value={language==="zh"?"连接 Form MCP":"Connect Form MCP"} onClick={connect}/><Setting icon="◷" title={t.notifications} value={language==="zh"?`每周 ${weeklyGoal} 次训练目标`:`${weeklyGoal} workouts per week`}/></section>
    <h2>{language==="zh"?"隐私与数据":"Privacy & data"}</h2><section className="settings-list"><Setting icon="◈" title={language==="zh"?"你的数据控制":"Your data controls"} value={language==="zh"?"导出、删除与隐私说明":"Export, delete & privacy"} onClick={openData}/></section>
    <h2>{language==="zh"?"帮助改进 Form":"Help improve Form"}</h2><section className="settings-list"><Setting icon="✦" title={language==="zh"?"发送 Beta 反馈":"Send beta feedback"} value={language==="zh"?"问题、动作内容或功能建议":"Report a problem, content gap, or idea"} onClick={openFeedback}/></section>
  </div>;
}
function Setting({icon,title,value,onClick}:{icon:string;title:string;value:string;onClick?:()=>void}) { return <button className="setting-row" onClick={onClick}><i>{icon}</i><div><strong>{title}</strong><span>{value}</span></div><b>{onClick?"›":"·"}</b></button>; }

function ProfileEditor({language,name,goal,weeklyGoal,equipment,save,close}:{language:Language;name:string;goal:TrainingGoal;weeklyGoal:number;equipment:Equipment;save:(name:string,goal:TrainingGoal,weeklyGoal:number,equipment:Equipment)=>void;close:()=>void}) {
  const[draftName,setDraftName]=useState(name);
  const[draftGoal,setDraftGoal]=useState(goal);
  const[draftWeeklyGoal,setDraftWeeklyGoal]=useState(weeklyGoal);
  const[draftEquipment,setDraftEquipment]=useState(equipment);
  const submit=(event:FormEvent)=>{event.preventDefault();const clean=draftName.trim().slice(0,32);if(clean)save(clean,draftGoal,draftWeeklyGoal,draftEquipment)};
  return <div className="sheet-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="builder-sheet profile-editor"><div className="sheet-handle"/><header><div><p>ONE SET PROFILE</p><h2>{language==="zh"?"训练偏好":"Training preferences"}</h2></div><button onClick={close}>×</button></header><form onSubmit={submit}>
    <label>{language==="zh"?"你的称呼":"Your name"}</label><input className="profile-name-input" value={draftName} maxLength={32} onChange={event=>setDraftName(event.target.value)} placeholder={language==="zh"?"输入姓名或昵称":"Name or nickname"}/>
    <label>{language==="zh"?"主要目标":"Primary goal"}</label><div className="option-grid two">{(["strength","muscle","fatloss","general"] as TrainingGoal[]).map(item=><button type="button" className={draftGoal===item?"active":""} key={item} onClick={()=>setDraftGoal(item)}>{language==="zh"?goalCopy[item].zh:goalCopy[item].en}</button>)}</div>
    <label>{language==="zh"?"每周训练目标":"Weekly workout goal"}<span>{draftWeeklyGoal} {language==="zh"?"天":"days"}</span></label><div className="weekly-goal-grid">{[2,3,4,5,6].map(value=><button type="button" className={draftWeeklyGoal===value?"active":""} key={value} onClick={()=>setDraftWeeklyGoal(value)}>{value}</button>)}</div>
    <label>{language==="zh"?"默认器械":"Default equipment"}</label><div className="option-grid three">{(["gym","dumbbell","bodyweight"] as Equipment[]).map(item=><button type="button" className={draftEquipment===item?"active":""} key={item} onClick={()=>setDraftEquipment(item)}>{language==="zh"?item==="gym"?"健身房":item==="dumbbell"?"哑铃":"徒手":item==="gym"?"Full gym":item==="dumbbell"?"Dumbbells":"Bodyweight"}</button>)}</div>
    <button className="generate-btn" type="submit" disabled={!draftName.trim()}><span>{language==="zh"?"保存个人设置":"Save preferences"}</span><b>✓</b></button>
  </form></section></div>;
}

function DataControlsSheet({language,close}:{language:Language;close:()=>void}){
  const zh=language==="zh";
  const[status,setStatus]=useState<"idle"|"exporting"|"deleting"|"error">("idle");
  const[confirmText,setConfirmText]=useState("");
  const[notice,setNotice]=useState("");
  const exportData=async()=>{
    setStatus("exporting");setNotice("");
    try{
      const local={profile:getUserProfile(),readiness:getReadinessProfile(),fourWeekPlan:getFourWeekPlan(),generatedWorkout:await getGeneratedWorkout(),workoutLogs:await getWorkoutLogs(LOCAL_LOG_USER_ID)};
      let cloud:unknown=null;let cloudIncluded=false;
      try{const response=await fetch("/api/account",{cache:"no-store",signal:AbortSignal.timeout(5000)});if(response.ok){cloud=await response.json();cloudIncluded=true}}catch{/* Device export remains available offline. */}
      const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),local,cloudIncluded,cloud},null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="form-account-data.json";link.click();URL.revokeObjectURL(url);
      setStatus("idle");setNotice(cloudIncluded?(zh?"本机与云端数据文件已开始下载。":"Your device and cloud data file is downloading."):(zh?"本机数据文件已开始下载；未包含云端数据。":"Your device data file is downloading; cloud data is not included."));
    }catch{setStatus("error");setNotice(zh?"无法导出数据，请检查浏览器下载权限后重试。":"Could not export data. Check browser download permissions and retry.")}
  };
  const deleteData=async()=>{
    if(confirmText!=="DELETE")return;
    setStatus("deleting");setNotice("");
    try{
      const response=await fetch("/api/account",{method:"DELETE"});
      if(!response.ok)throw new Error();
      clearUserProfile();clearActiveWorkout(SESSION_STORAGE_KEY);
      setNotice(zh?"云端数据已删除。本机偏好也已清除。":"Your cloud data and local Form preferences were deleted.");setStatus("idle");
    }catch{setStatus("error");setNotice(zh?"无法删除数据。请先使用 ChatGPT 登录后重试。":"We could not delete your data. Sign in with ChatGPT and try again.")}
  };
  return <div className="sheet-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="builder-sheet data-controls-sheet"><div className="sheet-handle"/><header><div><p>ONE SET · DATA CONTROLS</p><h2>{zh?"隐私与数据":"Privacy & data"}</h2></div><button onClick={close}>×</button></header><div className="data-controls-body"><section className="data-promise"><i>✓</i><div><strong>{zh?"原始影像不会上传":"Your original media stays on-device"}</strong><span>{zh?"练一下只同步训练日志、计划和可观察的扫描指标；不会保存你的原始照片或视频。":"ONE SET syncs workout logs, plans, and observable scan metrics. It does not upload or store your original photos or videos."}</span></div></section><section className="data-action"><div><small>{zh?"可携带":"PORTABLE"}</small><h3>{zh?"导出你的数据":"Export your data"}</h3><p>{zh?"下载本机训练记录、资料和计划；连接云端时一并导出云端数据。清除浏览器数据或更换设备前，请先备份。":"Download device logs, profile and plans, plus cloud data when connected. Back up before clearing browser data or changing devices."}</p></div><button onClick={exportData} disabled={status==="exporting"}>{status==="exporting"?(zh?"正在准备…":"Preparing…"):(zh?"下载 JSON":"Download JSON")}</button></section><section className="data-action danger"><div><small>{zh?"不可撤销":"IRREVERSIBLE"}</small><h3>{zh?"删除云端数据":"Delete cloud data"}</h3><p>{zh?"这会删除练一下云端保存的训练、计划、扫描指标、连接令牌和测试记录。原始影像本来就未上传。":"This removes ONE SET cloud records for workouts, plans, scan metrics, connection tokens, and beta interest. Original media was never uploaded."}</p></div><label><span>{zh?"输入 DELETE 以启用删除":"Type DELETE to enable deletion"}</span><input value={confirmText} onChange={event=>setConfirmText(event.target.value.toUpperCase())} placeholder="DELETE" autoComplete="off"/></label><button className="danger-button" onClick={deleteData} disabled={confirmText!=="DELETE"||status==="deleting"}>{status==="deleting"?(zh?"正在删除…":"Deleting…"):(zh?"永久删除数据":"Permanently delete data")}</button></section>{notice&&<p className={`data-notice ${status==="error"?"error":""}`}>{notice}</p>}<p className="data-disclaimer">{zh?"练一下提供训练反馈，不构成医疗建议或诊断。如出现疼痛、不适或受伤，请停止训练并咨询合格专业人士。":"ONE SET provides training feedback, not medical advice or diagnosis. Stop and consult a qualified professional if you have pain, symptoms, or an injury."}</p></div></section></div>;
}

function BetaFeedbackSheet({language,page,close}:{language:Language;page:Tab;close:()=>void}){
  const zh=language==="zh";
  const[category,setCategory]=useState<"bug"|"idea"|"content"|"other">("idea");
  const[message,setMessage]=useState("");
  const[status,setStatus]=useState<"idle"|"sending"|"sent"|"error">("idle");
  const send=async(event:FormEvent)=>{
    event.preventDefault();if(message.trim().length<8)return;
    setStatus("sending");
    try{const response=await fetch("/api/beta-feedback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,message,sessionId:getProductSession(),page})});if(!response.ok)throw new Error();setStatus("sent");trackProductEvent("pro_feature_tapped",{source:"form",feature:"beta_feedback_sent",category})}catch{setStatus("error")}
  };
  const labels={bug:zh?"问题 / Bug":"Problem / bug",idea:zh?"功能想法":"Feature idea",content:zh?"动作与内容":"Exercise / content",other:zh?"其他":"Other"};
  return <div className="sheet-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="builder-sheet beta-feedback-sheet"><div className="sheet-handle"/><header><div><p>ONE SET · BETA FEEDBACK</p><h2>{zh?"帮我们把练一下做得更好":"Help make ONE SET better"}</h2><span>{zh?"不需要留下邮箱，也不要填写医疗或个人敏感信息。":"No email needed. Please do not include medical or sensitive personal information."}</span></div><button onClick={close}>×</button></header>{status==="sent"?<div className="feedback-sent"><i>✓</i><h3>{zh?"已收到，感谢你。":"Feedback received. Thank you."}</h3><p>{zh?"每一条 Beta 反馈都会进入产品迭代队列。":"Each beta report helps shape the next release."}</p><button className="generate-btn" onClick={close}>{zh?"返回练一下":"Back to ONE SET"}</button></div>:<form onSubmit={send}><label>{zh?"反馈类型":"Feedback type"}</label><div className="option-grid two">{(["bug","idea","content","other"] as const).map(item=><button type="button" key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{labels[item]}</button>)}</div><label>{zh?"具体发生了什么？":"What happened or what would help?"}<span>{message.length}/800</span></label><textarea value={message} maxLength={800} minLength={8} onChange={event=>{setMessage(event.target.value);if(status==="error")setStatus("idle")}} placeholder={zh?"例如：深蹲教学里我希望看到更多新手替代动作…":"For example: I want more beginner alternatives in the squat coaching…"}/>{status==="error"&&<p className="data-notice error">{zh?"暂时无法发送，请稍后重试。":"Could not send this yet. Please try again."}</p>}<button className="generate-btn" type="submit" disabled={message.trim().length<8||status==="sending"}><span>{status==="sending"?(zh?"正在发送…":"Sending…"):(zh?"发送反馈":"Send feedback")}</span><b>→</b></button></form>}</section></div>;
}

function IntegrationSheet({language,close}:{language:Language;close:()=>void}){
  const zh=language==="zh";const[status,setStatus]=useState<"loading"|"ready"|"signed-out"|"error">("loading");const[connected,setConnected]=useState(false);const[token,setToken]=useState("");const[hint,setHint]=useState("");const[copied,setCopied]=useState(false);
  useEffect(()=>{fetch("/api/integrations/token",{cache:"no-store"}).then(async response=>{if(response.status===401){setStatus("signed-out");return null}if(!response.ok)throw new Error();return response.json()}).then(data=>{if(data){setConnected(Boolean(data.connection?.connected));setHint(data.connection?.hint||"");setStatus("ready")}}).catch(()=>setStatus("error"))},[]);
  const generate=async()=>{setStatus("loading");setToken("");try{const response=await fetch("/api/integrations/token",{method:"POST"});if(response.status===401){setStatus("signed-out");return}if(!response.ok)throw new Error();const data=await response.json();setToken(data.token);setHint(data.hint);setConnected(true);setStatus("ready")}catch{setStatus("error")}};
  const copy=async()=>{if(!token)return;const config=JSON.stringify({mcpServers:{form:{command:"node",args:["/absolute/path/to/form/mcp/server.mjs"],env:{FORM_API_URL:location.origin,FORM_API_TOKEN:token}}}},null,2);await navigator.clipboard.writeText(config);setCopied(true)};
  const revoke=async()=>{await fetch("/api/integrations/token",{method:"DELETE"});setConnected(false);setToken("");setHint("")};
  return <div className="sheet-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="builder-sheet integration-sheet"><div className="sheet-handle"/><header><div><p>ONE SET MCP · AI BRIDGE</p><h2>{zh?"连接 ChatGPT 或 Cursor":"Connect ChatGPT or Cursor"}</h2></div><button onClick={close}>×</button></header><div className="integration-body"><section className="integration-loop"><span>AI</span><i>→</i><span>ONE SET</span><i>→</i><span>{zh?"训练":"TRAIN"}</span><i>→</i><span>{zh?"记录":"LOG"}</span></section><p>{zh?"连接后，AI 可以读取你的目标和训练历史、保存结构化计划，并记录训练；它不能读取原始视频或照片。":"Once connected, AI can read goals and workout history, save structured plans, and log training. It cannot access source videos or photos."}</p>{status==="loading"?<div className="integration-status">{zh?"正在检查连接…":"Checking connection…"}</div>:status==="signed-out"?<a className="integration-primary" href="/signin-with-chatgpt?return_to=%2F">{zh?"使用 ChatGPT 登录后连接":"Sign in with ChatGPT to connect"}</a>:status==="error"?<button className="integration-primary" onClick={generate}>{zh?"重试连接":"Try again"}</button>:token?<><div className="token-reveal"><small>{zh?"仅显示一次 · 请立即复制":"SHOWN ONCE · COPY NOW"}</small><code>{token}</code></div><button className="integration-primary" onClick={copy}>{copied?(zh?"✓ Cursor 配置已复制":"✓ Cursor config copied"):(zh?"复制 Cursor MCP 配置":"Copy Cursor MCP config")}</button><p className="integration-note">{zh?"将配置中的路径替换为本项目 mcp/server.mjs 的绝对路径。令牌可随时撤销。":"Replace the placeholder with the absolute path to this project’s mcp/server.mjs. You can revoke the token anytime."}</p></>:<><div className={`connection-state ${connected?"connected":""}`}><i>{connected?"✓":"○"}</i><span><strong>{connected?(zh?"个人连接已启用":"Personal connection enabled"):(zh?"尚未连接":"Not connected")}</strong><small>{connected?`••••••${hint}`:(zh?"生成可撤销的个人令牌":"Create a revocable personal token")}</small></span></div><button className="integration-primary" onClick={generate}>{connected?(zh?"重新生成连接令牌":"Rotate connection token"):(zh?"生成个人连接令牌":"Create connection token")}</button>{connected&&<button className="integration-revoke" onClick={revoke}>{zh?"撤销当前连接":"Revoke current connection"}</button>}</>}</div></section></div>;
}

function Builder({t,language,mode,setMode,advanced,setAdvanced,duration,setDuration,focus,setFocus,equipment,setEquipment,level,setLevel,goal,setGoal,request,setRequest,listening,voiceError,listen,buildPlan,building,close}:{t:Copy;language:Language;mode:BuilderMode;setMode:(x:BuilderMode)=>void;advanced:AdvancedProfile;setAdvanced:(x:AdvancedProfile)=>void;duration:number;setDuration:(x:number)=>void;focus:Focus;setFocus:(x:Focus)=>void;equipment:Equipment;setEquipment:(x:Equipment)=>void;level:Level;setLevel:(x:Level)=>void;goal:TrainingGoal;setGoal:(x:TrainingGoal)=>void;request:string;setRequest:(x:string)=>void;listening:boolean;voiceError:"unsupported"|"denied"|"no-speech"|"network"|null;listen:()=>void;buildPlan:(e?:FormEvent)=>void;building:boolean;close:()=>void}) {
  useEffect(()=>{const root=document.querySelector<HTMLElement>(".builder-sheet");if(!root)return;root.querySelectorAll<HTMLInputElement>(".duration-control input[type=range]").forEach(input=>input.setAttribute("aria-label",language==="zh"?"训练时长":"Workout duration"));const bodyInputs=root.querySelectorAll<HTMLInputElement>(".body-data-grid input");bodyInputs[0]?.setAttribute("aria-label",language==="zh"?"身高（厘米）":"Height in centimeters");bodyInputs[1]?.setAttribute("aria-label",language==="zh"?"体重（公斤）":"Weight in kilograms");root.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(area=>area.setAttribute("aria-label",language==="zh"?"其他训练要求":"Additional training notes"));},[language,mode]);
  useEffect(()=>{document.querySelectorAll<HTMLInputElement>(".builder-sheet .novice-confirm input[type=checkbox]").forEach(input=>input.setAttribute("aria-label",language==="zh"?"新手保护模式":"Beginner protection"))},[language,mode]);
  const understood=parseWorkoutRequest(request,{duration,focus,equipment,level,goal}) as {duration:number;focus:Focus;equipment:Equipment;level:Level;goal:TrainingGoal;understood:boolean};
  const voiceErrors={unsupported:{zh:"当前浏览器不支持语音输入，请直接在下方输入训练要求。",en:"Voice input is not supported in this browser. Type your workout request below."},denied:{zh:"麦克风权限未开启。允许麦克风后重试，或直接手动输入。",en:"Microphone access is blocked. Allow it and try again, or type your request."},"no-speech":{zh:"没有听清内容，请靠近麦克风重试，或直接手动输入。",en:"I didn’t catch that. Try again closer to the microphone, or type instead."},network:{zh:"语音服务暂时无法连接，你仍然可以手动输入并生成训练。",en:"Voice service is temporarily unavailable. You can still type and generate your workout."}};
  const experienceCopy={new:{zh:"刚开始训练",en:"New to training"},some:{zh:"有一些经验",en:"Some experience"},regular:{zh:"规律训练",en:"Train regularly"},advanced:{zh:"高级训练者",en:"Advanced trainee"}};
  const recoveryCopy={low:{zh:"较差",en:"Low"},normal:{zh:"正常",en:"Normal"},high:{zh:"很好",en:"High"}};
  const painCopy={knees:{zh:"膝盖",en:"Knees"},shoulders:{zh:"肩部",en:"Shoulders"},back:{zh:"腰背",en:"Back"},hips:{zh:"髋部",en:"Hips"}};
  const chooseExperience=(experience:Experience)=>{setAdvanced({...advanced,experience});setLevel(experience==="new"?"beginner":experience==="advanced"?"advanced":"intermediate")};
  const togglePain=(area:PainArea)=>setAdvanced({...advanced,painAreas:advanced.painAreas.includes(area)?advanced.painAreas.filter(item=>item!==area):[...advanced.painAreas,area]});
  return <div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="builder-sheet"><div className="sheet-handle"/><header><div><p>练一下 · ONE SET · WORKOUT ENGINE</p><h2>{language==="zh"?"设计下一次训练":"Build your next workout"}</h2></div><button onClick={close}>×</button></header>
    <div className="builder-mode-switch"><button className={mode==="quick"?"active":""} onClick={()=>setMode("quick")}><strong>{language==="zh"?"一键生成":"Quick"}</strong><small>{language==="zh"?"只选必要条件":"Essential inputs only"}</small></button><button className={mode==="advanced"?"active":""} onClick={()=>setMode("advanced")}><strong>{language==="zh"?"高级定制":"Advanced"}</strong><small>{language==="zh"?"加入个人资料与恢复":"Profile + recovery"}</small></button></div>
    <form onSubmit={buildPlan}><label>{t.duration}<span>{duration} MIN</span></label><div className="duration-control"><input type="range" min="15" max="75" step="5" value={duration} onChange={e=>setDuration(+e.target.value)}/><div><span>15</span><span>30</span><span>45</span><span>60</span><span>75</span></div></div>
      <label>{t.focus}</label><div className="option-grid focus-options">{(["full","upper","lower","pushpull","core"] as Focus[]).map(x=><button type="button" className={focus===x?"active":""} key={x} onClick={()=>setFocus(x)}><i>{x==="full"?"◇":x==="upper"?"↟":x==="lower"?"↡":x==="pushpull"?"↔":"◎"}</i>{t[x]}</button>)}</div>
      <label>{t.equipment}</label><div className="option-grid three">{(["gym","dumbbell","bodyweight"] as Equipment[]).map(x=><button type="button" className={equipment===x?"active":""} key={x} onClick={()=>setEquipment(x)}>{t[x]}</button>)}</div>
      <label>{t.level}</label><div className="option-grid three">{(["beginner","intermediate","advanced"] as Level[]).map(x=><button type="button" className={level===x?"active":""} key={x} onClick={()=>setLevel(x)}>{t[x]}</button>)}</div>
      <label>{language==="zh"?"训练目标":"Training goal"}</label><div className="option-grid two">{(["strength","muscle","fatloss","general"] as TrainingGoal[]).map(item=><button type="button" className={goal===item?"active":""} key={item} onClick={()=>setGoal(item)}>{language==="zh"?goalCopy[item].zh:goalCopy[item].en}</button>)}</div>
      {mode==="advanced"&&<section className="advanced-builder">
        <div className="advanced-intro"><i>✦</i><div><strong>{language==="zh"?"把计划真正调到你身上":"Tune the plan to you"}</strong><span>{language==="zh"?"这些资料会改变动作筛选、训练量与新手难度。":"These answers change exercise selection, volume, and starting difficulty."}</span></div></div>
        <label>{language==="zh"?"训练经验":"Training experience"}</label><div className="option-grid two">{(["new","some","regular","advanced"] as Experience[]).map(item=><button type="button" className={advanced.experience===item?"active":""} key={item} onClick={()=>chooseExperience(item)}>{language==="zh"?experienceCopy[item].zh:experienceCopy[item].en}</button>)}</div>
        <label>{language==="zh"?"每周可训练次数":"Days available per week"}<span>{advanced.weeklyDays} {language==="zh"?"天":"DAYS"}</span></label><div className="weekly-goal-grid">{[2,3,4,5,6].map(value=><button type="button" className={advanced.weeklyDays===value?"active":""} key={value} onClick={()=>setAdvanced({...advanced,weeklyDays:value})}>{value}</button>)}</div>
        <label>{language==="zh"?"今天恢复状态":"Recovery today"}</label><div className="option-grid three">{(["low","normal","high"] as Recovery[]).map(item=><button type="button" className={advanced.recovery===item?"active":""} key={item} onClick={()=>setAdvanced({...advanced,recovery:item})}>{language==="zh"?recoveryCopy[item].zh:recoveryCopy[item].en}</button>)}</div>
        <label>{language==="zh"?"希望避开的不适区域":"Areas to avoid today"}<span>{language==="zh"?"自我报告":"SELF-REPORTED"}</span></label><div className="pain-area-grid">{(["knees","shoulders","back","hips"] as PainArea[]).map(item=><button type="button" className={advanced.painAreas.includes(item)?"active":""} key={item} onClick={()=>togglePain(item)}><i>{advanced.painAreas.includes(item)?"✓":"+"}</i>{language==="zh"?painCopy[item].zh:painCopy[item].en}</button>)}</div>
        <label>{language==="zh"?"可选身体资料":"Optional body data"}<span>{language==="zh"?"不会推算体脂":"NO BODY-FAT ESTIMATE"}</span></label><div className="body-data-grid"><div><small>{language==="zh"?"身高 CM":"HEIGHT CM"}</small><input inputMode="decimal" value={advanced.heightCm} onChange={event=>setAdvanced({...advanced,heightCm:event.target.value.replace(/[^0-9.]/g,"").slice(0,6)})} placeholder="170"/></div><div><small>{language==="zh"?"体重 KG":"WEIGHT KG"}</small><input inputMode="decimal" value={advanced.weightKg} onChange={event=>setAdvanced({...advanced,weightKg:event.target.value.replace(/[^0-9.]/g,"").slice(0,6)})} placeholder="70"/></div></div>
        <label>{language==="zh"?"其他要求":"Anything else"}</label><textarea value={advanced.notes} maxLength={240} onChange={event=>setAdvanced({...advanced,notes:event.target.value})} placeholder={language==="zh"?"例如：不喜欢跳跃、第一次去健身房、想加强臀部与上背…":"For example: no jumping, first gym visit, focus on glutes and upper back…"}/>
        <p className="advanced-note">{language==="zh"?"身高和体重不会被用于推断体脂或自动指定精确重量；疼痛信息只用于规避动作，不替代专业医疗建议。":"Height and weight are not used to infer body fat or prescribe exact loads. Pain inputs only avoid movements and are not medical advice."}</p>
      </section>}
      <label>{language==="zh"?"告诉练一下更多":"Tell ONE SET more"}<span>{language==="zh"?"语音或手动":"VOICE OR TYPE"}</span></label><div className={`voice-input ${listening?"listening":""}`}><button type="button" onClick={listen} aria-label={listening?(language==="zh"?"停止并生成":"Stop and generate"):(language==="zh"?"开始语音输入":"Start voice input")}>{listening?"■":"●"}</button><input value={request} onChange={e=>setRequest(e.target.value)} placeholder={listening?(language==="zh"?"正在聆听，再点一次即可停止…":"Listening—tap again to stop…"):t.type}/></div>
      {voiceError&&<div className="voice-error" role="alert"><i>!</i><span><strong>{language==="zh"?"语音输入未完成":"VOICE INPUT UNAVAILABLE"}</strong>{voiceErrors[voiceError][language]}</span></div>}
      {understood.understood&&<div className="ai-understood"><div><i>✓</i><span><small>ONE SET UNDERSTOOD</small><strong>{language==="zh"?"我会按这些条件编排":"I’ll build with these details"}</strong></span></div><section><b>◷ {understood.duration} MIN</b><b>◎ {t[understood.focus]}</b><b>◇ {t[understood.equipment]}</b><b>↗ {t[understood.level]}</b><b>⌁ {language==="zh"?goalCopy[understood.goal].zh:goalCopy[understood.goal].en}</b></section></div>}
      <button className="build-button" disabled={building}>{building?<><i/> {language==="zh"?"正在编排动作…":"Designing workout…"}</>:<>{t.generate}<span>→</span></>}</button>
  </form></section></div>;
}

function Onboarding({t,language,noviceMode,setNoviceMode,ability,setAbility,equipment,setEquipment,build,close}:{t:Copy;language:Language;noviceMode:boolean;setNoviceMode:(x:boolean)=>void;ability:string;setAbility:(x:string)=>void;equipment:Equipment;setEquipment:(x:Equipment)=>void;build:()=>void;close:()=>void}) {
  const abilityOptions=language==="zh"?[["not-yet","还做不了 1 个","从斜板俯卧撑开始"],["few","能做 1–5 个","控制动作，慢慢进阶"],["ready","能稳定做 6+ 个","可以尝试标准俯卧撑"]]:[["not-yet","Not yet","Start with an incline"],["few","I can do 1–5","Build clean, controlled reps"],["ready","I can do 6+","Ready for standard push-ups"]];
  return <div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="onboarding-sheet"><div className="sheet-handle"/><header><div><p>ONE SET START</p><h2>{t.abilityCheck}</h2><span>{language==="zh"?"不用测试极限，按现在的真实能力选择即可":"No max test—choose what is true today"}</span></div><button onClick={close}>×</button></header>
    <div className="onboard-step"><span>01</span><div><h3>{language==="zh"?"你现在能完成几个标准俯卧撑？":"How many full push-ups can you do?"}</h3><p>{language==="zh"?"这会决定推类动作从哪个难度开始":"This sets the starting level for pushing movements"}</p></div></div><div className="ability-options">{abilityOptions.map(x=><button className={ability===x[0]?"active":""} key={x[0]} onClick={()=>setAbility(x[0])}><i>{ability===x[0]?"✓":""}</i><span><strong>{x[1]}</strong><small>{x[2]}</small></span></button>)}</div>
    <div className="onboard-step"><span>02</span><div><h3>{language==="zh"?"今天在哪里训练？":"Where are you training?"}</h3><p>{language==="zh"?"只显示你真正能使用的动作":"Only show movements you can actually do"}</p></div></div><div className="location-options">{(["gym","dumbbell","bodyweight"] as Equipment[]).map(x=><button className={equipment===x?"active":""} key={x} onClick={()=>setEquipment(x)}><i>{x==="gym"?"▦":x==="dumbbell"?"—●—":"◇"}</i><span>{t[x]}</span><b>{equipment===x?"✓":""}</b></button>)}</div>
    <div className="onboard-step compact"><span>03</span><div><h3>{language==="zh"?"训练原则已设置":"Your safe-start rules"}</h3></div></div><div className="safe-rules"><span>✓ {language==="zh"?"每个动作只做 2 组":"2 sets per movement"}</span><span>✓ {language==="zh"?"保留 3–4 次余力":"Keep 3–4 reps in reserve"}</span><span>✓ {language==="zh"?"太难时一键降级":"One-tap regression"}</span></div>
    <label className="novice-confirm"><input type="checkbox" checked={noviceMode} onChange={e=>setNoviceMode(e.target.checked)}/><i/><span><strong>{t.beginnerMode}</strong><small>{t.beginnerDesc}</small></span></label>
    <button className="first-plan-button" onClick={()=>{setNoviceMode(true);build()}}>{t.firstPlan}<i>→</i></button>
  </section></div>;
}

function WarmupSheet({language,moves,close,startWorkout}:{language:Language;moves:LibraryExercise[];close:()=>void;startWorkout:()=>void}){
  const[current,setCurrent]=useState(0);
  const[remaining,setRemaining]=useState(60);
  const[running,setRunning]=useState(false);
  const[finished,setFinished]=useState(false);
  const move=moves[Math.min(current,moves.length-1)];
  useEffect(()=>{
    if(!running||finished)return;
    const timer=window.setInterval(()=>setRemaining(value=>{
      if(value>1)return value-1;
      if(current>=moves.length-1){setRunning(false);setFinished(true);return 0;}
      setCurrent(index=>index+1);
      return 60;
    }),1000);
    return()=>window.clearInterval(timer);
  },[running,finished,current,moves.length]);
  if(!move)return null;
  const next=()=>{if(current>=moves.length-1){setRunning(false);setFinished(true);setRemaining(0);}else{setCurrent(index=>index+1);setRemaining(60);}};
  const choose=(index:number)=>{setCurrent(index);setRemaining(60);setFinished(false);};
  const progress=finished?100:Math.round(((current+(60-remaining)/60)/moves.length)*100);
  return <div className="sheet-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="warmup-sheet"><div className="sheet-handle"/><header><div><p>ONE SET PREP · {moves.length}:00</p><h2>{language==="zh"?"为今天准备好身体":"Prime your body for today"}</h2><span>{language==="zh"?"每个动作 60 秒，保持轻松且无疼痛。":"60 seconds each. Keep every movement easy and pain-free."}</span></div><button onClick={close}>×</button></header><div className="warmup-progress"><i style={{width:`${progress}%`}}/></div>{finished?<section className="warmup-complete"><i>✓</i><p><small>ONE SET READY</small><strong>{language==="zh"?"热身完成":"Warm-up complete"}</strong><span>{language==="zh"?"身体已经准备好；正式组依然从保守重量开始。":"You’re ready. Keep the first working set conservative."}</span></p></section>:<><div className="warmup-status"><span>{language==="zh"?`动作 ${current+1} / ${moves.length}`:`MOVE ${current+1} / ${moves.length}`}</span><strong>00:{String(remaining).padStart(2,"0")}</strong></div><div className="warmup-visual"><figure><ExerciseImage ex={move} className="warmup-motion" priority/><figcaption>↻ · {language==="zh"?"循环演示":"LOOPING DEMO"}</figcaption></figure><figure><img src={`/exercises/${move.image}-1.jpg`} alt={`${move.en} action`}/><figcaption>02 · {language==="zh"?"动作":"ACTION"}</figcaption></figure></div><div className="warmup-coach"><span>COACH</span><p><strong>{language==="zh"?move.zh:move.en}</strong>{language==="zh"?move.cuesZh[0]:move.cuesEn[0]}</p></div><div className="warmup-controls"><button className="warmup-play" onClick={()=>setRunning(value=>!value)}><i>{running?"Ⅱ":"▶"}</i><span>{running?(language==="zh"?"暂停":"Pause"):(language==="zh"?"开始 / 继续":"Start / resume")}</span></button><button onClick={next}>{current===moves.length-1?(language==="zh"?"完成热身":"Finish warm-up"):(language==="zh"?"下一个动作":"Next move")} →</button></div></>}<div className="warmup-sequence">{moves.map((exercise,index)=><button className={`${index===current&&!finished?"active":""} ${index<current||finished?"done":""}`} onClick={()=>choose(index)} key={exercise.id}><span>{index<current||finished?"✓":String(index+1).padStart(2,"0")}</span><ExerciseImage ex={exercise}/><div><strong>{language==="zh"?exercise.zh:exercise.en}</strong><small>60 SEC · {language==="zh"?exercise.primaryZh:exercise.primaryEn}</small></div></button>)}</div><button className="warmup-start-workout" onClick={startWorkout}><span>{finished?(language==="zh"?"开始正式训练":"Start workout"):(language==="zh"?"跳过剩余热身并开始":"Skip remaining warm-up")}</span><i>→</i></button></section></div>;
}

function ExerciseSheet({t,language,exercise,skillLevels,chooseSkillLevel,stats,favorite,focused,inPlan,planCount,toggleFavorite,toggleFocus,togglePlan,start,close,swap}:{t:Copy;language:Language;exercise:LibraryExercise;skillLevels:Record<MovementSkill,number>;chooseSkillLevel:(skill:MovementSkill,index:number,id:string)=>void;stats:ExerciseStats|null;favorite:boolean;focused:boolean;inPlan:boolean;planCount:number;toggleFavorite:()=>void;toggleFocus:()=>void;togglePlan:()=>void;start:()=>void;close:()=>void;swap:(id:string)=>void}) {
  const[demoView,setDemoView]=useState<"both"|"start"|"finish">("both");
  const[breakdownOpen,setBreakdownOpen]=useState(false);
  const[detailsOpen,setDetailsOpen]=useState(false);
  const path=skillPaths.find(item=>item.levels.includes(exercise.id));
  const easierId=easierMove[exercise.id];
  const easier=easierId?ids[easierId]:undefined;
  const needsSetupCheck=exercise.gear==="machine"||exercise.gear==="cable";
  const setupCopy=exercise.gear==="machine"
    ?(language==="zh"?["让座椅、把手或靠垫对准主要关节。","先用比预计更轻 1–2 档的重量，完整试一次范围。","能稳定控制回程后，再增加重量或幅度。"]:["Align the seat, handles, or pad with the working joint.","Start 1–2 pins lighter than expected and test the full range once.","Add load or range only after the return stays controlled."])
    :(language==="zh"?["将滑轮调到说明动作所需的高度，并确认插销完全插入。","先用轻重量试拉，站稳后再开始工作组。","回程不被重量拉走，才适合增加负荷。"]:["Set the pulley to the required height and confirm the selector pin is fully in.","Test the pull with light weight and a stable stance before working sets.","Increase load only when the weight cannot pull you out of position."]);
  const mobility=mobilityIds.has(exercise.id);
  const tempoGuide=buildTempoGuide(exercise.tempo,language);
  const movementSteps=language==="zh"?exercise.stepsZh:exercise.stepsEn;
  const movementCues=language==="zh"?exercise.cuesZh:exercise.cuesEn;
  const datasetEntry=getExerciseDatasetEnrichment(exercise.id);
  const datasetSteps=datasetEntry?(language==="zh"?datasetEntry.instructionStepsZh:datasetEntry.instructionStepsEn):[];
  const repStandards=[
    {label:language==="zh"?"准备标准":"SETUP",copy:movementSteps[0]},
    {label:language==="zh"?"控制标准":"CONTROL",copy:movementCues[1]||movementCues[0]},
    {label:language==="zh"?"完成标准":"FINISH",copy:movementSteps[movementSteps.length-1]},
  ];
  const setSummary=(set:SetPerformance|null)=>!set?"—":set.weightKg>0?`${set.weightKg} kg × ${set.reps}`:`${set.reps} ${language==="zh"?"次":"reps"}`;
  const historyAdvice=stats?.lastRating==="pain"?(language==="zh"?"上次记录了疼痛：下一次先使用更简单的替代动作，并保持全程无痛。":"Pain was logged last time: begin with a regression and keep the next session pain-free."):stats?.lastRating==="hard"?(language==="zh"?"上次偏难：建议减轻重量或缩小幅度，先恢复动作控制。":"Last time felt hard: reduce load or range and rebuild clean control."):stats?.lastRating==="easy"?(language==="zh"?"上次偏轻松：动作稳定时可小幅增加重量或次数。":"Last time felt easy: add a small amount of load or reps only if form stays clean."):(language==="zh"?"上次强度合适：先重复当前基准，稳定完成后再进阶。":"Last time felt right: repeat the baseline and progress after another clean session.");
  return <div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="exercise-sheet"><div className="sheet-handle"/><header><div><p>{bodyNames[language][exercise.body]} · {gearNames[language][exercise.gear]}</p><h2>{language==="zh"?exercise.zh:exercise.en}</h2></div><button onClick={close}>×</button></header>
    <ShortVideoLesson exercise={exercise} language={language} hasEasier={Boolean(easier)} onUseEasier={easier?()=>swap(easier.id):undefined} onContinue={inPlan?start:togglePlan} continueLabel={inPlan?(language==="zh"?"开始第一组":"Start first set"):(language==="zh"?"加入今天训练":"Add to today’s workout")}/><div className="coach-cue"><span>COACH</span><p><strong>{language==="zh"?"这一组只记住一件事":"ONE CUE FOR THIS SET"}</strong>{language==="zh"?exercise.cuesZh[0]:exercise.cuesEn[0]}</p><i>✓</i></div><div className="coach-watchout"><i>!</i><p><small>{language==="zh"?"避免这个错误":"WATCH OUT"}</small><strong>{language==="zh"?exercise.mistakeZh:exercise.mistakeEn}</strong></p></div>{needsSetupCheck&&<section className="equipment-setup-card"><header><div><small>{language==="zh"?"第一次用这台器械？":"FIRST TIME ON THIS STATION?"}</small><strong>{language==="zh"?"先完成这 3 个设置检查":"Complete these 3 setup checks"}</strong></div><i>{exercise.gear==="machine"?"▣":"↗"}</i></header><div>{setupCopy.map((step,index)=><p key={step}><b>{String(index+1).padStart(2,"0")}</b><span>{step}</span></p>)}</div></section>}{easier&&<section className="starter-regression-card"><ExerciseImage ex={easier} className="starter-regression-motion"/><div><small>{language==="zh"?"觉得标准动作太难？":"TOO HARD TODAY?"}</small><strong>{language==="zh"?`先从${easier.zh}开始`:`Start with ${easier.en}`}</strong><span>{language==="zh"?"保持动作完整，比勉强完成标准版更重要。":"A clean regression beats forcing the standard version."}</span></div><button onClick={()=>swap(easier.id)}><span>{language==="zh"?"换成更容易的版本":"Use easier version"}</span><b>→</b></button></section>}<button className={`exercise-next-action ${inPlan?"ready":""}`} onClick={inPlan?start:togglePlan}><span><small>{inPlan?(language==="zh"?"已准备好？":"READY TO TRAIN?"):(language==="zh"?"想练这个动作？":"ADD TO TODAY")}</small><strong>{inPlan?(language==="zh"?"开始今天训练":"Start today’s workout"):(language==="zh"?"加入今天训练计划":"Add this move to today’s workout")}</strong></span><b>→</b></button>
    <button className="exercise-breakdown-toggle" onClick={()=>setBreakdownOpen(open=>!open)} aria-expanded={breakdownOpen}><span><small>{language==="zh"?"需要更仔细看？":"NEED A CLOSER LOOK?"}</small><strong>{language==="zh"?"查看准备与发力关键帧":"See setup and action frames"}</strong></span><b>{breakdownOpen?"−":"+"}</b></button>
    {breakdownOpen&&<section className="exercise-frame-breakdown"><div className="demo-toolbar"><div><span>{mobility?"ONE SET PREP":"ONE SET MOTION"}</span><strong>{mobility?(language==="zh"?"可控活动度示范":"CONTROLLED MOBILITY"):(language==="zh"?"分步动作示范":"STEP-BY-STEP DEMO")}</strong></div><div><button className={demoView==="both"?"active":""} onClick={()=>setDemoView("both")}>{language==="zh"?"完整":"Both"}</button><button className={demoView==="start"?"active":""} onClick={()=>setDemoView("start")}>01</button><button className={demoView==="finish"?"active":""} onClick={()=>setDemoView("finish")}>02</button></div></div><div className={`demo-images premium ${demoView}`}><figure><img src={`/exercises/${exercise.image}-0.jpg`} alt="Start"/><figcaption><b>01</b><span>{language==="zh"?"准备姿势":"SETUP"}</span></figcaption></figure><figure><img src={`/exercises/${exercise.image}-1.jpg`} alt="Finish"/><figcaption><b>02</b><span>{mobility?(language==="zh"?"可控终点":"END RANGE"):(language==="zh"?"发力位置":"ACTION")}</span></figcaption></figure><div className="motion-line"><i/><b>→</b><i/></div></div></section>}
    <button className="exercise-more-toggle" onClick={()=>setDetailsOpen(open=>!open)} aria-expanded={detailsOpen}><span><small>{language==="zh"?"需要更多指导？":"MORE COACHING"}</small><strong>{language==="zh"?"展开完整要领、替代动作和训练记录":"See full form guide, easier options & history"}</strong></span><b>{detailsOpen?"−":"+"}</b></button>
    <div className="exercise-extra-details" hidden={!detailsOpen}>
    <div className="exercise-primary-actions"><button className={favorite?"saved":""} onClick={toggleFavorite} aria-pressed={favorite}><i>{favorite?"★":"☆"}</i><span><small>{language==="zh"?"我的动作":"MY MOVES"}</small><strong>{favorite?(language==="zh"?"已收藏":"Favorited"):(language==="zh"?"收藏动作":"Add favorite")}</strong></span></button><button className={focused?"focused":""} onClick={toggleFocus} aria-pressed={focused}><i>{focused?"◎":"＋"}</i><span><small>{language==="zh"?"训练重点":"TRAINING FOCUS"}</small><strong>{focused?(language==="zh"?"已设为重点":"Focus set"):(language==="zh"?"设为训练重点":"Make training focus")}</strong></span></button><button className={inPlan?"in-plan":""} disabled={inPlan&&planCount<=1} onClick={togglePlan}><i>{inPlan?"✓":"＋"}</i><span><small>{language==="zh"?"今日计划":"TODAY’S PLAN"}</small><strong>{inPlan?(planCount<=1?(language==="zh"?"计划至少保留 1 个动作":"Keep at least 1 move"):(language==="zh"?"移出今日计划":"Remove from plan")):(language==="zh"?"加入今日计划":"Add to workout")}</strong></span></button></div>
    {path&&<section className="progression-panel"><div className="progression-head"><div><span>ONE SET LEVELS</span><h3>{language==="zh"?`${path.zh}能力路径`:`${path.en} skill path`}</h3></div><b>{language==="zh"?`当前等级 ${skillLevels[path.id]+1}`:`CURRENT · L${skillLevels[path.id]+1}`}</b></div><div className="level-track">{path.levels.map((id,index)=>{const move=ids[id];const active=skillLevels[path.id]===index;return <button className={`${active?"current":""} ${index<skillLevels[path.id]?"mastered":""}`} onClick={()=>chooseSkillLevel(path.id,index,id)} key={id}><div><img src={`/exercises/${move.image}-0.jpg`} alt={move.en}/><span>0{index+1}</span></div><strong>{language==="zh"?move.zh:move.en}</strong><small>{active?(language==="zh"?"当前训练动作":"CURRENT MOVEMENT"):index<skillLevels[path.id]?(language==="zh"?"已掌握":"MASTERED"):(language==="zh"?"下一阶段":"NEXT LEVEL")}</small></button>})}</div><div className="level-criteria"><i>✓</i><p><strong>{language==="zh"?"升级标准":"READY WHEN"}</strong>{language==="zh"?path.criteriaZh[skillLevels[path.id]]:path.criteriaEn[skillLevels[path.id]]}</p></div><p className="level-note">{language==="zh"?"点击任一等级可立即替换当前计划中的动作。以动作稳定、无疼痛为升级前提。":"Tap any level to replace this movement in the current plan. Progress only with stable, pain-free reps."}</p></section>}
    <div className="exercise-facts"><div><small>{mobility?(language==="zh"?"训练目标":"TRAINING FOCUS"):t.muscles}</small><strong>{language==="zh"?exercise.primaryZh:exercise.primaryEn}</strong></div><div><small>{t.tempo}</small><strong>{exercise.tempo}</strong></div><div><small>{t.rest}</small><strong>{exercise.rest}</strong></div></div>
    {datasetEntry&&<section className="dataset-evidence"><header><div><small>EXERCISES DATASET · ID {datasetEntry.datasetId}</small><h3>{language==="zh"?"补充动作资料":"Additional movement data"}</h3><span>{language==="zh"?"已核对动作名称与器械；教练版要点仍是主要指导。":"Movement and equipment are exact-matched; ONE SET coaching remains the primary guide."}</span></div><a href={exerciseDatasetSource.repository} target="_blank" rel="noreferrer">{language==="zh"?"查看来源":"Source"} ↗</a></header><div className="dataset-facts"><p><small>{language==="zh"?"目标":"TARGET"}</small><strong>{datasetEntry.target}</strong></p><p><small>{language==="zh"?"器械":"EQUIPMENT"}</small><strong>{datasetEntry.equipment}</strong></p><p><small>{language==="zh"?"协同肌群":"SECONDARY"}</small><strong>{datasetEntry.secondaryMuscles.slice(0,3).join(" · ")||datasetEntry.muscleGroup}</strong></p></div>{datasetSteps.length>0&&<details><summary>{language==="zh"?"查看资料库分步说明":"See dataset step-by-step notes"}<b>＋</b></summary><ol>{datasetSteps.slice(0,6).map((step,index)=><li key={`${datasetEntry.datasetId}-${index}`}><b>{String(index+1).padStart(2,"0")}</b><span>{step}</span></li>)}</ol></details>}<footer>{language==="zh"?"仅接入 MIT 动作资料与说明；Gym Visual 图片和 GIF 未导入。":"MIT exercise data and text only; Gym Visual images and GIFs are not imported."}</footer></section>}
    <section className="rep-standard"><header><div><small>ONE SET REP STANDARD</small><h3>{language==="zh"?"什么算一次规范动作":"What counts as a clean rep"}</h3></div><span>{exercise.tempo}</span></header><div className="rep-standard-grid">{repStandards.map((item,index)=><article key={item.label}><b>{String(index+1).padStart(2,"0")}</b><p><small>{item.label}</small><strong>{item.copy}</strong></p></article>)}</div><div className="tempo-guide"><div><small>{language==="zh"?"动作节奏":"REP RHYTHM"}</small><strong>{language==="zh"?"按阶段控制，不要抢速度":"Own every phase"}</strong></div>{tempoGuide.map(phase=><span key={phase.label}><b>{phase.value}</b><small>{phase.label}</small></span>)}</div><p className="starter-load"><i>◎</i><span><small>{language==="zh"?"第一组怎么选":"FIRST-SET RULE"}</small>{starterLoadRule(exercise,language)}</span></p></section>
    <section className={`exercise-history ${stats?.lastRating||"empty"}`}><header><div><small>ONE SET HISTORY</small><h3>{language==="zh"?"你的动作记录":"Your movement history"}</h3></div>{stats&&<span>{ratingCopy[stats.lastRating].icon} {language==="zh"?ratingCopy[stats.lastRating].zh:ratingCopy[stats.lastRating].en}</span>}</header>{stats?<><div className="exercise-history-stats"><div><small>{language==="zh"?"训练次数":"SESSIONS"}</small><strong>{stats.sessions}</strong></div><div><small>{language==="zh"?"最近训练":"LAST LOGGED"}</small><strong>{new Date(stats.lastDate).toLocaleDateString(language==="zh"?"zh-CN":"en-US",{month:"short",day:"numeric"})}</strong><span>{setSummary(stats.latest)}</span></div><div><small>{language==="zh"?"最佳工作组":"BEST SET"}</small><strong>{setSummary(stats.best)}</strong></div></div><p><i>↗</i><span><small>{language==="zh"?"下次建议":"NEXT SESSION"}</small>{historyAdvice}</span></p></>:<div className="history-baseline"><i>＋</i><span><strong>{language==="zh"?"完成第一组后建立个人基准":"Build your baseline with the first logged set"}</strong><small>{language==="zh"?"练一下会在这里显示最近表现、最佳工作组和下一次建议。":"ONE SET will show your latest performance, best set, and next-session guidance here."}</small></span></div>}</section>
    <section className="confidence-panel"><div className="confidence-head"><span>ONE SET SAFETY</span><h3>{language==="zh"?"动作自检":"MOVEMENT CHECK"}</h3><p>{language==="zh"?"不用猜：做一组前确认这三件事。":"Know what to feel, how to adjust, and when to stop."}</p></div><div className="confidence-grid"><article className="feel-check"><i>◎</i><div><small>{language==="zh"?"应该感觉到":"YOU SHOULD FEEL"}</small><strong>{language==="zh"?exercise.primaryZh:exercise.primaryEn}</strong><span>{language==="zh"?`辅助：${exercise.secondaryZh}`:`Assisted by: ${exercise.secondaryEn}`}</span></div></article><article className="adjust-check"><i>↓</i><div><small>{language==="zh"?"如果太难":"IF IT FEELS TOO HARD"}</small>{easier?<><strong>{language==="zh"?easier.zh:easier.en}</strong><button onClick={()=>swap(easier.id)}>{language==="zh"?"换成这个动作":"Use this regression"} →</button></>:<><strong>{language==="zh"?"减轻重量或缩短幅度":"Reduce load or range"}</strong><span>{language==="zh"?"保持动作稳定，预留约 3 次余力。":"Keep about 3 clean reps in reserve."}</span></>}</div></article><article className="stop-check"><i>!</i><div><small>{language==="zh"?"立即停止信号":"STOP SIGNALS"}</small><strong>{language==="zh"?"疼痛不是训练目标":"Pain is not the goal"}</strong><span>{stopSignals[language][exercise.body]}</span></div></article></div></section>
    <div className="instruction-grid"><section><h3>{t.technique}</h3><ol>{(language==="zh"?exercise.stepsZh:exercise.stepsEn).map(x=><li key={x}>{x}</li>)}</ol></section><section><h3>{t.cues}</h3><ul>{(language==="zh"?exercise.cuesZh:exercise.cuesEn).map(x=><li key={x}>✓ {x}</li>)}</ul><div className="mistake"><b>!</b><p><strong>{t.mistake}</strong>{language==="zh"?exercise.mistakeZh:exercise.mistakeEn}</p></div></section></div>
    <h3>{t.alternatives}</h3><div className="alternatives">{exercise.alternatives.map(id=>ids[id]).filter(Boolean).map(ex=><button key={ex.id} onClick={()=>swap(ex.id)}><ExerciseImage ex={ex}/><span><strong>{language==="zh"?ex.zh:ex.en}</strong><small>{language==="zh"?ex.primaryZh:ex.primaryEn}</small></span><i>{inPlan?t.edit:(language==="zh"?"加入计划":"ADD")} →</i></button>)}</div>
    </div>
  </section></div>;
}

function WorkoutFeedback({language,finishing,initial,inline=false,back,choose}:{language:Language;finishing:boolean;initial?:WorkoutFeedbackInput;inline?:boolean;back:()=>void;choose:(feedback:WorkoutFeedbackInput)=>void|Promise<void>}) {
  const[didComplete,setDidComplete]=useState(initial?.completed??true);const[difficulty,setDifficulty]=useState(initial?.difficulty??7);const[energy,setEnergy]=useState(initial?.energy??7);const[soreness,setSoreness]=useState(initial?.soreness??4);const[notes,setNotes]=useState(initial?.notes??"");
  const zh=language==="zh";
  const[saveError,setSaveError]=useState(false);
  const[submitting,setSubmitting]=useState(false);
  const submissionInFlight=useRef(false);
  const busy=finishing||submitting;
  const submit=async()=>{
    if(submissionInFlight.current||finishing)return;
    submissionInFlight.current=true;setSubmitting(true);setSaveError(false);
    try{await choose({completed:didComplete,difficulty,energy,soreness,notes:notes.trim()})}
    catch{setSaveError(true)}
    finally{submissionInFlight.current=false;setSubmitting(false)}
  };
  const slider=(label:string,value:number,setValue:(value:number)=>void)=><label><span>{label}<b>{value}<i>/10</i></b></span><div className="quick-log-stepper"><button type="button" aria-label={`${label}${zh?"减少":" decrease"}`} disabled={value<=1} onClick={()=>setValue(Math.max(1,value-1))}>−</button><input aria-label={label} type="range" min="1" max="10" value={value} onChange={event=>setValue(Number(event.target.value))}/><button type="button" aria-label={`${label}${zh?"增加":" increase"}`} disabled={value>=10} onClick={()=>setValue(Math.min(10,value+1))}>＋</button></div></label>;
  return <div className={`feedback-overlay quick-log-overlay ${inline?"inline-quick-log":""}`} role={inline?"region":"dialog"} aria-modal={inline?undefined:true} aria-labelledby="quick-log-title"><section><div className="feedback-check">✓</div><small>ONE SET · QUICK LOG</small><h2 id="quick-log-title">{zh?"今天感觉怎么样？":"How did today feel?"}</h2><p>{zh?"五项快速记录；系统会据此调整下一次训练。":"Five quick inputs will shape your next workout."}</p><div className="quick-log-fields"><fieldset className="quick-log-completion"><legend>{zh?"是否完成":"Workout status"}</legend><div role="radiogroup" aria-label={zh?"是否完成训练":"Workout completion status"}><button type="button" role="radio" aria-checked={didComplete} className={didComplete?"active":""} onClick={()=>setDidComplete(true)}>✓ {zh?"已完成":"Completed"}</button><button type="button" role="radio" aria-checked={!didComplete} className={!didComplete?"active":""} onClick={()=>setDidComplete(false)}>– {zh?"未完成":"Not completed"}</button></div></fieldset>{slider(zh?"难度":"Difficulty",difficulty,setDifficulty)}{slider(zh?"精力":"Energy",energy,setEnergy)}{slider(zh?"酸痛":"Soreness",soreness,setSoreness)}<label className="quick-log-notes"><span>{zh?"备注（可选）":"Notes (optional)"}</span><textarea value={notes} maxLength={500} onChange={event=>setNotes(event.target.value)} placeholder={zh?"例如：左肩不舒服、今天睡眠不足":"e.g. left shoulder felt uncomfortable"}/></label></div>{saveError&&<p role="alert" className="quick-log-error">{zh?"未能保存记录。填写内容仍在，请检查浏览器是否允许保存数据，然后重试。先不要关闭页面。":"Your log could not be saved. Your entries are still here. Check browser storage permissions and retry before closing this page."}</p>}<button className="quick-log-save" disabled={busy} onClick={()=>void submit()}>{busy?(zh?"正在保存…":"Saving…"):(zh?"保存记录":"Save log")}<b>→</b></button><div className="pain-note"><i>!</i><span>{zh?"如出现胸痛、眩晕或持续疼痛，请停止训练并寻求专业医疗帮助。":"For chest pain, dizziness, or persistent pain, stop training and seek medical care."}</span></div><button className="feedback-back" disabled={busy} onClick={back}>{zh?"返回训练":"Back to workout"}</button></section></div>;
}

function LegacyWorkoutCompletionSheet({language,workout,close,planNext,repeat}:{language:Language;workout:WorkoutLog;close:()=>void;planNext:()=>void;repeat:()=>void}){
  const zh=language==="zh";const[sharing,setSharing]=useState(false);const[message,setMessage]=useState("");
  const share=async()=>{setSharing(true);try{const result=await shareWorkoutSummary({...workout,language});setMessage(result==="shared"?(zh?"已打开分享":"Share sheet opened"):(zh?"成果卡已下载":"Workout card downloaded"));trackProductEvent("workout_share_created",{source:"workout",focus:workout.focus,duration:workout.duration,setCount:workout.sets})}catch{setMessage(zh?"暂时无法生成成果卡，请稍后重试。":"We could not create your workout card. Try again shortly.")}finally{setSharing(false)}};
  const focusLabel={full:zh?"全身":"FULL BODY",upper:zh?"上肢":"UPPER BODY",lower:zh?"下肢":"LOWER BODY",pushpull:zh?"胸与背":"PUSH + PULL",core:zh?"核心":"CORE"}[workout.focus];
  const nextCopy:Record<SessionRating,{zh:string;en:string}>={easy:{zh:"动作稳定时，下次可小幅增加重量或次数。",en:"If form stayed clean, add a small amount of load or reps next time."},right:{zh:"保持这套基准，再完成一次稳定训练。",en:"Repeat this baseline once more with clean control."},hard:{zh:"下次优先保持重量或略微降低，先恢复动作控制。",en:"Keep or slightly reduce load next time and rebuild control first."},pain:{zh:"下次避开疼痛动作；持续或异常疼痛请寻求专业帮助。",en:"Avoid the painful movement next time; seek professional help for persistent or unusual pain."}};
   return <div className="feedback-overlay workout-complete-overlay" role="dialog" aria-modal="true"><section><div className="feedback-check">✓</div><small>ONE SET · WORKOUT COMPLETE</small><h2>{zh?"训练已记录。":"Workout logged."}</h2><p>{zh?"这次训练已经进入你的历史记录与本周进度。":"This session is now part of your history and weekly progress."}</p><div className="workout-complete-summary"><strong>{focusLabel}</strong><span>{workout.duration} MIN · {workout.exercises} {zh?"个动作":"MOVES"} · {workout.sets} {zh?"组":"SETS"}</span><div><b>{workout.totalVolume>=1000?`${(workout.totalVolume/1000).toFixed(1)}t`:`${Math.round(workout.totalVolume)}kg`}</b><small>{zh?"训练容量":"TRAINING VOLUME"}</small></div></div><section className={`completion-next-step ${workout.rating}`}><b>{workout.rating==="pain"?"!":"↗"}</b><span><strong>{zh?"下次训练建议":"NEXT SESSION"}</strong><small>{workout.rating==="pain"?(zh?nextCopy.pain.zh:nextCopy.pain.en):describeAdjustment(adjustNextWorkout({durationMinutes:30,focus:workout.focus},[workout]).adjustmentReason,language)||(zh?nextCopy[workout.rating].zh:nextCopy[workout.rating].en)}</small></span></section><button className="completion-next-session-button" onClick={planNext}>{zh?"选择下一次训练":"Choose my next workout"}<b>→</b></button><button className="workout-share-button" onClick={()=>void share()} disabled={sharing}>{sharing?(zh?"正在生成成果卡…":"Creating your card…"):(zh?"分享训练成果":"Share workout result")}<b>↗</b></button>{message&&<p className="workout-share-message">{message}</p>}<button className="completion-repeat-button" onClick={repeat}>{zh?"再练一次":"Repeat this workout"}<b>↻</b></button><button className="feedback-back" onClick={close}>{zh?"查看我的进度":"View my progress"}</button></section></div>;
}

function WorkoutCompletionSheet({language,workout,highlights,close,planNext,repeat}:{language:Language;workout:WorkoutLog;highlights:PersonalBestHighlight[];close:()=>void;planNext:(date:string)=>void;repeat:()=>void}){
  const zh=language==="zh";
  const[sharing,setSharing]=useState(false);
  const[message,setMessage]=useState("");
  const recommendedOffset=workout.rating==="pain"?3:workout.rating==="hard"?2:1;
  const scheduleOptions=[1,2,3].map(offset=>{const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()+offset);return {date:dateKey(date),label:offset===1?(zh?"明天":"Tomorrow"):offset===2?(zh?"后天":"In 2 days"):(zh?"3 天后":"In 3 days"),detail:fullDate(language,date)};});
  const[nextSessionDate,setNextSessionDate]=useState(()=>scheduleOptions.find(option=>option.date===dateKey(new Date(Date.now()+recommendedOffset*86400000)))?.date||scheduleOptions[0].date);
  const[moreOpen,setMoreOpen]=useState(false);
  const selectedSchedule=scheduleOptions.find(option=>option.date===nextSessionDate)||scheduleOptions[0];
  const share=async()=>{setSharing(true);try{const result=await shareWorkoutSummary({...workout,language});setMessage(result==="shared"?(zh?"已打开分享":"Share sheet opened"):(zh?"成果卡已下载":"Workout card downloaded"));trackProductEvent("workout_share_created",{source:"workout",focus:workout.focus,duration:workout.duration,setCount:workout.sets})}catch{setMessage(zh?"暂时无法生成成果卡，请稍后重试。":"We could not create your workout card. Try again shortly.")}finally{setSharing(false)}};
  const focusLabel={full:zh?"全身":"FULL BODY",upper:zh?"上肢":"UPPER BODY",lower:zh?"下肢":"LOWER BODY",pushpull:zh?"胸与背":"PUSH + PULL",core:zh?"核心":"CORE"}[workout.focus];
  const nextCopy:Record<SessionRating,{zh:string;en:string}>={easy:{zh:"动作稳定时，下次可小幅增加重量或次数。",en:"If form stayed clean, add a small amount of load or reps next time."},right:{zh:"保持这套基准，再完成一次稳定训练。",en:"Repeat this baseline once more with clean control."},hard:{zh:"下次优先保持重量或略微降低，先恢复动作控制。",en:"Keep or slightly reduce load next time and rebuild control first."},pain:{zh:"下次避开疼痛动作；持续或异常疼痛请寻求专业帮助。",en:"Avoid the painful movement next time; seek professional help for persistent or unusual pain."}};
  return <div className="feedback-overlay workout-complete-overlay" role="dialog" aria-modal="true"><section><div className="feedback-check">✓</div><small>ONE SET · WORKOUT COMPLETE</small><h2>{zh?"训练已记录。":"Workout logged."}</h2><p>{zh?"这次训练已经进入你的历史记录与本周进度。":"This session is now part of your history and weekly progress."}</p><div className="workout-complete-summary"><strong>{focusLabel}</strong><span>{workout.duration} MIN · {workout.exercises} {zh?"个动作":"MOVES"} · {workout.sets} {zh?"组":"SETS"}</span><div><b>{workout.totalVolume>=1000?`${(workout.totalVolume/1000).toFixed(1)}t`:`${Math.round(workout.totalVolume)}kg`}</b><small>{zh?"训练容量":"TRAINING VOLUME"}</small></div></div>{highlights.length>0&&<section className="completion-records"><header><span>★</span><div><small>{zh?"真实个人最佳":"PERSONAL BEST"}</small><strong>{zh?"这次训练刷新了记录":"You set a new best today"}</strong></div></header><div>{highlights.map(item=>{const exercise=ids[item.exerciseId];if(!exercise)return null;const name=zh?exercise.zh:exercise.en;const delta=item.kind==="weight"?`+${item.delta} kg`:`+${item.delta} ${zh?"次":"reps"}`;const detail=item.performance.weightKg>0?`${item.performance.weightKg} kg × ${item.performance.reps}`:`${item.performance.reps} ${zh?"次":"reps"}`;return <article key={item.exerciseId}><span><small>{name}</small><strong>{detail}</strong></span><b>{delta}</b></article>})}</div></section>}<section className={`completion-next-step ${workout.rating}`}><b>{workout.rating==="pain"?"!":"↗"}</b><span><strong>{zh?"下次训练建议":"NEXT SESSION"}</strong><small>{workout.rating==="pain"?(zh?nextCopy.pain.zh:nextCopy.pain.en):describeAdjustment(adjustNextWorkout({durationMinutes:30,focus:workout.focus},[workout]).adjustmentReason,language)||(zh?nextCopy[workout.rating].zh:nextCopy[workout.rating].en)}</small></span></section><section className="completion-schedule"><header><small>{zh?"保持训练节奏":"KEEP THE RHYTHM"}</small><strong>{zh?"下一次什么时候练？":"When will you train next?"}</strong><p>{zh?"选一个你能完成的日期；首页会保留这次安排。":"Choose a realistic date. Your home screen will keep the plan visible."}</p></header><div role="radiogroup" aria-label={zh?"选择下次训练时间":"Choose next workout time"}>{scheduleOptions.map(option=><button type="button" role="radio" aria-checked={nextSessionDate===option.date} className={nextSessionDate===option.date?"active":""} onClick={()=>setNextSessionDate(option.date)} key={option.date}><strong>{option.label}</strong><small>{option.detail}</small></button>)}</div></section><button className="completion-next-session-button" onClick={()=>planNext(nextSessionDate)}><span><small>{zh?"下一次训练已选":"NEXT SESSION SELECTED"}</small><strong>{zh?`安排在${selectedSchedule.label}`:`Schedule for ${selectedSchedule.label}`}</strong></span><b>→</b></button><button className="completion-more-toggle" onClick={()=>setMoreOpen(open=>!open)} aria-expanded={moreOpen}><span>{zh?"更多选项":"MORE OPTIONS"}</span><b>{moreOpen?"−":"+"}</b></button><div className="completion-secondary-actions" hidden={!moreOpen}><button className="workout-share-button" onClick={()=>void share()} disabled={sharing}>{sharing?(zh?"正在生成成果卡…":"Creating your card…"):(zh?"分享训练成果":"Share workout result")}<b>↗</b></button>{message&&<p className="workout-share-message">{message}</p>}<button className="completion-repeat-button" onClick={repeat}>{zh?"再练一次":"Repeat this workout"}<b>↻</b></button></div><button className="feedback-back" onClick={close}>{zh?"查看我的进度":"View my progress"}</button></section></div>;
}

function WorkoutMode({t,language,equipment,workout,exerciseIndex,setIndex,setCounts,goal,noviceMode,paused,learning,onLearningChange,togglePause,completed,setInputs,previousSets,latestRatingByExercise,time,restRemaining,addRest,skipRest,onClose,onDetails,onEasier,onInput,onComplete,onFinish}:{t:Copy;language:Language;equipment:Equipment;workout:LibraryExercise[];exerciseIndex:number;setIndex:number;setCounts:number[];goal:TrainingGoal;noviceMode:boolean;paused:boolean;learning:boolean;onLearningChange:(value:boolean)=>void;togglePause:()=>void;completed:Record<string,boolean>;setInputs:Record<string,SetInput>;previousSets:Record<string,SetPerformance>;latestRatingByExercise:Record<string,SessionRating>;time:string;restRemaining:number;addRest:()=>void;skipRest:()=>void;onClose:()=>void;onDetails:(x:LibraryExercise)=>void;onEasier:(x:LibraryExercise)=>void;onInput:(key:string,field:keyof SetInput,value:string)=>void;onComplete:()=>void;onFinish:(feedback:WorkoutFeedbackInput)=>void|Promise<void>}) {
  const zh=language==="zh";
  const [confirmExit,setConfirmExit]=useState(false);
  const [resumeAfterCancel,setResumeAfterCancel]=useState(false);
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const [finishing,setFinishing]=useState(false);
  const [recording,setRecording]=useState(false);
  const [helpOpen,setHelpOpen]=useState(false);
  const [setSeconds,setSetSeconds]=useState(0);
  const rootRef=useRef<HTMLElement>(null);
  const taskRef=useRef<HTMLDivElement>(null);
  const savedRef=useRef(false);
  const ex=workout[exerciseIndex];
  const rx=prescribe(ex,goal,noviceMode);
  const currentKey=`${exerciseIndex}-${setIndex}`;
  const current=setInputs[currentKey]||{weight:"",reps:""};
  const currentSetCount=setCounts[exerciseIndex]||1;
  const totalSets=setCounts.reduce((sum,count)=>sum+count,0);
  const completedSetTotal=Object.values(completed).filter(Boolean).length;
  const last=exerciseIndex===workout.length-1&&setIndex===currentSetCount-1;
  const allDone=Boolean(completed[currentKey])&&last;
  const resting=restRemaining>0;
  const bodyweight=ex.gear==="bodyweight";
  const needsWeight=ex.gear!=="bodyweight"&&!current.weight.trim();
  const canComplete=validSetInput(current,bodyweight);
  const canRegressCurrent=matchesAvailableEquipment(ids[easierMove[ex.id]],equipment)&&setIndex===0&&!completed[`${exerciseIndex}-0`]&&!workout.some((item,index)=>index!==exerciseIndex&&item.id===easierMove[ex.id]);
  const steps=zh?ex.stepsZh:ex.stepsEn;
  const cues=zh?ex.cuesZh:ex.cuesEn;
  const target=setTargetLabel(rx.reps,current.reps,language);
  const timed=/\d\s*(s|sec|秒)\b/i.test(rx.reps)||/秒/.test(rx.reps);
  const perSide=/side|侧/i.test(rx.reps);
  const previous=previousSets[`${ex.id}-${setIndex+1}`];
  const stage=resting?"rest":allDone?"done":recording?"record":learning?"learn":"train";
  useEffect(()=>{rootRef.current?.scrollIntoView({block:"start"})},[ex.id]);
  useEffect(()=>{if(stage!=="learn")taskRef.current?.scrollIntoView({block:"start"})},[stage]);
  useEffect(()=>{savedRef.current=false;setRecording(false);setHelpOpen(false);setSetSeconds(0)},[currentKey,ex.id]);
  useEffect(()=>{
    if(stage!=="train"||paused)return;
    const timer=window.setInterval(()=>setSetSeconds(value=>value+1),1000);
    return()=>window.clearInterval(timer);
  },[stage,paused]);
  const requestExit=()=>{setResumeAfterCancel(!paused);if(!paused)togglePause();setConfirmExit(true)};
  const cancelExit=()=>{setConfirmExit(false);if(resumeAfterCancel)togglePause();setResumeAfterCancel(false)};
  const learnAgain=()=>{onLearningChange(true);setHelpOpen(true)};
  const saveSet=()=>{
    if(!recording||!canComplete||resting||paused||savedRef.current)return;
    savedRef.current=true;
    onComplete();
    setRecording(false);
    if(last)setFeedbackOpen(true);
  };
  const beginSet=()=>{if(!canComplete||resting||paused||allDone)return;setHelpOpen(false);setSetSeconds(0);onLearningChange(false)};
  const doneSet=()=>{onLearningChange(true);setRecording(true)};
  return <main ref={rootRef} className="workout-mode guided-workout" data-stage={stage}>
    <header className="guided-header" inert={paused||confirmExit||feedbackOpen}>
      <button onClick={requestExit}>{zh?"退出":"Exit"}</button>
      <div><span>{paused?(zh?"已暂停":"Paused"):learning&&!resting?(zh?"学习与记录不计时":"Learning & logging excluded"):(zh?"训练与休息用时":"Training & rest")}</span><strong>{time}</strong></div>
      <button onClick={togglePause}>{paused?(zh?"继续":"Resume"):(zh?"暂停":"Pause")}</button>
    </header>
    <div className="guided-progress" inert={paused||confirmExit||feedbackOpen} role="progressbar" aria-label={zh?"训练完成进度":"Workout progress"} aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={completedSetTotal}>
      <span>{zh?`已完成 ${completedSetTotal} / ${totalSets} 组`:`${completedSetTotal} / ${totalSets} sets done`}</span>
      <progress max={totalSets} value={completedSetTotal}/>
    </div>
    <section className="guided-layout" inert={paused||confirmExit||feedbackOpen}>
      <div className="guided-demo">
        <p className="guided-eyebrow">{zh?`动作 ${exerciseIndex+1} / ${workout.length}`:`Exercise ${exerciseIndex+1} / ${workout.length}`}</p>
        <h1>{zh?ex.zh:ex.en}</h1>
        {hasExternalTutorial(ex.id)?<ExternalTutorial key={ex.id} id={ex.id} zh={zh}/>:<ExerciseImage key={ex.id} ex={ex} className="focus-motion guided-motion" priority/>}
        <p className="guided-media-caption">{hasExternalTutorial(ex.id)?(zh?"原站真人教学 · 需要联网":"Publisher tutorial · Internet required"):getExerciseTutorial(ex.id)?(zh?"真人教学 · 可暂停、全屏查看":"Coach tutorial · Pause or view full screen"):(zh?"动作预览 · 结合下方步骤学习":"Movement preview · Follow the steps below")}</p>
        <div className="guided-help">
          <button aria-expanded={helpOpen} onClick={()=>{onLearningChange(true);setHelpOpen(value=>!value)}}>{zh?"我不会做 · 看分步教学":"Show me how · Step-by-step"}</button>
          <button aria-expanded={helpOpen} onClick={learnAgain}>{zh?"太难了 / 不舒服":"Too hard / uncomfortable"}</button>
        </div>
        {helpOpen&&<section className="guided-help-panel" aria-label={zh?"动作帮助":"Movement help"}>
          <h2>{zh?"先停一下，不需要硬撑":"Pause here. No need to push through."}</h2>
          <p>{zh?"不会做时，先看下面的准备和动作步骤。只是吃力，可以减少本组次数或重量；有疼痛时停止这个动作。":"Review the steps below. If it is simply too demanding, reduce reps or load. Stop this movement if it hurts."}</p>
          {canRegressCurrent?<button onClick={()=>{onEasier(ex);onLearningChange(true)}}>{zh?`换成更简单的「${ids[easierMove[ex.id]]?.zh||"替代动作"}」`:"Use the easier movement"}</button>:<p>{zh?"当前没有可直接替换的更简单版本，或已经记录过这个动作。可以减少本组目标；无法继续时退出，不要把未做的组记为完成。":"No safe one-tap regression is available, or sets are already recorded. Reduce this set's target, or exit instead of logging unperformed sets."}</p>}
          <label>{zh?(timed?"调整本组秒数":"调整本组次数"):(timed?"Adjust seconds":"Adjust reps")}<input aria-label={zh?"调整本组目标":"Adjust set target"} inputMode="numeric" value={current.reps} disabled={allDone||resting} onChange={event=>onInput(currentKey,"reps",event.target.value)}/></label>
        </section>}
      </div>
      <div ref={taskRef} className="guided-task">
        {resting?<section className="guided-rest" role="status">
          <p>{zh?"这一组已记录，先休息":"Set recorded. Rest now."}</p>
          <h2>{formatCountdown(restRemaining)}</h2>
          <p>{zh?`接下来：${ex.zh}，第 ${setIndex+1} 组`:`Next: ${ex.en}, set ${setIndex+1}`}</p>
          <p>{zh?"倒计时结束后，准备好再开始，不会自动替你完成下一组。":"When the timer ends, start when ready. The next set will not start automatically."}</p>
          <div><button onClick={addRest}>{zh?"再休息 15 秒":"+15 seconds"}</button><button onClick={skipRest}>{zh?"休息好了":"I'm rested"}</button></div>
        </section>:allDone?<section className="guided-finished">
          <h2>{zh?"所有组已记录":"All sets recorded"}</h2><p>{zh?"最后记录今天的感受，保存到训练进度。":"Add how you felt to save this workout to your progress."}</p>
          <button className="guided-primary" onClick={()=>setFeedbackOpen(true)}>{zh?"完成训练 · 记录感受":"Finish workout · Add feedback"}</button>
        </section>:<>
          <section className="current-set-overview guided-set-target" aria-label={zh?"当前训练组":"Current set"}>
            <div><small>{stage==="learn"?(zh?"先学动作，再开始":"Learn first, then start"):stage==="record"?(zh?"做完再记录":"Record what you did"):(zh?"现在跟着做":"Do this set now")}</small>
            <strong>{zh?`第 ${setIndex+1} 组，共 ${currentSetCount} 组`:`Set ${setIndex+1} of ${currentSetCount}`}</strong>
            <span>{target}</span></div>
          </section>
          {stage==="learn"&&<>
            <p className="guided-explanation">{timed?(zh?"一组，就是保持上面的秒数，再休息。不需要憋气，不舒服时可以提前停止。":"A set is holding for the time shown, then resting. Keep breathing and stop early if uncomfortable."):(zh?"一组，就是连续做完上面的次数，再休息。今天先按这个具体目标做，不必追求次数上限。":"A set is one batch of repetitions followed by rest. Use this clear target; you do not need to reach the top of the range.")}</p>
            <ol className="guided-steps">{steps.map((step,index)=><li key={index}><strong>{zh?`第 ${index+1} 步`:`Step ${index+1}`}</strong><p>{step}</p></li>)}</ol>
            <p className="guided-breath">{breathingCue(ex,language)}</p>
            {bodyweight?<p className="guided-load">{zh?"不用拿重量，使用自身体重。":"No added weight. Use your bodyweight."}</p>:<label className="guided-load">{zh?"准备使用的重量（kg）":"Load to use (kg)"}<input aria-label={zh?"准备重量":"Starting load"} inputMode="decimal" value={current.weight} onChange={event=>onInput(currentKey,"weight",event.target.value)}/><span>{previous?(zh?`上次：${previous.weightKg} kg，仅供参考。`:`Last: ${previous.weightKg} kg, for reference only.`):(zh?"没有历史记录。先试最轻的可用重量；不能平稳完成时，换简单动作或请现场教练协助。":"No previous load. Try the lightest available load. If you cannot control it, use an easier movement or ask an in-person coach.")}</span></label>}
            {!canComplete&&<p className="weight-required-note" role="status">{needsWeight?(zh?"先填写准备使用的重量，再开始。":"Enter the load you will use before starting."):(zh?"请检查目标和重量：目标需要是大于零的整数，重量不能为负数。":"Check your target and load: the target must be a positive whole number and load cannot be negative.")}</p>}
            <button className="guided-primary" disabled={!canComplete||paused} onClick={beginSet}>{zh?`我准备好了，开始第 ${setIndex+1} 组`:`I'm ready · Start set ${setIndex+1}`}</button>
            <p className="guided-hint">{zh?"此时才开始计时。动作变形或不舒服时，可以提前停下。":"Timing starts only then. Stop early if you lose control or feel discomfort."}</p>
          </>}
          {stage==="train"&&<>
            <div className="guided-one-cue"><h2>{zh?"这一组记住":"Remember this"}</h2><p>{cues[0]||steps[0]}</p></div>
            <p className="guided-set-time">{zh?"本组用时":"This set"} <strong>{formatCountdown(setSeconds)}</strong>{timed&&<span>{zh?"达到目标后，自己点击做完了。":"Tap done when you reach the target."}</span>}</p>
            <button className="guided-primary" onClick={doneSet}>{zh?"做完了，记录这一组":"Done · Record this set"}</button>
            <p className="guided-hint">{zh?"这是手动记录，不会自动检测你做了多少次。":"Manual logging: the app does not detect your repetitions."}</p>
          </>}
          {stage==="record"&&<form className="guided-record" onSubmit={event=>{event.preventDefault();saveSet()}}>
            <h2>{zh?"刚才实际做了多少？":"What did you actually complete?"}</h2>
            <label>{zh?`${perSide?"每侧":""}${timed?"实际秒数":"实际次数"}`:`${timed?"Actual seconds":"Actual reps"}${perSide?" per side":""}`}<input aria-label={zh?"实际完成数量":"Actual amount"} inputMode="numeric" value={current.reps} onChange={event=>onInput(currentKey,"reps",event.target.value)}/></label>
            {!bodyweight&&<label>{zh?"实际重量（kg）":"Actual load (kg)"}<input aria-label={zh?"实际重量":"Actual load"} inputMode="decimal" value={current.weight} onChange={event=>onInput(currentKey,"weight",event.target.value)}/></label>}
            <p className="set-autofill-note">{zh?"这里预填的是目标，不代表已经检测到你完成。少做了就改成实际数量。":"The target is prefilled, not detected. Change it to what you actually did."}</p>
            <button className="guided-primary complete-set" type="submit" disabled={!canComplete||paused}>{zh?(last?"保存本组，完成训练":"保存本组，开始休息"):(last?"Save set · Finish workout":"Save set · Rest")}</button>
            <button className="guided-secondary" type="button" onClick={()=>{setRecording(false);onLearningChange(true)}}>{zh?"还没做完，返回动作":"Not finished · Return to movement"}</button>
          </form>}
        </>}
        <p className="guided-safety">{zh?"出现尖锐疼痛、眩晕等不适时停止训练，必要时寻求专业帮助。":"Stop for sharp pain, dizziness or other concerning symptoms; seek professional help as needed."}</p>
      </div>
    </section>
    {paused&&!confirmExit&&!feedbackOpen&&<div className="session-overlay"><section role="dialog" aria-modal="true" aria-label={zh?"训练已暂停":"Workout paused"}><h2>{zh?"训练已暂停":"Workout paused"}</h2><p>{zh?"训练和休息计时都已停止。":"Training and rest timers are stopped."}</p><button className="resume-session" autoFocus onClick={togglePause}>{zh?"继续训练":"Resume workout"}</button><button className="exit-session" onClick={requestExit}>{zh?"退出训练":"Exit workout"}</button></section></div>}
    {confirmExit&&<div className="session-overlay exit-confirm"><section role="dialog" aria-modal="true" aria-label={zh?"退出训练？":"Exit workout?"}><h2>{zh?"退出训练？":"Exit workout?"}</h2><p>{zh?"退出不会标记今天已完成。本次尚未提交的训练记录会被放弃。":"Exiting will not mark today complete. Unsubmitted workout records will be discarded."}</p><button className="resume-session" autoFocus onClick={cancelExit}>{zh?"返回训练":"Keep training"}</button><button className="exit-session danger" onClick={onClose}>{zh?"退出，不标记完成":"Exit without completing"}</button></section></div>}
    {feedbackOpen&&<WorkoutFeedback language={language} finishing={finishing} back={()=>setFeedbackOpen(false)} choose={async feedback=>{setFinishing(true);try{await onFinish(feedback)}finally{setFinishing(false)}}}/>}
  </main>;
}

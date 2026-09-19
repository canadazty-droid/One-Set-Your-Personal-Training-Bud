import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { buildTempoGuide, starterLoadRule } from "../app/exercise-coaching.mjs";
import { parseWorkoutRequest } from "../app/request-parser.mjs";
import { exerciseTargetForDuration, personalizePlan } from "../app/plan-personalizer.mjs";
import { formatCountdown, isPendingWorkout, isSessionDraft, PENDING_WORKOUTS_KEY, SESSION_STORAGE_KEY } from "../app/session-utils.mjs";

const root = new URL("../",import.meta.url);

test("ships the One Set product shell and metadata",async()=>{
  const [page,layout,packageJson]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/layout.tsx",root),"utf8"),
    readFile(new URL("package.json",root),"utf8"),
  ]);
  assert.match(layout,/title:\s*"练一下 · ONE SET/);
  assert.match(layout,/metadataBase/);
  assert.match(layout,/\/og\.png/);
  assert.match(page,/练一下 · ONE SET · WORKOUT ENGINE/);
  assert.match(page,/FormScanner/);
  assert.match(page,/PhotoScanner/);
  assert.match(page,/readScanRecords/);
  assert.match(page,/loadSyncedScans/);
  assert.match(page,/Last: \$\{previous.weightKg\} kg, for reference only/);
  assert.match(page,/ONE SET SAFETY/);
  assert.match(page,/stopSignals\[language\]\[exercise\.body\]/);
  assert.match(page,/const smartSwap/);
  assert.match(page,/candidate\.level==="beginner"/);
  assert.match(page,/card-swap-btn/);
  assert.match(page,/const getWarmupMoves/);
  assert.match(page,/Half-Kneeling_Ankle_Rock/);
  assert.match(page,/Half-Kneeling_Hip-Flexor_Mobilization/);
  assert.match(page,/mobilityIds/);
  assert.match(page,/gearFilter/);
  assert.match(page,/libraryType/);
  assert.match(page,/className="library-filters"/);
  assert.match(page,/className="library-empty"/);
  assert.match(page,/Reset all filters/);
  assert.match(page,/favoriteIds/);
  assert.match(page,/const toggleFavorite/);
  assert.match(page,/const togglePlan/);
  assert.match(page,/className="exercise-primary-actions"/);
  assert.match(page,/Keep at least 1 move/);
  assert.match(page,/selectedStats/);
  assert.match(page,/ONE SET HISTORY/);
  assert.match(page,/className="history-baseline"/);
  assert.match(page,/Pain was logged last time/);
  assert.match(page,/personalizePlan\(candidatePlan/);
  assert.match(page,/const randomPool=shuffle/);
  assert.match(page,/exerciseTargetForDuration\(parsed\.duration\)/);
  assert.match(page,/personalization\.targetCount/);
  assert.match(page,/ONE SET · PERSONALIZED/);
  assert.match(page,/function WarmupSheet/);
  assert.match(page,/setInterval\(\(\)=>setRemaining/);
  assert.match(page,/ONE SET PREP/);
  assert.match(page,/Beginner protection/);
  assert.match(page,/const workoutStreak/);
  assert.match(page,/const weekDates/);
  assert.match(page,/function ProfileEditor/);
  assert.match(page,/profileName,trainingGoal,weeklyGoal/);
  assert.match(page,/const prescribe/);
  assert.match(page,/setRestRemaining\(prescribe/);
  assert.match(page,/goalCopy\[understood\.goal\]/);
  assert.match(page,/speechWindow\.SpeechRecognition\|\|speechWindow\.webkitSpeechRecognition/);
  assert.match(page,/setVoiceError\("unsupported"\)/);
  assert.match(page,/className="voice-error" role="alert"/);
  assert.doesNotMatch(page,/setRequest\(example\)/);
  assert.match(page,/workoutPaused/);
  assert.match(page,/Exit without completing/);
  assert.match(page,/addRest/);
  assert.match(page,/className="guided-one-cue"/);
  assert.match(page,/ONE SET REP STANDARD/);
  assert.match(page,/className="guided-breath"/);
  assert.match(page,/starterLoadRule\(exercise,language\)/);
  assert.match(page,/const breathingCue/);
  assert.match(page,/className="guided-steps"/);
  assert.match(page,/function ResumeSessionPrompt/);
  assert.match(page,/SESSION_STORAGE_KEY/);
  assert.match(page,/function WorkoutFeedback/);
  assert.match(page,/latestRatingByExercise/);
  assert.match(page,/No safe one-tap regression is available/);
  assert.match(page,/flushPendingWorkouts/);
  assert.match(page,/queuePendingWorkout/);
  assert.match(page,/window\.addEventListener\("online"/);
  assert.match(page,/fullDate\(language\)/);
  assert.doesNotMatch(page,/Aurora|31 JUL|JUL 31|7 月 31 日|PURE MEMBER · 2024/);
  assert.match(page,/\/api\/workouts/);
  assert.doesNotMatch(page,/SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson,/react-loading-skeleton/);
});

test("uses one 练一下 brand across the product and share card",async()=>{
  const [page,layout,form,posture,offer,share,manifest]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/layout.tsx",root),"utf8"),
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
    readFile(new URL("app/membership-offer.tsx",root),"utf8"),
    readFile(new URL("app/share-card.mjs",root),"utf8"),
    readFile(new URL("public/manifest.webmanifest",root),"utf8"),
  ]);
  for(const source of [page,form,posture,offer,share])assert.doesNotMatch(source,/FORM AI/);
  for(const source of [page,layout,form,posture,offer,share])assert.doesNotMatch(source,/PureFitness|PUREFITNESS|PURE/);
  assert.match(form,/练一下 · ONE SET · MOVEMENT SCAN/);
  assert.match(posture,/练一下 · ONE SET · POSTURE TREND BETA/);
  assert.match(offer,/练一下 · ONE SET PRO/);
  assert.match(page,/练一下/);
  assert.match(page,/练一下<span>· ONE SET<\/span>/);
  assert.match(layout,/applicationName: "练一下 · ONE SET"/);
  assert.equal(JSON.parse(manifest).short_name,"练一下");
  assert.match(share,/#667663/);
  assert.match(share,/#c1847a/);
  assert.match(share,/one-set-\$\{type\}-score/);
  assert.match(share,/练一下 · ONE SET/);
});

test("formats long rest periods as a real clock",()=>{
  assert.equal(formatCountdown(45),"00:45");
  assert.equal(formatCountdown(90),"01:30");
  assert.equal(formatCountdown(125),"02:05");
  assert.equal(formatCountdown(-4),"00:00");
});

test("turns coach tempo notation into beginner-friendly rep phases",()=>{
  assert.deepEqual(buildTempoGuide("3–1–2","en"),[
    {label:"CONTROL",value:"3s"},
    {label:"PAUSE",value:"1s"},
    {label:"EFFORT",value:"2s"},
  ]);
  assert.deepEqual(buildTempoGuide("HOLD","zh").map(phase=>phase.label),["建立张力","自然呼吸","可控结束"]);
  assert.deepEqual(buildTempoGuide("WALK","en").map(phase=>phase.label),["POSTURE","STEADY STEPS","CONTROLLED TURN"]);
  assert.match(starterLoadRule({gear:"bodyweight",level:"beginner"},"en"),/range you can fully control/);
  assert.match(starterLoadRule({gear:"dumbbell",level:"beginner"},"zh"),/3–4 次余力/);
});

test("validates crash-safe active workout drafts",()=>{
  assert.equal(SESSION_STORAGE_KEY,"purefitness-active-workout-v1");
  const draft={version:1,savedAt:Date.now(),planIds:["Wall_Push-Up"],duration:30,focus:"full",equipment:"bodyweight",level:"beginner",goal:"general",noviceMode:true,exerciseIndex:0,setIndex:1,seconds:125,restRemaining:45,setInputs:{"0-0":{weight:"0",reps:"8"}},completed:{"0-0":true}};
  assert.equal(isSessionDraft(draft,["Wall_Push-Up"]),true);
  assert.equal(isSessionDraft({...draft,planIds:["Missing_Move"]},["Wall_Push-Up"]),false);
  assert.equal(isSessionDraft({...draft,savedAt:Date.now()-8*24*60*60*1000},["Wall_Push-Up"]),false);
});

test("validates offline workout records before retrying sync",()=>{
  assert.equal(PENDING_WORKOUTS_KEY,"purefitness-pending-workouts-v1");
  const pending={id:"123e4567-e89b-42d3-a456-426614174000",date:new Date().toISOString(),focus:"full",duration:30,exercises:1,sets:1,totalVolume:80,rating:"right",performances:[{exerciseId:"Wall_Push-Up",setNumber:1,weightKg:10,reps:8}]};
  assert.equal(isPendingWorkout(pending,["Wall_Push-Up"]),true);
  assert.equal(isPendingWorkout({...pending,id:"pending-123"},["Wall_Push-Up"]),false);
  assert.equal(isPendingWorkout({...pending,performances:[{...pending.performances[0],exerciseId:"Missing_Move"}]},["Wall_Push-Up"]),false);
  assert.equal(isPendingWorkout({...pending,rating:"unknown"},["Wall_Push-Up"]),false);
});

test("keeps every exercise paired with an approved tutorial or an honest movement preview",async()=>{
  const source=await readFile(new URL("app/exercise-data.ts",root),"utf8");
  const tutorialSource=await readFile(new URL("app/exercise-tutorials.ts",root),"utf8");
  const ids=[...source.matchAll(/id:"([^"]+)"/g)].map(match=>match[1]);
  const images=[...source.matchAll(/image:"([^"]+)"/g)].map(match=>match[1]);
  const alternatives=[...source.matchAll(/alternatives:\[([^\]]*)\]/g)].flatMap(match=>[...match[1].matchAll(/"([^"]+)"/g)].map(value=>value[1]));
  const tutorialIds=new Set([...tutorialSource.matchAll(/^\s{2}([A-Za-z0-9_-]+):\s*(?:wger|yourMove|commons)\(/gm)].map(match=>match[1]));
  assert.equal(ids.length,107);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of ["Cable_Rear_Delt_Fly","Cable_Preacher_Curl","Cable_One_Arm_Tricep_Extension","Incline_Dumbbell_Curl","Dumbbell_Shrug","Bent-Arm_Dumbbell_Pullover","Barbell_Bench_Press_-_Medium_Grip","Bent_Over_Barbell_Row","Barbell_Deadlift","Barbell_Full_Squat","Cable_Crossover","Pullups","Dips_-_Triceps_Version","EZ-Bar_Curl","Kettlebell_Swing","Kettlebell_Push_Press","Kettlebell_Romanian_Deadlift","Dumbbell_Goblet_Squat","Pec_Deck_Fly","Incline_Machine_Press","Cable_Tricep_Pushdown","Machine_Bicep_Curl","High_Cable_Curl","Hack_Squat","Glute_Kickback_Machine","Standing_Calf_Raise_Machine","Hanging_Knee_Raise","Hanging_Leg_Raise","Kettlebell_Suitcase_Carry"])assert.ok(ids.includes(id),`missing ${id}`);
  assert.equal(images.length,ids.length);
  for(const alternative of alternatives)assert.ok(ids.includes(alternative),`missing alternative ${alternative}`);
  const previewImages=images.filter((_,index)=>!tutorialIds.has(ids[index]));
  await Promise.all(previewImages.flatMap(name=>[0,1].map(index=>access(new URL(`public/exercises/${name}-${index}.jpg`,root)))));
  await Promise.all(previewImages.map(name=>access(new URL(`public/exercises/videos/${name}.mp4`,root))));
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/exercises\/videos\/\$\{ex\.image\}\.mp4/);
  assert.match(page,/data-motion-format=\{videoUnavailable\?"still":tutorial\?"coach-video":"preview-video"\}/);
  assert.match(page,/getExerciseTutorial\(ex\.id\)/);
  assert.match(page,/const isTeachingPreview=className\.includes\("exercise-preview"\)\|\|className\.includes\("cover-motion"\)/);
  assert.match(page,/const autoPlayVideo=priority\|\|showControls\|\|isTeachingPreview/);
  assert.match(page,/autoPlay=\{autoPlayVideo\}/);
  assert.match(page,/preload=\{autoPlayVideo\?"metadata":"none"\}/);
  assert.match(page,/const showControls=className\.includes\("sheet-motion"\)/);
  assert.match(page,/controls=\{showControls\}/);
  const styles=await readFile(new URL("app/globals.css",root),"utf8");
  assert.match(styles,/\.exercise-dual-image\.video-fallback \.exercise-frame:first-of-type\{display:block!important/);
  assert.doesNotMatch(page,/exercises\/gifs\/\$\{ex\.image\}\.gif/);
  assert.doesNotMatch(styles,/exercise-gif|data-motion-format="gif"|GIF · AUTO PLAY/);
  assert.doesNotMatch(page,/type="video\/webm"/);
  assert.match(page,/className="cover-motion"/);
  assert.match(page,/className="exercise-preview"/);
  assert.match(page,/COACH · VIDEO/);
  assert.match(page,/MOTION · PREVIEW/);
  assert.match(page,/function ShortVideoLesson/);
  assert.match(page,/short-video-lesson/);
  assert.match(page,/Replay from start/);
  assert.match(page,/not claimed as real coach footage/);
  assert.match(page,/onEnded=\{\(\)=>\{setPlaying\(false\);setLessonStage\(2\)\}\}/);
  assert.doesNotMatch(page,/<video ref=\{videoRef\} muted loop autoPlay/);
  assert.match(styles,/\.short-video-lesson\{/);
  assert.match(styles,/\.short-video-player video/);
});

test("understands bilingual one-step workout requests",()=>{
  const defaults={duration:45,focus:"full",equipment:"gym",level:"beginner",goal:"general"};
  assert.deepEqual(parseWorkoutRequest("三十分钟下肢徒手新手减脂训练",defaults),{duration:30,focus:"lower",equipment:"bodyweight",level:"beginner",goal:"fatloss",understood:true});
  assert.deepEqual(parseWorkoutRequest("Forty-five minute upper body dumbbell intermediate muscle building workout",defaults),{duration:45,focus:"upper",equipment:"dumbbell",level:"intermediate",goal:"muscle",understood:true});
  assert.deepEqual(parseWorkoutRequest("120 min full body gym advanced strength",defaults),{duration:75,focus:"full",equipment:"gym",level:"advanced",goal:"strength",understood:true});
  assert.deepEqual(parseWorkoutRequest("",defaults),{...defaults,understood:false});
});

test("personalizes plans without breaking pain, gear, or level safeguards",()=>{
  const exercises=[
    {id:"Press",body:"chest",gear:"dumbbell",level:"beginner",alternatives:["Wall_Press"]},
    {id:"Wall_Press",body:"chest",gear:"bodyweight",level:"beginner",alternatives:[]},
    {id:"Favorite_Press",body:"chest",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Squat",body:"lower",gear:"bodyweight",level:"beginner",alternatives:[]},
    {id:"Advanced_Squat",body:"lower",gear:"bodyweight",level:"intermediate",alternatives:[]},
    {id:"Row",body:"back",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Curl",body:"arms",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Core",body:"core",gear:"bodyweight",level:"beginner",alternatives:[]},
    {id:"Lunge",body:"lower",gear:"bodyweight",level:"beginner",alternatives:[]},
  ];
  const safe=personalizePlan(["Press","Squat"],exercises,{ratings:{Press:"pain"},easierById:{Press:"Wall_Press"},equipment:"dumbbell",novice:true});
  assert.deepEqual(safe.ids,["Wall_Press","Squat"]);
  assert.deepEqual(safe.painSwaps,[{from:"Press",to:"Wall_Press"}]);
  const favorite=personalizePlan(["Press","Squat"],exercises,{favoriteIds:["Favorite_Press"],equipment:"dumbbell",novice:true});
  assert.deepEqual(favorite.ids,["Favorite_Press","Squat"]);
  assert.deepEqual(favorite.favoritesUsed,["Favorite_Press"]);
  const constrained=personalizePlan(["Press","Advanced_Squat"],exercises,{favoriteIds:["Favorite_Press"],equipment:"bodyweight",novice:true});
  assert.deepEqual(constrained.ids,["Wall_Press","Squat"]);
  assert.ok(constrained.ids.every(id=>exercises.find(exercise=>exercise.id===id)?.gear==="bodyweight"));
  assert.ok(!constrained.ids.includes("Advanced_Squat"));
});

test("scales exercise count to the available workout time",()=>{
  assert.equal(exerciseTargetForDuration(15),3);
  assert.equal(exerciseTargetForDuration(20),3);
  assert.equal(exerciseTargetForDuration(30),4);
  assert.equal(exerciseTargetForDuration(45),5);
  assert.equal(exerciseTargetForDuration(60),6);
  assert.equal(exerciseTargetForDuration(75),7);

  const exercises=[
    {id:"Press",body:"chest",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Row",body:"back",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Squat",body:"lower",gear:"bodyweight",level:"beginner",alternatives:[]},
    {id:"Curl",body:"arms",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Core",body:"core",gear:"bodyweight",level:"beginner",alternatives:[]},
    {id:"Lunge",body:"lower",gear:"bodyweight",level:"beginner",alternatives:[]},
    {id:"Shoulder",body:"shoulders",gear:"dumbbell",level:"beginner",alternatives:[]},
    {id:"Advanced_Row",body:"back",gear:"dumbbell",level:"intermediate",alternatives:[]},
  ];
  const short=personalizePlan(["Press","Row","Squat","Curl","Core"],exercises,{equipment:"dumbbell",novice:true,focus:"full",targetCount:3});
  assert.deepEqual(short.ids,["Press","Row","Squat"]);

  const long=personalizePlan(["Press","Squat"],exercises,{equipment:"dumbbell",novice:true,focus:"full",targetCount:7});
  assert.equal(long.ids.length,7);
  assert.equal(new Set(long.ids).size,7);
  assert.ok(!long.ids.includes("Advanced_Row"));
  assert.ok(["chest","back","lower","arms","core","shoulders"].every(body=>long.ids.some(id=>exercises.find(exercise=>exercise.id===id)?.body===body)));
});

test("defines durable, user-owned workout persistence",async()=>{
  const [hosting,schema,route,workoutLogic,auth,migration,feedbackMigration]=await Promise.all([
    readFile(new URL(".openai/hosting.json",root),"utf8").catch(error=>{
      if(error.code!=="ENOENT") throw error;
      return readFile(new URL("hosting.example.json",root),"utf8");
    }),
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("app/api/workouts/route.ts",root),"utf8"),
    readFile(new URL("lib/form/workouts.ts",root),"utf8"),
    readFile(new URL("lib/form/auth.ts",root),"utf8"),
    readFile(new URL("drizzle/0000_faulty_luke_cage.sql",root),"utf8"),
    readFile(new URL("drizzle/0001_volatile_forge.sql",root),"utf8"),
  ]);
  assert.match(hosting,/"d1":\s*"DB"/);
  assert.match(schema,/workouts_user_completed_idx/);
  assert.match(schema,/workoutSets/);
  assert.match(schema,/sessionRating/);
  assert.match(route,/getFormUser/);
  assert.match(auth,/getChatGPTUser/);
  assert.match(workoutLogic,/eq\(schema\.workouts\.userEmail/);
  assert.match(workoutLogic,/totalVolume/);
  assert.match(workoutLogic,/sessionRatings/);
  assert.match(workoutLogic,/requestedId/);
  assert.match(workoutLogic,/status: "in_progress"/);
  assert.match(workoutLogic,/status: "completed"/);
  assert.match(migration,/CREATE TABLE `workouts`/);
  assert.match(migration,/CREATE TABLE `workout_sets`/);
  assert.match(feedbackMigration,/ADD `session_rating`/);
});

test("persists owned scan history and founding-plan interest",async()=>{
  const [schema,scanRoute,interestRoute,migration,offer]=await Promise.all([
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("app/api/scans/route.ts",root),"utf8"),
    readFile(new URL("app/api/membership-interest/route.ts",root),"utf8"),
    readFile(new URL("drizzle/0002_lean_wolfpack.sql",root),"utf8"),
    readFile(new URL("app/membership-offer.tsx",root),"utf8"),
  ]);
  assert.match(schema,/scanRecords/);
  assert.match(schema,/scan_records_user_created_idx/);
  assert.match(schema,/membershipInterests/);
  assert.match(scanRoute,/eq\(scanRecords\.userId,user\.id\)/);
  assert.match(scanRoute,/metricsJson/);
  assert.match(interestRoute,/selectedPlan/);
  assert.match(migration,/CREATE TABLE `scan_records`/);
  assert.match(migration,/CREATE TABLE `membership_interests`/);
  assert.match(offer,/FOUNDING BETA/);
  assert.match(offer,/No charge today/);
  assert.match(offer,/Confirm separately before billing/);
});

test("ships native share-card actions for both scan types",async()=>{
  const [formScanner,photoScanner,shareCard]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
    readFile(new URL("app/share-card.mjs",root),"utf8"),
  ]);
  assert.match(formScanner,/shareOrDownloadCard/);
  assert.match(photoScanner,/shareOrDownloadCard/);
  assert.match(shareCard,/1080/);
  assert.match(shareCard,/1350/);
  assert.match(shareCard,/navigator\.canShare/);
});

test("closes the scan to corrective workout loop",async()=>{
  const [page,corrective]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/corrective-plan.mjs",root),"utf8"),
  ]);
  assert.match(page,/buildCorrectiveExerciseIds/);
  assert.match(page,/correctionSource/);
  assert.match(page,/SCAN/);
  assert.match(page,/RESCAN/);
  assert.match(corrective,/Side-Lying_Clamshell/);
  assert.match(corrective,/ratings\[id\]!=="pain"/);
});

test("records the commercial funnel without uploading source media",async()=>{
  const [schema,route,migration,events,offer,formScanner,photoScanner,page]=await Promise.all([
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("app/api/product-events/route.ts",root),"utf8"),
    readFile(new URL("drizzle/0003_wise_doctor_doom.sql",root),"utf8"),
    readFile(new URL("app/product-events.mjs",root),"utf8"),
    readFile(new URL("app/membership-offer.tsx",root),"utf8"),
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
    readFile(new URL("app/page.tsx",root),"utf8"),
  ]);
  assert.match(schema,/productEvents/);assert.match(schema,/product_events_name_occurred_idx/);
  assert.match(migration,/CREATE TABLE `product_events`/);assert.match(migration,/product_events_user_occurred_idx/);
  assert.match(route,/allowedEvents/);assert.match(route,/cleanMetadata/);assert.match(route,/getChatGPTUser/);
  assert.doesNotMatch(route,/video|photo_url|image_url|blob/i);
  assert.match(events,/keepalive:true/);assert.match(offer,/coach_anchor/);assert.match(offer,/paywall_viewed/);
  assert.match(formScanner,/scan_completed/);assert.match(photoScanner,/scan_completed/);
  assert.match(page,/corrective_plan_built/);assert.match(page,/workout_completed/);
});

test("keeps the primary UI focused on AI plan, workout execution, and progress",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const primaryNavigation:[^\n]+today[^\n]+plan[^\n]+progress/);
  assert.match(page,/FormTodayHome/);
  assert.match(page,/tab==="today"&&<>\{nextWorkoutDate&&<NextWorkoutBooking/);
  assert.match(page,/todaySession\?<FormTodayHome/);
  assert.match(page,/:<OneTapHome language=\{language\}/);
  assert.match(page,/:<OneTapHome language=\{language\} history=\{history\}/);
  assert.match(page,/手动输入需求/);
  assert.match(page,/Type request/);
  assert.match(page,/Plan with AI\. Train with ONE SET\./);
  assert.match(page,/用 AI 规划，在练一下训练。/);
  assert.match(page,/Save to Form/);
  assert.match(page,/todaySession/);
  assert.match(page,/action:"log_set"/);
  assert.match(page,/<details className="plan-help-details"><summary>/);
  assert.match(page,/Training settings & plan details/);
  assert.match(page,/<PlanWhy t=\{t\} language=\{language\}/);
  assert.doesNotMatch(page,/set-row\.current"\)\?\.scrollIntoView/);
  assert.match(page,/setCompletedWorkout\(null\);setCompletionHighlights\(\[\]\);setTab\("progress"\)/);
  assert.match(page,/className="set-autofill-note"/);
  assert.match(page,/The target is prefilled, not detected/);
  assert.match(page,/const needsWeight=ex\.gear!=="bodyweight"&&!current\.weight\.trim\(\)/);
  assert.match(page,/const canComplete=validSetInput\(current,bodyweight\)/);
  assert.match(page,/className="weight-required-note" role="status"/);
  assert.match(styles,/\.weight-required-note\{margin:10px 0 0;color:#ffb0ba/);
  assert.doesNotMatch(page,/className="global-generate"/);
  const declaration=page.match(/const primaryNavigation:[^\n]+/)?.[0]||"";
  assert.match(declaration,/library/);
  assert.match(declaration,/profile/);
});

test("uses stable SVG icons for mobile navigation and workout shortcuts",async()=>{
  const [page,icons,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/ui-icons.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  const declaration=page.match(/const primaryNavigation:[^\n]+/)?.[0]||"";
  assert.match(declaration,/icon:"today"/);
  assert.match(declaration,/icon:"workout"/);
  assert.match(declaration,/icon:"library"/);
  assert.match(declaration,/icon:"progress"/);
  assert.match(declaration,/icon:"profile"/);
  assert.doesNotMatch(declaration,/[●▤⌘↗◎]/);
  assert.match(page,/className="nav-icon"><AppIcon name=\{item\.icon\}/);
  assert.match(page,/aria-current=\{tab===item\.id\?"page":undefined\}/);
  assert.match(page,/AppIcon name=\{listening\?"listening":"voice"\}/);
  assert.match(page,/AppIcon name=\{labels\[item\]\.icon\}/);
  assert.match(icons,/from "lucide-react"/);
  assert.match(icons,/aria-hidden="true" focusable="false"/);
  assert.match(styles,/\.nav-icon\{width:24px;height:24px/);
  assert.match(styles,/\.bottom-nav button\{min-height:48px/);
  assert.match(styles,/@media\(max-width:340px\)/);
});

test("keeps specific body areas inside the one-tap workout path",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const detailChoices:Record<Focus/);
  assert.match(styles,/\.one-tap-focus button:nth-child\(4\),\.one-tap-focus button:nth-child\(5\)\{grid-column:span 3\}/);
  assert.match(styles,/\.one-tap-area>section button:nth-child\(4\):nth-last-child\(2\),\.one-tap-area>section button:nth-child\(5\):last-child\{grid-column:span 3\}/);
  assert.match(page,/const selectedDetail=detailChoices\[selected\]/);
  assert.match(page,/className="one-tap-area"/);
  assert.match(page,/build\(selected,body==="all"\?undefined:body\)/);
  const oneTapStart=page.lastIndexOf("function OneTapHome(");
  const oneTap=page.slice(oneTapStart,page.indexOf("function BodyFocusRail",oneTapStart));
  assert.match(oneTap,/id:"glutes"/);
  assert.match(oneTap,/id:"quads"/);
  assert.match(oneTap,/id:"hamstrings"/);
  assert.match(oneTap,/id:"lats"/);
  assert.match(oneTap,/id:"upperBack"/);
  assert.match(oneTap,/id:"biceps"/);
  assert.match(oneTap,/id:"triceps"/);
  assert.match(oneTap,/id:"abs"/);
  assert.match(oneTap,/id:"stability"/);
  assert.match(oneTap,/const runBuild=\(\)=>build\(selectedFocus,area==="all"\?undefined:area\)/);
  assert.match(oneTap,/const recommendedFocus:Focus=/);
  assert.match(oneTap,/const recommendationReason=/);
  assert.match(oneTap,/className="one-tap-recommendation"/);
  assert.match(oneTap,/Build recommended workout/);
  assert.match(oneTap,/voiceTranscript:string/);
  assert.match(oneTap,/className="home-voice-compact"/);
  assert.match(oneTap,/aria-pressed=\{listening\}/);
  assert.match(oneTap,/className="home-quick-request" onSubmit=/);
  assert.match(oneTap,/if\(request\.trim\(\)&&!building\)submitRequest\(\)/);
  assert.match(oneTap,/label htmlFor="today-request"/);
  assert.match(oneTap,/id="today-request" value=\{request\}/);
  assert.match(oneTap,/30-minute chest and back workout/);
  assert.doesNotMatch(oneTap,/specificAreasOpen/);
  assert.match(oneTap,/className="one-tap-area"><section role="group"/);
  assert.match(oneTap,/重点练哪个部位/);
  assert.match(oneTap,/className="home-selection-summary" role="status"/);
  assert.match(oneTap,/disabled=\{building\} key=\{choice.id\}/);
  assert.match(styles,/\.one-tap-recommendation\{/);
  assert.match(styles,/\.one-tap-specific-toggle\{/);
  assert.match(styles,/\.one-tap-voice-guide\{/);
  assert.match(styles,/\.one-tap-voice-guide\.listening/);
  assert.match(page,/const selectedLowerTarget=isLowerTarget\(options\?\.body\)\?options\.body:null/);
  assert.match(page,/lowerTargetMatchers\[selectedLowerTarget\]\(exercise\)/);
  assert.match(page,/const specificTargetMatchers:Record<Exclude<SpecificTarget,LowerTarget>/);
  assert.match(page,/specificTargetMatchers\[selectedSpecificTarget as Exclude<SpecificTarget,LowerTarget>\]\(exercise\)/);
  assert.match(styles,/\.one-tap-area>section button:first-child:nth-last-child\(7\)\{grid-column:span 6\}/);
  assert.match(page,/targetArea:options\?\.body/);
  assert.match(page,/targetArea=\{planPersonalization\?\.targetArea\}/);
  assert.match(page,/const visibleTarget=targetArea\?buildAreaNames\[language\]\[targetArea\]:t\[focus\]/);
  assert.ok(page.includes('<h2>{visibleTarget}</h2>'));
  assert.doesNotMatch(page,/<BodyFocusRail language=\{language\}/);
  assert.match(styles,/\.one-tap-area\{/);
  assert.match(styles,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("prioritizes a fresh exercise mix when one-tap generation has training history",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/const recentlyTrainedIds=new Set\(history\.slice\(0,2\)\.flatMap\(log=>\(log\.performances\|\|\[\]\)\.map\(set=>set\.exerciseId\)\)\)/);
  assert.match(page,/const freshRandomPool=randomPool\.filter\(id=>!recentlyTrainedIds\.has\(id\)\)/);
  assert.match(page,/freshRandomPool\.length>=targetCount\?freshRandomPool:randomPool/);
});

test("shows how advanced athlete inputs affect the one-tap plan without blocking it",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const advancedProfileActive=builderMode==="advanced"\|\|hasAdvancedPersonalization\(advancedProfile\)/);
  assert.match(page,/advancedReady=\{advancedProfileActive\}/);
  assert.match(page,/openAdvanced=\{\(\)=>\{setBuilderMode\("advanced"\);setSheet\("builder"\)\}\}/);
  assert.match(page,/className=\{`one-tap-personalization \$\{advancedReady\?"ready":""\}`\}/);
  assert.match(page,/Experience, recovery and pain areas inform your plan/);
  assert.match(page,/advancedProfile\.weeklyDays<=2&&parsed\.focus==="full"/);
  assert.match(page,/advancedProfile\.weeklyDays>=5/);
  assert.match(page,/weeklyDays:advancedProfileActive\?advancedProfile\.weeklyDays:undefined/);
  assert.match(styles,/\.one-tap-personalization\{/);
  assert.match(styles,/\.one-tap-personalization\.ready/);
});

test("keeps a beginner-safe one-tap path visible before generation",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  const oneTapStart=page.lastIndexOf("function OneTapHome(");
  const oneTap=page.slice(oneTapStart,page.indexOf("function BodyFocusRail",oneTapStart));
  assert.match(page,/noviceMode=\{noviceMode\}/);
  assert.match(page,/setNoviceMode=\{value=>\{setNoviceMode\(value\);setLevel\(value\?"beginner":"intermediate"\)\}\}/);
  assert.match(oneTap,/className=\{`one-tap-starter \$\{noviceMode\?"active":""\}`\}/);
  assert.match(oneTap,/New to training\? Easier moves & more recovery/);
  assert.match(oneTap,/aria-pressed=\{noviceMode\}/);
  assert.match(styles,/\.one-tap-starter\{/);
  assert.match(styles,/\.one-tap-starter\.active/);
});

test("keeps the generated workout start action reachable on a mobile plan",async()=>{
  const [page,css]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/className="plan-start prominent plan-start-top"/);
  assert.match(css,/\.fitbod-plan \.plan-start\.prominent\.plan-start-top\{position:static/);
  const plan=page.slice(page.indexOf("function Plan("));
  assert.ok(plan.indexOf('className="plan-start prominent plan-start-top"')<plan.indexOf('className="exercise-list novice-list"'));
  assert.match(css,/\.fitbod-plan \.plan-start\.prominent>button>span\{font-size:16px!important\}/);
  assert.match(css,/\.fitbod-plan \.plan-start\.prominent>button\{min-height:64px\}/);
});

test("lets an athlete choose a compatible replacement instead of silently swapping a movement",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const \[swapTarget,setSwapTarget\] = useState<LibraryExercise\|null>\(null\)/);
  assert.match(page,/const \[swapOptions,setSwapOptions\] = useState<LibraryExercise\[\]>\(\[\]\)/);
  assert.match(page,/const available=unique\.filter\(candidate=>!planIds\.includes\(candidate\.id\)\)/);
  assert.match(page,/setSwapOptions\(\(available\.length\?available:unique\)\.slice\(0,3\)\)/);
  assert.match(page,/const chooseSmartSwap=\(replacement:LibraryExercise\)=>/);
  assert.match(page,/PlanSwapSheet language=\{language\} original=\{swapTarget\} options=\{swapOptions\}/);
  assert.match(page,/function PlanSwapSheet/);
  assert.match(page,/SHORT VIDEO/);
  assert.match(styles,/\.plan-swap-overlay\{/);
  assert.match(styles,/\.plan-swap-options>button\{min-height:112px/);
  assert.match(styles,/\.swap-option-motion\{/);
});

test("keeps optional teaching reachable without putting it ahead of the start action",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const firstMove=workout\[0\]/);
  assert.match(page,/className="session-preflight"/);
  assert.match(page,/Watch short demo/);
  assert.match(page,/Start 5-min warm-up/);
  assert.ok(page.indexOf('className="plan-start prominent plan-start-top"')<page.indexOf('className="session-preflight"'));
  assert.match(page,/<details className="plan-help-details"><summary>/);
  assert.ok(page.indexOf('className="session-preflight"')<page.indexOf('className="exercise-list novice-list"'));
  assert.ok(page.indexOf('className="plan-start prominent plan-start-top"')<page.indexOf('className="exercise-list novice-list"'));
  assert.match(styles,/\.session-preflight\{/);
  assert.match(styles,/\.session-preflight-actions\{/);
  assert.match(styles,/\.fitbod-plan \.plan-start-top\{/);
});

test("keeps a generated plan calm by previewing movements before the full list",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const \[showExercises,setShowExercises\] = useState\(false\)/);
  assert.match(page,/const visibleWorkout=showExercises\?workout:workout\.slice\(0,previewCount\)/);
  assert.match(page,/visibleWorkout\.map\(\(ex,i\)=>/);
  assert.match(page,/className=\{`plan-exercise-toggle \$\{showExercises\?"expanded":""\}`\}/);
  assert.match(page,/View the remaining \$\{workout\.length-previewCount\} movements/);
  assert.match(page,/aria-expanded=\{showExercises\}/);
  assert.match(styles,/\.plan-exercise-toggle\{/);
  assert.match(styles,/\.plan-exercise-toggle\.expanded/);
});

test("keeps the mobile plan list focused on video teaching and one visible easier option",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/点击动作看短视频教学/);
  assert.match(page,/Tap a movement for its short video/);
  assert.match(styles,/\.fitbod-plan \.exercise-list \.exercise-actions\{display:none\}/);
  assert.match(styles,/\.fitbod-plan \.exercise-list \.exercise-actions\{display:flex\}/);
  assert.match(styles,/\.fitbod-plan \.exercise-list \.exercise-actions button:first-child\{display:none\}/);
  assert.match(styles,/\.fitbod-plan \.exercise-list \.exercise-actions \.easier\{align-self:flex-start;min-height:36px/);
  assert.match(page,/const previousWorkout=useRef<string\[\]>\(\[\]\)/);
  assert.match(page,/data-easier-notice=\{easierNotice\?/);
  assert.match(page,/className="easier-notice-sr" role="status" aria-live="polite"/);
  assert.match(styles,/\.fitbod-plan\[data-easier-notice\]:before\{content:attr\(data-easier-notice\)/);
  assert.match(styles,/\.fitbod-plan \.exercise-list \.exercise-photo:after\{content:"▶"/);
});

test("shows the last completed set on a planned movement before training starts",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  const planStart=page.indexOf("function Plan(");
  const plan=page.slice(planStart,page.indexOf("function Library",planStart));
  assert.match(plan,/const latestByExercise=useMemo/);
  assert.match(plan,/latestByExercise\.get\(ex\.id\)/);
  assert.match(plan,/className="plan-previous-set"/);
  assert.match(plan,/Use it as today’s reference/);
  assert.match(styles,/\.plan-previous-set\{/);
});

test("shows visible pose evidence instead of an unexplained score",async()=>{
  const [scanner,proof]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/pose-proof.mjs",root),"utf8"),
  ]);
  assert.match(scanner,/createProof/);
  assert.match(scanner,/ANALYZED FRAME/);
  assert.match(scanner,/8 key shoulder, hip, knee, and ankle joints detected/);
  assert.match(scanner,/toDataURL\("image\/jpeg"/);
  assert.match(proof,/selectDeepestSquatFrame/);
  assert.match(proof,/PROOF_CONNECTIONS/);
});

test("puts user value before a compact pricing offer",async()=>{
  const [scanner,offer,styles]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/membership-offer.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.ok(scanner.indexOf('className="report-actions"')<scanner.indexOf('<MembershipOffer language={language} source="form"'));
  assert.match(offer,/compact-offer/);
  assert.match(offer,/offer-plan-summary/);
  assert.match(offer,/offer-plan-switch/);
  assert.match(offer,/FOUNDING PRICE PREFERENCE · ANNUAL/);
  assert.match(offer,/No charge today\. Unlock this report now; any billing requires a separate confirmation first/);
  assert.match(offer,/offer-beta-steps/);
  assert.doesNotMatch(offer,/offer-plan-toggle/);
  assert.doesNotMatch(offer,/offer-benefits/);
  assert.doesNotMatch(offer,/offer-plans/);
  assert.match(styles,/\.posture-report>\.report-actions\{order:1\}/);
  assert.match(styles,/\.posture-report>\.membership-offer\{order:2\}/);
});

test("keeps the first result free and reserves complete coaching for Pro",async()=>{
  const [form,posture,gate,offer,events,styles]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
    readFile(new URL("app/pro-report-gate.tsx",root),"utf8"),
    readFile(new URL("app/membership-offer.tsx",root),"utf8"),
    readFile(new URL("app/api/product-events/route.ts",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  for(const scanner of [form,posture]){
    assert.match(scanner,/proUnlocked/);
    assert.match(scanner,/ProReportGate/);
    assert.match(scanner,/pro_feature_tapped/);
    assert.ok(scanner.indexOf('className="instant-verdict"')<scanner.indexOf("<ProReportGate"));
    assert.match(scanner,/focus\(\{preventScroll:true\}\)/);
  }
  assert.match(gate,/Your direct result is free/);
  assert.match(gate,/Score, direct result, and top priority stay free/);
  assert.match(gate,/One-tap corrective workout/);
  assert.match(offer,/grantProAccess/);
  assert.match(offer,/onAccessGranted/);
  assert.match(events,/pro_feature_tapped/);
  assert.match(events,/pro_access_granted/);
  assert.match(styles,/Value-first Pro boundary/);
});

test("lets anonymous friends join the public beta without uploading media",async()=>{
  const [interestRoute,eventRoute,offer]=await Promise.all([
    readFile(new URL("app/api/membership-interest/route.ts",root),"utf8"),
    readFile(new URL("app/api/product-events/route.ts",root),"utf8"),
    readFile(new URL("app/membership-offer.tsx",root),"utf8"),
  ]);
  assert.match(interestRoute,/authenticated:false/);
  assert.match(interestRoute,/crypto\.subtle\.digest\("SHA-256"/);
  assert.match(interestRoute,/Valid email required/);
  assert.match(eventRoute,/user\?\.id\|\|`anon_\$\{sessionId\}`/);
  assert.doesNotMatch(eventRoute,/if\(!user\)return NextResponse/);
  assert.match(offer,/offer-email/);
  assert.match(offer,/Join founding beta & unlock/);
  assert.match(offer,/EMAIL TO UNLOCK NOW/);
  assert.match(offer,/Full report unlocked/);
  assert.match(offer,/offer-email-\$\{source\}/);
});

test("keeps progress centered on scan, fix, and rescan",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  const focused=page.slice(page.indexOf("function Progress("),page.indexOf("function LegacyProgress("));
  assert.match(focused,/focused-progress/);
  assert.match(focused,/ScanProgressPanel/);
  assert.match(focused,/SCAN · FIX · RESCAN/);
  assert.doesNotMatch(focused,/Only the data that answers/);
  assert.doesNotMatch(focused,/progress-grid|PERSONAL RECORDS|MOVEMENT SKILLS|Last 30 days/);
  assert.match(page,/<Progress t=\{t\} language=\{language\} syncState=\{syncState\}/);
});

test("persists a seven-day scan, fix, and rescan loop",async()=>{
  const [page,formScanner,photoScanner,events]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
    readFile(new URL("app/api/product-events/route.ts",root),"utf8")
  ]);
  assert.match(page,/startCorrectionCycle/);
  assert.match(page,/recordCorrectionWorkout/);
  assert.match(page,/7-DAY FIX/);
  assert.match(page,/resumeCorrection/);
  assert.match(formScanner,/recordCorrectionRescan/);
  assert.match(photoScanner,/recordCorrectionRescan/);
  assert.match(events,/correction_cycle_started/);
  assert.match(events,/correction_cycle_workout_completed/);
  assert.match(events,/correction_cycle_rescanned/);
});

test("ships as an installable, branded mobile app",async()=>{
  const [layout,manifest,styles]=await Promise.all([
    readFile(new URL("app/layout.tsx",root),"utf8"),
    readFile(new URL("public/manifest.webmanifest",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  const parsed=JSON.parse(manifest);
  assert.equal(parsed.display,"standalone");
  assert.equal(parsed.orientation,"portrait-primary");
  assert.ok(parsed.icons.some(icon=>icon.sizes==="512x512"&&icon.purpose.includes("maskable")));
  assert.match(layout,/manifest: "\/manifest\.webmanifest"/);
  assert.match(layout,/appleWebApp/);
  assert.match(layout,/themeColor: "#f3eee4"/);
  assert.match(styles,/Mature consumer-app visual system/);
  await Promise.all(["app-icon-192.png","app-icon-512.png","apple-touch-icon.png"].map(name=>access(new URL(`public/${name}`,root))));
});

test("gives a direct result before optional detail for video and photo scans",async()=>{
  const [form,posture,styles]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  for(const source of [form,posture]){
    assert.match(source,/instant-verdict/);
    assert.match(source,/直接结论/);
    assert.match(source,/report-details/);
    assert.ok(source.indexOf('className="instant-verdict"')<source.indexOf('className="report-details"'));
  }
  assert.match(form,/下一组这样做/);
  assert.match(posture,/第一训练重点/);
  assert.match(styles,/Warm coaching brand, adapted from the supplied transformation flyer/);
});

test("creates a quick posture result automatically from one front photo",async()=>{
  const [page,posture]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
  ]);
  assert.match(page,/1 FRONT PHOTO/);
  assert.match(page,/One front photo creates a quick baseline/);
  assert.match(posture,/autoAnalyzeRequested/);
  assert.match(posture,/void analyze\(\)/);
  assert.match(posture,/Take front photo · auto analyze/);
  assert.doesNotMatch(posture,/onClick=\{analyze\}><span>\{zh\?"一键生成快速结果":"Get my quick result"/);
  assert.match(posture,/labelEn:"Side",required:false/);
});

test("starts video analysis automatically after one recording or upload",async()=>{
  const [scanner,styles]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(scanner,/autoAnalyzeStarted/);
  assert.match(scanner,/onLoadedMetadata=\{\(\)=>/);
  assert.match(scanner,/void analyze\(\)/);
  assert.match(scanner,/Record or upload · auto analyze/);
  assert.match(scanner,/Video ready\. Starting automatically/);
  assert.doesNotMatch(scanner,/onClick=\{analyze\}><span>\{zh\?"开始动作分析":"Analyze my squat"/);
  assert.match(styles,/\.scanner-auto-start/);
});

test("keeps time-to-result measurable and caps long-video sampling",async()=>{
  const [form,posture]=await Promise.all([
    readFile(new URL("app/form-scanner.tsx",root),"utf8"),
    readFile(new URL("app/photo-scanner.tsx",root),"utf8"),
  ]);
  assert.match(form,/Math\.min\(48,Math\.max\(18,Math\.floor\(duration\*5\)\)\)/);
  assert.doesNotMatch(form,/Math\.min\(72,Math\.max\(20,Math\.floor\(duration\*7\)\)\)/);
  assert.match(form,/analysisMs:Math\.round\(performance\.now\(\)-analysisStarted\)/);
  assert.match(form,/sampledFrames:frames\.length/);
  assert.match(form,/requestedFrames:frameCount/);
  assert.match(posture,/analysisMs:Math\.round\(performance\.now\(\)-analysisStarted\)/);
});

test("captures privacy-conscious public beta feedback",async()=>{
  const [schema,migration,route,page]=await Promise.all([
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("drizzle/0005_beta_feedback.sql",root),"utf8"),
    readFile(new URL("app/api/beta-feedback/route.ts",root),"utf8"),
    readFile(new URL("app/page.tsx",root),"utf8"),
  ]);
  assert.match(schema,/betaFeedback/);
  assert.match(migration,/CREATE TABLE `beta_feedback`/);
  assert.match(route,/message\.length<8/);
  assert.match(route,/message\.length>800/);
  assert.match(route,/anonymousReporter/);
  assert.match(route,/recent\.length>=3/);
  assert.match(page,/BetaFeedbackSheet/);
  assert.match(page,/do not include medical or sensitive personal information/);
});

test("keeps movement-library filters compact until the user requests them",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/const\[filtersOpen,setFiltersOpen\]=useState\(false\)/);
  assert.match(page,/className="library-filter-toggle"/);
  assert.match(page,/aria-expanded=\{filtersOpen\}/);
  assert.match(page,/\{filtersOpen&&<section className="library-filters"/);
});

test("gives a new athlete three clear movement-library starting paths",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const chooseCollection=/);
  assert.match(page,/className="library-start-here"/);
  assert.match(page,/新手动作/);
  assert.match(page,/徒手可练/);
  assert.match(page,/活动度准备/);
  assert.match(styles,/\.library-start-here\{/);
  assert.match(styles,/\.library-start-here>div\{display:grid;grid-template-columns:repeat\(3,1fr\)\}/);
});

test("lets an athlete start the movement library from a specific body area",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  const library=page.slice(page.indexOf("function Library("),page.indexOf("function ScanProgressPanel"));
  assert.match(library,/const bodyFocusIcons:Record<BodyPart,string>/);
  assert.match(library,/\["chest","back","shoulders","arms","lower","core"\] as BodyPart\[\]/);
  assert.match(library,/const chooseBodyFocus=\(area:BodyPart\)=>/);
  assert.match(library,/className="library-body-focus"/);
  assert.match(library,/className="library-body-motion"/);
  assert.match(library,/bodyNames\[language\]\[item\.area\]/);
  assert.match(styles,/\.library-body-focus\{/);
  assert.match(styles,/\.library-body-focus>div\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles,/\.library-body-motion\{position:absolute/);
});

test("lets a new athlete browse the movement library by familiar movement patterns",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const patterns=\[\{id:"push"/);
  assert.match(page,/id:"pull"/);
  assert.match(page,/id:"squat"/);
  assert.match(page,/id:"hinge"/);
  assert.match(page,/id:"core"/);
  assert.match(page,/const choosePattern=/);
  assert.match(page,/className="library-patterns"/);
  assert.match(page,/Don’t know the name\? Start with how you want to move\./);
  assert.match(styles,/\.library-patterns\{/);
  assert.match(styles,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});

test("makes each movement card clearly signal difficulty and short-video teaching",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const levelLabel=mobility/);
  assert.match(page,/SHORT VIDEO · TAP TO LEARN/);
  assert.match(page,/const mediaLabel=mobility/);
  assert.doesNotMatch(page,/<em>01 → 02<\/em>/);
  assert.match(page,/className="library-teaching-label"/);
  assert.match(page,/aria-label=\{`\$\{language==="zh"\?ex\.zh:ex\.en\} · \$\{teachingLabel\}`\}/);
  assert.match(styles,/\.library-list \.library-teaching-label\{/);
  assert.match(styles,/▶  VIDEO DEMO/);
});

test("puts the short teaching video before optional frame-by-frame detail",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  const sheetStart=page.indexOf("function ExerciseSheet(");
  const sheet=page.slice(sheetStart,page.indexOf("function WorkoutFeedback",sheetStart));
  assert.match(sheet,/const\[breakdownOpen,setBreakdownOpen\]=useState\(false\)/);
  assert.match(sheet,/const\[detailsOpen,setDetailsOpen\]=useState\(false\)/);
  assert.match(sheet,/<ShortVideoLesson exercise=\{exercise\} language=\{language\} hasEasier=\{Boolean\(easier\)\}/);
  assert.match(page,/function ShortVideoLesson/);
  assert.match(styles,/\.short-video-lesson\{/);
  assert.match(page,/className=\{`guided-practice \$\{practiceMode\}`\}/);
  assert.match(page,/开始互动跟练/);
  assert.match(page,/刚才感觉怎么样/);
  assert.match(styles,/\.guided-practice\{/);
  assert.match(sheet,/className=\{`exercise-next-action \$\{inPlan\?"ready":""\}`\}/);
  assert.match(sheet,/onClick=\{inPlan\?start:togglePlan\}/);
  assert.match(sheet,/className="exercise-breakdown-toggle"/);
  assert.match(sheet,/className="exercise-more-toggle"/);
  assert.match(sheet,/className="exercise-extra-details" hidden=\{!detailsOpen\}/);
  assert.match(sheet,/aria-expanded=\{breakdownOpen\}/);
  assert.match(sheet,/className="coach-watchout"/);
  assert.match(sheet,/WATCH OUT/);
  assert.match(sheet,/const needsSetupCheck=exercise\.gear==="machine"\|\|exercise\.gear==="cable"/);
  assert.match(sheet,/className="equipment-setup-card"/);
  assert.match(sheet,/Complete these 3 setup checks/);
  assert.match(sheet,/className="starter-regression-card"/);
  assert.match(sheet,/Use easier version/);
  assert.ok(sheet.indexOf('className="coach-cue"')<sheet.indexOf('className="coach-watchout"'));
  assert.ok(sheet.indexOf('className="coach-watchout"')<sheet.indexOf('className="starter-regression-card"'));
  assert.ok(sheet.indexOf('className="starter-regression-card"')<sheet.indexOf('className={`exercise-next-action'));
  const directActionIndex=sheet.indexOf('className={`exercise-next-action');
  const detailsIndex=sheet.indexOf('className="exercise-extra-details" hidden={!detailsOpen}');
  const preferencesIndex=sheet.indexOf('className="exercise-primary-actions"');
  assert.ok(directActionIndex>=0&&detailsIndex>directActionIndex&&preferencesIndex>detailsIndex,"keeps preferences behind the video lesson and direct next action");
  assert.ok(sheet.indexOf('<ShortVideoLesson exercise={exercise} language={language}/>')<sheet.indexOf('className="exercise-breakdown-toggle"'));
  assert.match(styles,/\.short-video-steps/);
  assert.match(styles,/\.exercise-breakdown-toggle/);
  assert.match(styles,/\.exercise-more-toggle/);
  assert.match(styles,/\.exercise-next-action\.ready/);
  assert.match(styles,/\.coach-watchout\{/);
  assert.match(styles,/\.equipment-setup-card\{/);
  assert.match(styles,/\.starter-regression-card\{/);
  assert.match(styles,/\.exercise-extra-details>\.exercise-primary-actions\{margin:0 0 14px\}/);
  assert.match(page,/ONE SET · LICENSED MOVEMENT VIDEO/);
  assert.match(page,/ONE SET · GUIDED MOVEMENT PREVIEW/);
  assert.match(sheet,/ONE SET MOTION/);
  assert.match(sheet,/ONE SET LEVELS/);
  assert.match(styles,/\.short-video-player\{min-height:212px/);
  assert.match(styles,/\.short-video-replay\{min-height:44px/);
});

test("keeps the mobile workout focused on one playable demo and the current set",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/className\.includes\("focus-motion"\)/);
  assert.match(page,/Movement preview · Follow the steps below/);
  assert.match(page,/className="guided-demo"/);
  assert.match(styles,/\.workout-mode \.focus-visual \.focus-images figure:nth-child\(2\),\.workout-mode \.up-next\{display:none\}/);
  assert.match(styles,/\.video-to-set\{/);
  assert.match(styles,/html\[lang\^="zh"\] \.focus-data \.set-table:before\{content:"现在完成本组"/);
  assert.match(styles,/html\[lang\^="zh"\] \.focus-data \.set-table:after\{content:"填写重量和次数，然后完成本组"/);
  assert.match(styles,/\.workout-mode \.live-coach>header>div:last-child,.workout-mode \.live-coach-body>button\{display:none\}/);
  assert.match(styles,/\.workout-mode \.set-table-head\{grid-template-columns:52px 1fr 1fr 34px\}/);
});

test("keeps completed training visible on the primary progress path",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/function TrainingHistoryPreview/);
  assert.match(page,/<TrainingHistoryPreview language=\{language\} history=\{recentHistory\} openPlan=\{openPlan\}\/>/);
  assert.match(page,/ONE SET TRAINING HISTORY/);
  assert.match(page,/Every completed session stays here to inform what you do next/);
  assert.match(styles,/\.training-history-preview/);
  assert.match(styles,/\.training-history-list article/);
});

test("carries the last training response into the next-session progress view",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/<LastSessionGuide language=\{language\} history=\{recentHistory\}\/>/);
  assert.match(page,/function LastSessionGuide/);
  assert.match(page,/Pain was logged last time/);
  assert.match(page,/上次记录了疼痛/);
  assert.match(page,/className=\{`last-session-guide \$\{rating\}`\}/);
  assert.match(styles,/\.last-session-guide\{/);
  assert.match(styles,/\.last-session-guide\.pain\{/);
});

test("turns completed training into a concrete next-session decision",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/WorkoutCompletionSheet language=\{language\} workout=\{completedWorkout\} highlights=\{completionHighlights\} close=/);
  assert.match(page,/const \[nextWorkoutDate,setNextWorkoutDate\] = useState<string\|null>\(null\)/);
  assert.match(page,/planNext=\{date=>\{setNextWorkoutDate\(date\);setCompletedWorkout\(null\);setCompletionHighlights\(\[\]\);setTab\("today"\)\}\}/);
  assert.match(page,/function NextWorkoutBooking/);
  assert.match(page,/nextWorkoutDate&&<NextWorkoutBooking/);
  assert.match(page,/const nextCopy:Record<SessionRating/);
  assert.match(page,/const scheduleOptions=\[1,2,3\]/);
  assert.match(page,/className="completion-schedule"/);
  assert.match(page,/className="completion-more-toggle"/);
  assert.match(page,/className=\{`completion-next-step \$\{workout\.rating\}`\}/);
  assert.match(page,/className="completion-next-session-button"/);
  assert.match(page,/const comparePerformance=/);
  assert.match(page,/const bestPerformance=/);
  assert.match(page,/const \[completionHighlights,setCompletionHighlights\]/);
  assert.match(page,/className="completion-records"/);
  assert.match(page,/You set a new best today/);
  assert.match(styles,/\.completion-next-session-button\{/);
  assert.match(styles,/\.completion-records\{/);
  assert.match(styles,/\.completion-schedule\{/);
  assert.match(styles,/\.next-workout-booking\{/);
});

test("makes the weekly training rhythm visible beside the numerical goal",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const weekDays=Array\.from\(\{length:7\}/);
  assert.match(page,/本周节奏/);
  assert.match(page,/Weekly training rhythm/);
  assert.match(styles,/\.weekly-rhythm>section\{display:grid;grid-template-columns:repeat\(7,1fr\)/);
  assert.match(styles,/\.weekly-rhythm>section \.trained/);
});

test("turns completed sets into a clear weekly muscle-coverage check",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const coverageGroups=\[/);
  assert.match(page,/log\.performances\.filter/);
  assert.match(page,/className="weekly-coverage"/);
  assert.match(page,/COMPLETED COVERAGE/);
  assert.match(page,/FROM COMPLETED SETS/);
  assert.match(styles,/\.weekly-coverage>div\{display:grid;grid-template-columns:repeat\(3,1fr\)/);
  assert.match(styles,/\.weekly-coverage article\.covered/);
});

test("turns an uncovered weekly area into a one-tap focused workout",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/buildFocused=\{focus=>buildPlan\(undefined,"",\{focus,randomize:true\}\)\}/);
  const weekly=page.slice(page.indexOf("function WeeklyCoachCard("),page.indexOf("function LastSessionGuide"));
  assert.match(weekly,/const recommendedFocus=nextCoverage\?\.id as "upper"\|"lower"\|"core"\|undefined/);
  assert.match(weekly,/const recommendAnother=Boolean\(weekly\.length>0&&remaining>0&&recommendedFocus\)/);
  assert.match(weekly,/buildFocused\(recommendedFocus\)/);
  assert.match(weekly,/下一场优先练这里/);
  assert.match(weekly,/Build your \$\{nextCoverage\?\.en\} session/);
  assert.match(weekly,/生成\$\{nextCoverage\?\.zh\}训练/);
});

test("keeps beginner protection compact on a mobile generated plan",async()=>{
  const styles=await readFile(new URL("app/globals.css",root),"utf8");
  assert.match(styles,/\.fitbod-plan \.beginner-banner\{min-height:62px/);
  assert.match(styles,/\.fitbod-plan \.beginner-banner>div:nth-child\(2\)>p,.fitbod-plan \.beginner-banner \.ability-btn\{display:none\}/);
  assert.match(styles,/\.fitbod-plan \.mode-switch i\{width:36px;height:20px\}/);
});

test("lets an athlete pin one exercise as a compatible training focus",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/const \[focusExerciseId,setFocusExerciseId\] = useState<string\|null>\(null\)/);
  assert.match(page,/const toggleFocusExercise=\(id:string\)=>setFocusExerciseId/);
  assert.match(page,/const focusExerciseFits=Boolean\(focusExercise/);
  assert.match(page,/const prioritizedIds=focusExerciseFits&&focusExercise/);
  assert.match(page,/toggleFocus=\{\(\)=>toggleFocusExercise\(selected\.id\)\}/);
  assert.match(page,/TRAINING FOCUS/);
  assert.match(styles,/\.exercise-primary-actions>button\.focused/);
});

test("keeps the live workout screen to one coaching cue and a safe regression action",async()=>{
  const [page,styles]=await Promise.all([readFile(new URL("app/page.tsx",root),"utf8"),readFile(new URL("app/globals.css",root),"utf8")]);
  assert.match(styles,/\.workout-mode \.during-help button:first-child\{display:none\}/);
  assert.match(styles,/\.workout-mode \.during-help:has\(button:only-child\)\{display:none\}/);
  assert.match(styles,/\.workout-mode \.live-coach>header>div:last-child,\.workout-mode \.live-coach-body>button,\.workout-mode \.live-rhythm,\.workout-mode \.live-coach>footer\{display:none\}/);
  assert.match(styles,/content:"ONE CUE FOR THIS SET"/);
  assert.match(page,/const canRegressCurrent=matchesAvailableEquipment\(ids\[easierMove\[ex\.id\]\],equipment\)&&setIndex===0/);
  assert.match(page,/canRegressCurrent\?<button onClick=\{\(\)=>\{onEasier\(ex\);onLearningChange\(true\)/);
  assert.match(page,/if\(workoutMode&&replacementIndex>=0\)\{/);
  assert.match(page,/!completed\[key\]\)updated\[key\]=\{weight:replacementExercise\.gear==="bodyweight"\?"0":""/);
});

test("makes the current set and total workout progress explicit before logging",async()=>{
  const [page,styles]=await Promise.all([readFile(new URL("app/page.tsx",root),"utf8"),readFile(new URL("app/globals.css",root),"utf8")]);
  const workoutMode=page.slice(page.indexOf("function WorkoutMode("));
  assert.match(workoutMode,/const currentKey=`\$\{exerciseIndex\}-\$\{setIndex\}`/);
  assert.match(workoutMode,/const completedSetTotal=Object\.values\(completed\)\.filter\(Boolean\)\.length/);
  assert.match(workoutMode,/className="current-set-overview guided-set-target"/);
  assert.match(workoutMode,/`第 \$\{setIndex\+1\} 组，共 \$\{currentSetCount\} 组`/);
  assert.match(workoutMode,/`Set \$\{setIndex\+1\} of \$\{currentSetCount\}`/);
  assert.match(styles,/\.workout-mode \.current-set-overview\{/);
  assert.match(styles,/\.workout-mode \.current-set-overview\+\.set-table:before\{display:none\}/);
});

test("keeps the primary mobile reading path at a comfortably readable scale",async()=>{
  const styles=await readFile(new URL("app/globals.css",root),"utf8");
  assert.match(styles,/\/\* The primary mobile path should never require squinting\. \*\//);
  assert.match(styles,/\.exercise-sheet \.sheet-motion-card strong\{font-size:16px\}/);
  assert.match(styles,/\.exercise-sheet \.sheet-motion-card p\{font-size:12px;line-height:1\.55\}/);
  assert.match(styles,/\.workout-mode \.set-table-head\{font-size:9px\}/);
  assert.match(styles,/\.one-tap-area button\{font-size:10px\}/);
  assert.match(styles,/\.one-tap-primary span\{font-size:17px\}/);
  assert.match(styles,/\.one-tap-layout h1\{font-size:40px\}/);
  assert.match(styles,/\.one-tap-focus button\{height:58px;font-size:13px\}/);
  assert.match(styles,/Phone-in-the-gym readability/);
  assert.match(styles,/\.session-preflight-main p\{font-size:11px;line-height:1\.5\}/);
  assert.match(styles,/\.fitbod-plan \.exercise-info>button\{font-size:17px!important;line-height:1\.2\}/);
  assert.match(styles,/\.workout-mode \.live-coach-body p strong\{font-size:15px;line-height:1\.42\}/);
  assert.match(styles,/\.workout-mode \.set-autofill-note,.workout-mode \.safety-tip\{font-size:11px!important;line-height:1\.5\}/);
});

test("keeps the one-tap voice action visibly labeled before recording begins",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/<span>\{zh\?"语音输入":"VOICE"\}<\/span>/);
  assert.doesNotMatch(page,/one-tap-voice span"\)\.forEach\(span=>\{span\.textContent=""\}\)/);
  assert.match(page,/r\.onend=\(\)=>\{setListening\(false\);recognition\.current=null;if\(failed\)return;if\(transcript\)buildPlan\(undefined,transcript\)/);
  assert.match(styles,/\.one-tap-voice span\{font-size:9px;font-weight:1000/);
  assert.doesNotMatch(styles,/\.one-tap-voice:not\(\.listening\) span:after\{content:"VOICE INPUT"/);
});

test("keeps plan adjustment behind one clear entry instead of duplicate controls",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/className="regenerate-btn" onClick=\{openBuilder\}/);
  assert.match(styles,/\/\* The plan has one clear adjustment path instead of three duplicate controls\. \*\//);
  assert.match(styles,/\.fitbod-plan \.quick-controls\{display:none\}/);
});

test("keeps live workout execution focused on one playable demo, one cue, and the current set",async()=>{
  const styles=await readFile(new URL("app/globals.css",root),"utf8");
  assert.match(styles,/Live training is deliberately calmer than planning: one demo, one cue, one set/);
  assert.match(styles,/\.workout-mode \.focus-images figure:nth-child\(2\),\.workout-mode \.video-to-set,\.workout-mode \.up-next,\.workout-mode \.focus-visual>button\{display:none\}/);
  assert.match(styles,/\.workout-mode \.set-row:not\(\.current\)\{display:none!important\}/);
  assert.match(styles,/\.workout-mode \.set-table:before\{content:"CURRENT SET"/);
  assert.match(styles,/\.workout-mode \.set-row\.current input\{min-width:0;width:100%;min-height:52px;font-size:18px\}/);
});

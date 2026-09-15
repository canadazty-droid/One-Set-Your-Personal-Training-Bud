import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);

test("ships the Form backend golden path and migration",async()=>{
  const [schema,migration,plans,today,workouts,history,records,profile]=await Promise.all([
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("drizzle/0004_form_ai_plans.sql",root),"utf8"),
    readFile(new URL("app/api/plans/route.ts",root),"utf8"),
    readFile(new URL("app/api/plans/today/route.ts",root),"utf8"),
    readFile(new URL("app/api/workouts/route.ts",root),"utf8"),
    readFile(new URL("app/api/exercise-history/route.ts",root),"utf8"),
    readFile(new URL("app/api/personal-records/route.ts",root),"utf8"),
    readFile(new URL("app/api/profile/route.ts",root),"utf8"),
  ]);
  assert.match(schema,/userProfiles/);assert.match(schema,/workoutPlans/);assert.match(schema,/formApiTokens/);
  assert.match(migration,/CREATE TABLE `user_profiles`/);assert.match(migration,/CREATE TABLE `workout_plans`/);assert.match(migration,/CREATE TABLE `form_api_tokens`/);assert.match(migration,/ADD `status`/);
  assert.match(plans,/createWorkoutPlan/);assert.match(plans,/updateWorkoutPlan/);assert.match(today,/getTodaySession/);
  assert.match(workouts,/logSet/);assert.match(workouts,/completeWorkout/);assert.match(history,/getExerciseHistory/);assert.match(records,/getPersonalRecords/);assert.match(profile,/upsertProfile/);
});

test("exposes a revocable, user-owned MCP connection instead of trusting production email headers",async()=>{
  const [auth,tokenRoute,mcp,cli]=await Promise.all([
    readFile(new URL("lib/form/auth.ts",root),"utf8"),
    readFile(new URL("app/api/integrations/token/route.ts",root),"utf8"),
    readFile(new URL("mcp/server.mjs",root),"utf8"),
    readFile(new URL("cli/form.mjs",root),"utf8"),
  ]);
  assert.match(auth,/Bearer form_live_/);assert.match(auth,/SHA-256/);assert.match(auth,/NODE_ENV === "development"/);
  assert.match(tokenRoute,/getChatGPTUser/);assert.match(tokenRoute,/revokedAt/);assert.match(tokenRoute,/Copy this token now/);
  for(const name of ["get_profile","get_training_goals","get_recent_workouts","get_exercise_history","get_personal_records","create_workout_plan","update_workout_plan","log_workout","log_set","complete_workout"])assert.match(mcp,new RegExp(`name: "${name}"`));
  assert.match(mcp,/FORM_API_TOKEN/);assert.match(mcp,/tools\/list/);assert.match(mcp,/tools\/call/);assert.match(cli,/FORM_API_TOKEN/);
});

test("preserves AI-authored prescriptions and logs each completed set",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/setPlanSetCounts\(data\.today\.exercises\.map\(item=>item\.sets\)\)/);
  assert.match(page,/savedWeight\|\|\(exercise\.gear==="bodyweight"\?"0":""\)/);
  assert.match(page,/setCounts=\{workout\.map/);
  assert.match(page,/action:"log_set"/);
  assert.match(page,/activeWorkoutId/);
  assert.match(page,/queuePendingWorkout\(log\)/);
});

test("keeps a one-tap native workout as the primary first-use path",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/quickBuild=\{nextFocus=>buildPlan/);
  assert.match(page,/ONE-TAP WORKOUT/);
  assert.match(page,/Quick workout focus/);
  assert.match(page,/randomize:true/);
  assert.match(page,/Save to Form to sync it here/);
  assert.doesNotMatch(page,/临时本地生成/);
});

test("keeps a clear fresh-workout path beside a saved plan",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/className="today-refresh-card"/);
  assert.match(page,/className="today-refresh-focus"/);
  assert.match(page,/onClick=\{\(\)=>quickBuild\(quickFocus\)\}/);
  assert.match(page,/const quickFocusLabel=/);
  assert.match(page,/aria-pressed=\{quickFocus===item\}/);
  assert.match(styles,/\.today-refresh-card\{/);
  assert.match(styles,/\.today-refresh-primary\{/);
});

test("lets the movement database filter by a precise target muscle",async()=>{
  const [page,styles]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/globals.css",root),"utf8"),
  ]);
  assert.match(page,/type LibraryTarget = SpecificTarget \| "all"/);
  assert.match(page,/const matchesSpecificTarget=/);
  assert.match(page,/const \[libraryTarget,setLibraryTarget\] = useState<LibraryTarget>\("all"\)/);
  assert.match(page,/matchesSpecificTarget\(ex,libraryTarget\)/);
  assert.match(page,/const targets:LibraryTarget\[\]=\["all","glutes","quads","hamstrings","lats","upperBack","biceps","triceps","abs","stability"\]/);
  assert.match(page,/className="filter-group library-muscle-filter"/);
  assert.match(page,/targetFilter=\{libraryTarget\}/);
  assert.match(styles,/\.library-muscle-filter\{/);
});

test("turns saved training into a weekly next-step retention loop",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/function WeeklyCoachCard/);
  assert.match(page,/history=\{history\}/);
  assert.match(page,/weeklyGoal=\{weeklyGoal\}/);
  assert.match(page,/WEEKLY GOAL COMPLETE/);
  assert.match(page,/Start today's workout/);
});

test("makes a completed workout shareable without appearance scoring",async()=>{
  const [page,share,eventRoute]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/share-card.mjs",root),"utf8"),
    readFile(new URL("app/api/product-events/route.ts",root),"utf8"),
  ]);
  assert.match(page,/WorkoutCompletionSheet/);
  assert.match(page,/shareWorkoutSummary/);
  assert.match(share,/shareWorkoutSummary/);
  assert.match(share,/TRAINING RECORDS · NEVER APPEARANCE/);
  assert.match(eventRoute,/workout_share_created/);
});

test("explains the local-to-account sync path instead of leaving guests at a sync error",async()=>{
  const page=await readFile(new URL("app/page.tsx",root),"utf8");
  assert.match(page,/accountState/);
  assert.match(page,/ONE SET · LOCAL MODE/);
  assert.match(page,/Sign in with ChatGPT to sync training/);
  assert.match(page,/signin-with-chatgpt\?return_to=%2F/);
  assert.match(page,/Account connected · continue on another device/);
  assert.match(page,/account_sync_started/);
});

test("syncs actual athlete preferences after account sign-in",async()=>{
  const [page,profileRoute]=await Promise.all([
    readFile(new URL("app/page.tsx",root),"utf8"),
    readFile(new URL("app/api/profile/route.ts",root),"utf8"),
  ]);
  assert.match(page,/cloudProfileReady/);
  assert.match(page,/fetch\("\/api\/profile"/);
  assert.match(page,/weeklyDays:weeklyGoal/);
  assert.match(page,/setCloudProfileReady\(true\)/);
  assert.match(profileRoute,/profileExists/);
});

test("keeps advanced athlete preferences in the account profile and applies them to one-tap plans",async()=>{
  const [schema,migration,profileLib,profileRoute,page]=await Promise.all([
    readFile(new URL("db/schema.ts",root),"utf8"),
    readFile(new URL("drizzle/0006_advanced_training_profile.sql",root),"utf8"),
    readFile(new URL("lib/form/profile.ts",root),"utf8"),
    readFile(new URL("app/api/profile/route.ts",root),"utf8"),
    readFile(new URL("app/page.tsx",root),"utf8"),
  ]);
  assert.match(schema,/advancedProfileJson:text\("advanced_profile_json"\)/);
  assert.match(migration,/ALTER TABLE `user_profiles` ADD `advanced_profile_json`/);
  assert.match(profileLib,/parseAdvancedProfile/);
  assert.match(profileLib,/advancedProfileJson: JSON\.stringify\(next\.advancedProfile\)/);
  assert.match(profileRoute,/advancedProfile: body\.advancedProfile/);
  assert.match(page,/advancedProfile:syncedAdvancedProfile\(advancedProfile\)/);
  assert.match(page,/const advancedProfileActive=builderMode==="advanced"\|\|hasAdvancedPersonalization\(advancedProfile\)/);
  assert.match(page,/const advancedExclusions=advancedProfileActive/);
});

test("gives a signed-in athlete portable data and a deliberate erase control",async()=>{
  const [account,page]=await Promise.all([
    readFile(new URL("app/api/account/route.ts",root),"utf8"),
    readFile(new URL("app/page.tsx",root),"utf8"),
  ]);
  assert.match(account,/getChatGPTUser/);
  assert.match(account,/content-disposition/);
  assert.match(account,/formApiTokens/);
  assert.match(account,/db\.delete\(workouts\)/);
  assert.match(account,/db\.delete\(scanRecords\)/);
  assert.match(page,/DataControlsSheet/);
  assert.match(page,/Type DELETE to enable deletion/);
  assert.match(page,/Original media is not uploaded/);
});

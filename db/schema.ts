import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const userIdentities = sqliteTable("user_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerUserId: text("provider_user_id").notNull(),
  providerUnionId: text("provider_union_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [
  uniqueIndex("user_identities_provider_uidx").on(table.provider, table.providerUserId),
  index("user_identities_user_idx").on(table.userId),
]);

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  lastUsedAt: integer("last_used_at"),
}, table => [
  index("user_sessions_user_idx").on(table.userId, table.expiresAt),
]);

export const workouts = sqliteTable("workouts",{
  id:text("id").primaryKey(),
  userEmail:text("user_email").notNull(),
  createdAt:integer("created_at").notNull(),
  completedAt:integer("completed_at").notNull(),
  focus:text("focus").notNull(),
  durationMinutes:integer("duration_minutes").notNull(),
  exerciseCount:integer("exercise_count").notNull(),
  setCount:integer("set_count").notNull(),
  totalVolumeKg:real("total_volume_kg").notNull().default(0),
  sessionRating:text("session_rating").notNull().default("right"),
  status:text("status").notNull().default("completed"),
  planId:text("plan_id"),
  perceivedDifficulty:integer("perceived_difficulty"),
  energyLevel:integer("energy_level"),
  sorenessLevel:integer("soreness_level"),
  notes:text("notes").notNull().default(""),
  source:text("source").notNull().default("web"),
  startedAt:integer("started_at"),
},table=>[
  index("workouts_user_completed_idx").on(table.userEmail,table.completedAt),
]);

export const workoutSets = sqliteTable("workout_sets",{
  id:text("id").primaryKey(),
  workoutId:text("workout_id").notNull().references(()=>workouts.id,{onDelete:"cascade"}),
  exerciseId:text("exercise_id").notNull(),
  setNumber:integer("set_number").notNull(),
  weightKg:real("weight_kg").notNull().default(0),
  reps:integer("reps").notNull(),
  notes:text("notes").notNull().default(""),
  rpe:real("rpe"),
  rir:real("rir"),
  durationSeconds:integer("duration_seconds"),
  distanceMeters:real("distance_meters"),
  setType:text("set_type").notNull().default("working"),
  completed:integer("completed",{mode:"boolean"}).notNull().default(true),
  completedAt:integer("completed_at"),
  source:text("source").notNull().default("web"),
},table=>[
  index("workout_sets_workout_idx").on(table.workoutId),
  index("workout_sets_exercise_idx").on(table.exerciseId),
]);

export const scanRecords = sqliteTable("scan_records",{
  id:text("id").primaryKey(),
  userId:text("user_id").notNull(),
  createdAt:integer("created_at").notNull(),
  scanType:text("scan_type").notNull(),
  score:integer("score").notNull(),
  confidence:integer("confidence").notNull(),
  repCount:integer("rep_count"),
  photoCount:integer("photo_count"),
  metricsJson:text("metrics_json").notNull(),
},table=>[
  index("scan_records_user_created_idx").on(table.userId,table.createdAt),
]);

export const membershipInterests = sqliteTable("membership_interests",{
  userId:text("user_id").primaryKey(),
  userEmail:text("user_email").notNull(),
  selectedPlan:text("selected_plan").notNull(),
  createdAt:integer("created_at").notNull(),
  updatedAt:integer("updated_at").notNull(),
});

export const userProfiles = sqliteTable("user_profiles",{
  userEmail:text("user_email").primaryKey(),
  displayName:text("display_name"),
  trainingGoal:text("training_goal").notNull().default("muscle"),
  weeklyDays:integer("weekly_days").notNull().default(4),
  equipment:text("equipment").notNull().default("gym"),
  level:text("level").notNull().default("intermediate"),
  weightUnit:text("weight_unit").notNull().default("lb"),
  notes:text("notes").notNull().default(""),
  advancedProfileJson:text("advanced_profile_json").notNull().default("{}"),
  gender:text("gender").notNull().default("unspecified"),
  age:integer("age"),
  heightCm:real("height_cm"),
  weightKg:real("weight_kg"),
  sessionLengthMinutes:integer("session_length_minutes").notNull().default(45),
  injuriesOrLimitations:text("injuries_or_limitations").notNull().default("none"),
  preferredTrainingStyle:text("preferred_training_style").notNull().default("balanced"),
  createdAt:integer("created_at").notNull(),
  updatedAt:integer("updated_at").notNull(),
});

export const workoutPlans = sqliteTable("workout_plans",{
  id:text("id").primaryKey(),
  userEmail:text("user_email").notNull(),
  name:text("name").notNull(),
  scheduleJson:text("schedule_json").notNull(),
  active:integer("active",{mode:"boolean"}).notNull().default(true),
  createdAt:integer("created_at").notNull(),
  updatedAt:integer("updated_at").notNull(),
  planVersion:integer("plan_version").notNull().default(1),
  parentPlanId:text("parent_plan_id"),
  startDate:text("start_date"),
  endDate:text("end_date"),
  goal:text("goal").notNull().default("recomposition"),
  weeklyTrainingDays:integer("weekly_training_days").notNull().default(3),
  adjustmentReason:text("adjustment_reason").notNull().default("Initial plan"),
  cycleJson:text("cycle_json").notNull().default("{}"),
},table=>[
  index("workout_plans_user_active_idx").on(table.userEmail,table.active),
]);

export const trainingDays = sqliteTable("training_days",{
  id:text("id").primaryKey(),
  planId:text("plan_id").notNull().references(()=>workoutPlans.id,{onDelete:"cascade"}),
  weekNumber:integer("week_number").notNull(),
  dayNumber:integer("day_number").notNull(),
  dayOfWeek:integer("day_of_week").notNull(),
  focusArea:text("focus_area").notNull(),
  notes:text("notes").notNull().default(""),
},table=>[
  index("training_days_plan_week_idx").on(table.planId,table.weekNumber,table.dayNumber),
]);

export const planExercises = sqliteTable("plan_exercises",{
  id:text("id").primaryKey(),
  trainingDayId:text("training_day_id").notNull().references(()=>trainingDays.id,{onDelete:"cascade"}),
  name:text("name").notNull(),
  sets:integer("sets").notNull(),
  reps:text("reps").notNull(),
  restSeconds:integer("rest_seconds").notNull(),
  notes:text("notes").notNull().default(""),
},table=>[
  index("plan_exercises_day_idx").on(table.trainingDayId),
]);

export const bodyWeightEntries = sqliteTable("body_weight_entries",{
  id:text("id").primaryKey(),
  userEmail:text("user_email").notNull(),
  recordedAt:integer("recorded_at").notNull(),
  weightKg:real("weight_kg").notNull(),
  source:text("source").notNull().default("manual"),
},table=>[
  index("body_weight_user_recorded_idx").on(table.userEmail,table.recordedAt),
]);

export const weeklyReviews = sqliteTable("weekly_reviews",{
  id:text("id").primaryKey(),
  userEmail:text("user_email").notNull(),
  planId:text("plan_id").references(()=>workoutPlans.id),
  weekStart:text("week_start").notNull(),
  weekEnd:text("week_end").notNull(),
  completionRate:real("completion_rate").notNull(),
  averageEnergy:real("average_energy").notNull(),
  averageSoreness:real("average_soreness").notNull(),
  missedWorkouts:integer("missed_workouts").notNull(),
  bestPerformedDay:text("best_performed_day"),
  riskFlagsJson:text("risk_flags_json").notNull().default("[]"),
  nextWeekAdjustment:text("next_week_adjustment").notNull(),
  createdAt:integer("created_at").notNull(),
},table=>[
  index("weekly_reviews_user_created_idx").on(table.userEmail,table.createdAt),
]);

export const formApiTokens = sqliteTable("form_api_tokens",{
  id:text("id").primaryKey(),
  userEmail:text("user_email").notNull(),
  tokenHash:text("token_hash").notNull().unique(),
  tokenHint:text("token_hint").notNull(),
  createdAt:integer("created_at").notNull(),
  lastUsedAt:integer("last_used_at"),
  revokedAt:integer("revoked_at"),
},table=>[
  index("form_api_tokens_user_idx").on(table.userEmail,table.createdAt),
]);

export const productEvents = sqliteTable("product_events",{
  id:text("id").primaryKey(),
  userId:text("user_id").notNull(),
  sessionId:text("session_id").notNull(),
  eventName:text("event_name").notNull(),
  occurredAt:integer("occurred_at").notNull(),
  source:text("source"),
  variant:text("variant"),
  metadataJson:text("metadata_json").notNull().default("{}"),
},table=>[
  index("product_events_name_occurred_idx").on(table.eventName,table.occurredAt),
  index("product_events_user_occurred_idx").on(table.userId,table.occurredAt),
]);

// Deliberately excludes photo, video, health, and contact information.
export const betaFeedback = sqliteTable("beta_feedback",{
  id:text("id").primaryKey(),
  reporterId:text("reporter_id").notNull(),
  category:text("category").notNull(),
  message:text("message").notNull(),
  page:text("page").notNull(),
  createdAt:integer("created_at").notNull(),
},table=>[
  index("beta_feedback_created_idx").on(table.createdAt),
  index("beta_feedback_reporter_created_idx").on(table.reporterId,table.createdAt),
]);

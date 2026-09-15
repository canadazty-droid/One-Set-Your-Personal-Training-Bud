ALTER TABLE `user_profiles` ADD `gender` text DEFAULT 'unspecified' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `age` integer;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `height_cm` real;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `weight_kg` real;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `session_length_minutes` integer DEFAULT 45 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `injuries_or_limitations` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `preferred_training_style` text DEFAULT 'balanced' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `plan_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `parent_plan_id` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `start_date` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `end_date` text;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `goal` text DEFAULT 'recomposition' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `weekly_training_days` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `adjustment_reason` text DEFAULT 'Initial plan' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `cycle_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `plan_id` text;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `perceived_difficulty` integer;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `energy_level` integer;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `soreness_level` integer;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `plan_id` text,
  `week_start` text NOT NULL,
  `week_end` text NOT NULL,
  `completion_rate` real NOT NULL,
  `average_energy` real NOT NULL,
  `average_soreness` real NOT NULL,
  `missed_workouts` integer NOT NULL,
  `best_performed_day` text,
  `risk_flags_json` text DEFAULT '[]' NOT NULL,
  `next_week_adjustment` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `weekly_reviews_user_created_idx` ON `weekly_reviews` (`user_email`,`created_at`);

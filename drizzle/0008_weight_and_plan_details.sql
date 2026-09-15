CREATE TABLE `training_days` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `week_number` integer NOT NULL,
  `day_number` integer NOT NULL,
  `day_of_week` integer NOT NULL,
  `focus_area` text NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_days_plan_week_idx` ON `training_days` (`plan_id`,`week_number`,`day_number`);
--> statement-breakpoint
CREATE TABLE `plan_exercises` (
  `id` text PRIMARY KEY NOT NULL,
  `training_day_id` text NOT NULL,
  `name` text NOT NULL,
  `sets` integer NOT NULL,
  `reps` text NOT NULL,
  `rest_seconds` integer NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  FOREIGN KEY (`training_day_id`) REFERENCES `training_days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_exercises_day_idx` ON `plan_exercises` (`training_day_id`);
--> statement-breakpoint
CREATE TABLE `body_weight_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `user_email` text NOT NULL,
  `recorded_at` integer NOT NULL,
  `weight_kg` real NOT NULL,
  `source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `body_weight_user_recorded_idx` ON `body_weight_entries` (`user_email`,`recorded_at`);

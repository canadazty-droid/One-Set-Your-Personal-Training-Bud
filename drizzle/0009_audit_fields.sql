ALTER TABLE `user_profiles` ADD `created_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `created_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `notes` text NOT NULL DEFAULT '';

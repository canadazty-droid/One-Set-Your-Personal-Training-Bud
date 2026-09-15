CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`weight_kg` real DEFAULT 0 NOT NULL,
	`reps` integer NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workout_sets_workout_idx` ON `workout_sets` (`workout_id`);--> statement-breakpoint
CREATE INDEX `workout_sets_exercise_idx` ON `workout_sets` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`completed_at` integer NOT NULL,
	`focus` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`exercise_count` integer NOT NULL,
	`set_count` integer NOT NULL,
	`total_volume_kg` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_user_completed_idx` ON `workouts` (`user_email`,`completed_at`);
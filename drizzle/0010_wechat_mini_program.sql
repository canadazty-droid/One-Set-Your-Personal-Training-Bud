CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `user_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`provider_union_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_identities_provider_uidx` ON `user_identities` (`provider`,`provider_user_id`);
--> statement-breakpoint
CREATE INDEX `user_identities_user_idx` ON `user_identities` (`user_id`);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`user_id`,`expires_at`);
--> statement-breakpoint
ALTER TABLE `workouts` ADD `source` text DEFAULT 'web' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workouts` ADD `started_at` integer;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `rpe` real;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `rir` real;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `duration_seconds` integer;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `distance_meters` real;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `set_type` text DEFAULT 'working' NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `completed` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `completed_at` integer;
--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `source` text DEFAULT 'web' NOT NULL;

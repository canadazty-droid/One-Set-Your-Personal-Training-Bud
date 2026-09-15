CREATE TABLE `user_profiles` (
	`user_email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`training_goal` text DEFAULT 'muscle' NOT NULL,
	`weekly_days` integer DEFAULT 4 NOT NULL,
	`equipment` text DEFAULT 'gym' NOT NULL,
	`level` text DEFAULT 'intermediate' NOT NULL,
	`weight_unit` text DEFAULT 'lb' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`schedule_json` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workout_plans_user_active_idx` ON `workout_plans` (`user_email`,`active`);
--> statement-breakpoint
ALTER TABLE `workouts` ADD `status` text DEFAULT 'completed' NOT NULL;
--> statement-breakpoint
CREATE TABLE `form_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_hint` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_api_tokens_token_hash_unique` ON `form_api_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `form_api_tokens_user_idx` ON `form_api_tokens` (`user_email`,`created_at`);

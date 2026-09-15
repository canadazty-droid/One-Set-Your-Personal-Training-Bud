CREATE TABLE `membership_interests` (
	`user_id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`selected_plan` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`scan_type` text NOT NULL,
	`score` integer NOT NULL,
	`confidence` integer NOT NULL,
	`rep_count` integer,
	`photo_count` integer,
	`metrics_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scan_records_user_created_idx` ON `scan_records` (`user_id`,`created_at`);
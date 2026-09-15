CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_name` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`source` text,
	`variant` text,
	`metadata_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_events_name_occurred_idx` ON `product_events` (`event_name`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `product_events_user_occurred_idx` ON `product_events` (`user_id`,`occurred_at`);
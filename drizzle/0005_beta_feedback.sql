CREATE TABLE `beta_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`page` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `beta_feedback_created_idx` ON `beta_feedback` (`created_at`);
--> statement-breakpoint
CREATE INDEX `beta_feedback_reporter_created_idx` ON `beta_feedback` (`reporter_id`,`created_at`);

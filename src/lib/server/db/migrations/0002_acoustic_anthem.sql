CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`actor_email` text,
	`path` text NOT NULL,
	`method` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_user_idx` ON `admin_audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`event_type` text NOT NULL,
	`provider` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `analytics_events_type_created_idx` ON `analytics_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_user_idx` ON `analytics_events` (`user_id`);
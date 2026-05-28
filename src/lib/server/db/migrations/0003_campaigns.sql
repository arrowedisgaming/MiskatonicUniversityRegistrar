CREATE TABLE `campaign_members` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`investigator_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`investigator_id`) REFERENCES `investigators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaign_members_campaign_idx` ON `campaign_members` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `campaign_members_user_idx` ON `campaign_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `campaign_members_investigator_idx` ON `campaign_members` (`investigator_id`);--> statement-breakpoint
CREATE TABLE `campaign_rolls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text,
	`investigator_id` text,
	`investigator_name` text NOT NULL,
	`entry` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`investigator_id`) REFERENCES `investigators`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `campaign_rolls_campaign_id_idx` ON `campaign_rolls` (`campaign_id`,`id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`keeper_user_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`share_id` text,
	`is_open` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`keeper_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_share_id_unique` ON `campaigns` (`share_id`);--> statement-breakpoint
CREATE INDEX `campaigns_keeper_idx` ON `campaigns` (`keeper_user_id`);--> statement-breakpoint
CREATE INDEX `campaigns_share_id_idx` ON `campaigns` (`share_id`);
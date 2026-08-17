CREATE TABLE `catalog_credit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rs_version_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`category_code` text NOT NULL,
	`category_name` text NOT NULL,
	`is_keystone` integer DEFAULT false NOT NULL,
	`points_raw` text,
	`aim` text,
	`references` text,
	`source_page_start` integer,
	`source_page_end` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rs_version_id`) REFERENCES `rs_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_credit_unique` ON `catalog_credit` (`rs_version_id`,`code`);--> statement-breakpoint
CREATE TABLE `catalog_requirement` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`catalog_credit_id` text NOT NULL,
	`seq` integer NOT NULL,
	`text` text NOT NULL,
	`metric_type` text NOT NULL,
	`unit` text,
	`points_raw` text,
	`numeric_spec` text,
	`evidence_specs` text,
	`source_page_start` integer,
	`source_page_end` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalog_credit_id`) REFERENCES `catalog_credit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence_doc` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`requirement_entry_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requirement_entry_id`) REFERENCES `requirement_entry`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parsed_credit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_document_id` text NOT NULL,
	`scheme` text NOT NULL,
	`stage` text NOT NULL,
	`code` text NOT NULL,
	`category_code` text NOT NULL,
	`category_name` text NOT NULL,
	`title` text NOT NULL,
	`is_keystone` integer DEFAULT false NOT NULL,
	`points_raw` text,
	`aim` text,
	`references` text,
	`page_start` integer,
	`page_end` integer,
	`promoted` integer DEFAULT false NOT NULL,
	`dropped` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_document_id`) REFERENCES `source_document`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `parsed_credit_doc_idx` ON `parsed_credit` (`source_document_id`,`code`);--> statement-breakpoint
CREATE TABLE `parsed_requirement` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`parsed_credit_id` text NOT NULL,
	`seq` integer NOT NULL,
	`text` text NOT NULL,
	`metric_type` text NOT NULL,
	`unit` text,
	`points_raw` text,
	`numeric_spec` text,
	`evidence_specs` text,
	`page_start` integer,
	`page_end` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parsed_credit_id`) REFERENCES `parsed_credit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_credit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text NOT NULL,
	`catalog_credit_id` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalog_credit_id`) REFERENCES `catalog_credit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_credit_unique` ON `project_credit` (`project_id`,`catalog_credit_id`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rs_version_id` text,
	`name` text NOT NULL,
	`type` text,
	`location` text,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rs_version_id`) REFERENCES `rs_version`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rating_system` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`authority` text,
	`country` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `requirement_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_credit_id` text NOT NULL,
	`catalog_requirement_id` text NOT NULL,
	`value_bool` integer,
	`value_number` integer,
	`value_text` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`note` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_credit_id`) REFERENCES `project_credit`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalog_requirement_id`) REFERENCES `catalog_requirement`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rs_version` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rating_system_id` text NOT NULL,
	`scheme` text NOT NULL,
	`stage` text NOT NULL,
	`version_label` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_document_id` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rating_system_id`) REFERENCES `rating_system`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rs_version_unique` ON `rs_version` (`rating_system_id`,`scheme`,`stage`,`version_label`);--> statement-breakpoint
CREATE TABLE `source_document` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rs_version_id` text,
	`project_id` text,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`error` text,
	`page_count` integer,
	`scheme` text,
	`stage` text,
	`raw_text` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

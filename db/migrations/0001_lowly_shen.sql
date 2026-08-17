ALTER TABLE `parsed_credit` ADD `ai_proposal` text;--> statement-breakpoint
ALTER TABLE `parsed_credit` ADD `ai_status` text;--> statement-breakpoint
ALTER TABLE `parsed_requirement` ADD `origin` text DEFAULT 'deterministic' NOT NULL;
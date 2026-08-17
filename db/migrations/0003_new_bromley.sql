ALTER TABLE `catalog_credit` ADD `applicability` text;--> statement-breakpoint
ALTER TABLE `catalog_credit` ADD `supporting_guidance` text;--> statement-breakpoint
ALTER TABLE `catalog_credit` ADD `tool_ref` text;--> statement-breakpoint
ALTER TABLE `catalog_credit` ADD `reconciliation` text;--> statement-breakpoint
ALTER TABLE `catalog_requirement` ADD `points_type` text;--> statement-breakpoint
ALTER TABLE `catalog_requirement` ADD `option_group` text;--> statement-breakpoint
ALTER TABLE `catalog_requirement` ADD `keystone` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_requirement` ADD `keystone_condition` text;--> statement-breakpoint
ALTER TABLE `catalog_requirement` ADD `evidence` text;--> statement-breakpoint
ALTER TABLE `parsed_credit` ADD `applicability` text;--> statement-breakpoint
ALTER TABLE `parsed_credit` ADD `supporting_guidance` text;--> statement-breakpoint
ALTER TABLE `parsed_credit` ADD `tool_ref` text;--> statement-breakpoint
ALTER TABLE `parsed_credit` ADD `reconciliation` text;--> statement-breakpoint
ALTER TABLE `parsed_requirement` ADD `points_type` text;--> statement-breakpoint
ALTER TABLE `parsed_requirement` ADD `option_group` text;--> statement-breakpoint
ALTER TABLE `parsed_requirement` ADD `keystone` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `parsed_requirement` ADD `keystone_condition` text;--> statement-breakpoint
ALTER TABLE `parsed_requirement` ADD `evidence` text;--> statement-breakpoint
ALTER TABLE `rs_version` ADD `scope_totals` text;
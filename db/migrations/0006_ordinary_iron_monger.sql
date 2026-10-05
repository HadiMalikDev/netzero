ALTER TABLE "project_credit" ADD COLUMN "targeted" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "target_tier" text;--> statement-breakpoint
ALTER TABLE "rs_version" ADD COLUMN "tier_thresholds" text;--> statement-breakpoint
-- Seed the Mostadam Commercial D+C (2019) rating levels, Full Scope, from the
-- manual's Table 1 (p.15): Green >= 25 ... Diamond >= 105 of 130.
UPDATE "rs_version" SET "tier_thresholds" = '[{"tier":"Green","min":25},{"tier":"Bronze","min":45},{"tier":"Silver","min":65},{"tier":"Gold","min":85},{"tier":"Diamond","min":105}]' WHERE lower("scheme") LIKE '%commercial%' AND replace(upper("stage"), ' ', '') IN ('D+C', 'DC') AND "tier_thresholds" IS NULL;

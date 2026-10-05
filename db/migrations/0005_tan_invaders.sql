ALTER TABLE "evidence_doc" ALTER COLUMN "requirement_entry_id" DROP NOT NULL;--> statement-breakpoint
-- Added nullable, backfilled from each file's requirement, then made NOT NULL:
-- a plain ADD COLUMN ... NOT NULL fails on a table that already has rows.
ALTER TABLE "evidence_doc" ADD COLUMN "project_credit_id" text;--> statement-breakpoint
UPDATE "evidence_doc" AS d SET "project_credit_id" = e."project_credit_id" FROM "requirement_entry" AS e WHERE e."id" = d."requirement_entry_id";--> statement-breakpoint
ALTER TABLE "evidence_doc" ALTER COLUMN "project_credit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD CONSTRAINT "evidence_doc_project_credit_id_project_credit_id_fk" FOREIGN KEY ("project_credit_id") REFERENCES "public"."project_credit"("id") ON DELETE no action ON UPDATE no action;

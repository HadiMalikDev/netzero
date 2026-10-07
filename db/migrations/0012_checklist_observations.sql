CREATE TABLE "checklist_observation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"template_id" text NOT NULL,
	"inspection_id" text,
	"item_no" text,
	"observation" text NOT NULL,
	"recommendation" text,
	"recommendation_source" text,
	"ai_state" text,
	"before_photo_id" text,
	"corrective_action" text,
	"after_photo_id" text,
	"observed_on" text,
	"closed_on" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_template" ADD COLUMN "observation_log" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD COLUMN "observation_title" text DEFAULT 'Observations' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_observation" ADD CONSTRAINT "checklist_observation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_observation" ADD CONSTRAINT "checklist_observation_template_id_checklist_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_observation" ADD CONSTRAINT "checklist_observation_inspection_id_checklist_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."checklist_inspection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_observation" ADD CONSTRAINT "checklist_observation_before_photo_id_evidence_doc_id_fk" FOREIGN KEY ("before_photo_id") REFERENCES "public"."evidence_doc"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_observation" ADD CONSTRAINT "checklist_observation_after_photo_id_evidence_doc_id_fk" FOREIGN KEY ("after_photo_id") REFERENCES "public"."evidence_doc"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_observation_template_idx" ON "checklist_observation" USING btree ("template_id");--> statement-breakpoint
-- The ESC form prints its Environmental Observations log (the client's form, page 3).
UPDATE "checklist_template" SET "observation_log" = true, "observation_title" = 'Environmental Observations' WHERE "id" = 'tpl_default_esc';

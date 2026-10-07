ALTER TABLE "checklist_inspection" ADD COLUMN "inspection_time" text;--> statement-breakpoint
ALTER TABLE "checklist_inspection" ADD COLUMN "ref_no" text;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD COLUMN "compliant_answer" text DEFAULT 'yes';--> statement-breakpoint
ALTER TABLE "checklist_response" ADD COLUMN "compliant_answer" text;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD COLUMN "na_column" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD COLUMN "remarks_label" text DEFAULT 'Remarks' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD COLUMN "header_fields" text DEFAULT '["date","inspector","area"]' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD COLUMN "signatories" text DEFAULT '[]' NOT NULL;
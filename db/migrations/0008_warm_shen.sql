CREATE TABLE "checklist_inspection" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"template_id" text NOT NULL,
	"inspection_date" text,
	"inspector" text,
	"area" text,
	"ai_state" text DEFAULT 'pending' NOT NULL,
	"ai_note" text,
	"reviewed_by" text,
	"reviewed_at" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"seq" integer NOT NULL,
	"text" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_response" (
	"id" text PRIMARY KEY NOT NULL,
	"inspection_id" text NOT NULL,
	"item_id" text,
	"item_no" text NOT NULL,
	"section_no" text NOT NULL,
	"section_heading" text NOT NULL,
	"item_text" text NOT NULL,
	"ai_answer" text,
	"ai_quote" text,
	"answer" text,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "checklist_section" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"seq" integer NOT NULL,
	"heading" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_credit_id" text,
	"credit_title" text NOT NULL,
	"title" text NOT NULL,
	"confirmation" text NOT NULL,
	"plan_document" text,
	"sheet_document" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_inspection" ADD CONSTRAINT "checklist_inspection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_inspection" ADD CONSTRAINT "checklist_inspection_template_id_checklist_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_inspection" ADD CONSTRAINT "checklist_inspection_reviewed_by_app_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_section_id_checklist_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."checklist_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_response" ADD CONSTRAINT "checklist_response_inspection_id_checklist_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."checklist_inspection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_response" ADD CONSTRAINT "checklist_response_item_id_checklist_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."checklist_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_section" ADD CONSTRAINT "checklist_section_template_id_checklist_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template" ADD CONSTRAINT "checklist_template_project_credit_id_project_credit_id_fk" FOREIGN KEY ("project_credit_id") REFERENCES "public"."project_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_response_inspection_idx" ON "checklist_response" USING btree ("inspection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_template_project_credit_uq" ON "checklist_template" USING btree ("project_credit_id") WHERE "checklist_template"."project_credit_id" is not null;
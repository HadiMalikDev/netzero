CREATE TABLE "catalog_credit" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"rs_version_id" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"category_code" text NOT NULL,
	"category_name" text NOT NULL,
	"is_keystone" boolean DEFAULT false NOT NULL,
	"points_raw" text,
	"aim" text,
	"review_note" text,
	"references" text,
	"applicability" text,
	"supporting_guidance" text,
	"tool_ref" text,
	"reconciliation" text,
	"source_page_start" integer,
	"source_page_end" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_requirement" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"catalog_credit_id" text NOT NULL,
	"seq" integer NOT NULL,
	"title" text,
	"text" text NOT NULL,
	"metric_type" text NOT NULL,
	"unit" text,
	"points_raw" text,
	"points_type" text,
	"option_group" text,
	"keystone" boolean DEFAULT false NOT NULL,
	"keystone_condition" text,
	"numeric_spec" text,
	"evidence" text,
	"evidence_specs" text,
	"source_page_start" integer,
	"source_page_end" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_doc" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"requirement_entry_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parsed_credit" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source_document_id" text NOT NULL,
	"scheme" text NOT NULL,
	"stage" text NOT NULL,
	"code" text NOT NULL,
	"category_code" text NOT NULL,
	"category_name" text NOT NULL,
	"title" text NOT NULL,
	"is_keystone" boolean DEFAULT false NOT NULL,
	"points_raw" text,
	"aim" text,
	"references" text,
	"applicability" text,
	"supporting_guidance" text,
	"tool_ref" text,
	"reconciliation" text,
	"page_start" integer,
	"page_end" integer,
	"promoted" boolean DEFAULT false NOT NULL,
	"dropped" boolean DEFAULT false NOT NULL,
	"ai_proposal" text,
	"ai_status" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parsed_requirement" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"parsed_credit_id" text NOT NULL,
	"seq" integer NOT NULL,
	"title" text,
	"text" text NOT NULL,
	"metric_type" text NOT NULL,
	"unit" text,
	"points_raw" text,
	"points_type" text,
	"option_group" text,
	"keystone" boolean DEFAULT false NOT NULL,
	"keystone_condition" text,
	"numeric_spec" text,
	"evidence" text,
	"evidence_specs" text,
	"page_start" integer,
	"page_end" integer,
	"origin" text DEFAULT 'deterministic' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_credit" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"catalog_credit_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"rs_version_id" text,
	"name" text NOT NULL,
	"type" text,
	"location" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_system" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"authority" text,
	"country" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_credit_id" text NOT NULL,
	"catalog_requirement_id" text NOT NULL,
	"value_bool" boolean,
	"value_number" double precision,
	"value_text" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"note" text,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rs_version" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"rating_system_id" text NOT NULL,
	"scheme" text NOT NULL,
	"stage" text NOT NULL,
	"version_label" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_document_id" text,
	"scope_totals" text,
	"notes" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_document" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"rs_version_id" text,
	"project_id" text,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error" text,
	"page_count" integer,
	"scheme" text,
	"stage" text,
	"raw_text" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_credit" ADD CONSTRAINT "catalog_credit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_credit" ADD CONSTRAINT "catalog_credit_rs_version_id_rs_version_id_fk" FOREIGN KEY ("rs_version_id") REFERENCES "public"."rs_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_requirement" ADD CONSTRAINT "catalog_requirement_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_requirement" ADD CONSTRAINT "catalog_requirement_catalog_credit_id_catalog_credit_id_fk" FOREIGN KEY ("catalog_credit_id") REFERENCES "public"."catalog_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD CONSTRAINT "evidence_doc_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD CONSTRAINT "evidence_doc_requirement_entry_id_requirement_entry_id_fk" FOREIGN KEY ("requirement_entry_id") REFERENCES "public"."requirement_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_credit" ADD CONSTRAINT "parsed_credit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_credit" ADD CONSTRAINT "parsed_credit_source_document_id_source_document_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_requirement" ADD CONSTRAINT "parsed_requirement_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_requirement" ADD CONSTRAINT "parsed_requirement_parsed_credit_id_parsed_credit_id_fk" FOREIGN KEY ("parsed_credit_id") REFERENCES "public"."parsed_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_credit" ADD CONSTRAINT "project_credit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_credit" ADD CONSTRAINT "project_credit_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_credit" ADD CONSTRAINT "project_credit_catalog_credit_id_catalog_credit_id_fk" FOREIGN KEY ("catalog_credit_id") REFERENCES "public"."catalog_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_rs_version_id_rs_version_id_fk" FOREIGN KEY ("rs_version_id") REFERENCES "public"."rs_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_system" ADD CONSTRAINT "rating_system_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_entry" ADD CONSTRAINT "requirement_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_entry" ADD CONSTRAINT "requirement_entry_project_credit_id_project_credit_id_fk" FOREIGN KEY ("project_credit_id") REFERENCES "public"."project_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_entry" ADD CONSTRAINT "requirement_entry_catalog_requirement_id_catalog_requirement_id_fk" FOREIGN KEY ("catalog_requirement_id") REFERENCES "public"."catalog_requirement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rs_version" ADD CONSTRAINT "rs_version_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rs_version" ADD CONSTRAINT "rs_version_rating_system_id_rating_system_id_fk" FOREIGN KEY ("rating_system_id") REFERENCES "public"."rating_system"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_document" ADD CONSTRAINT "source_document_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_credit_unique" ON "catalog_credit" USING btree ("rs_version_id","code");--> statement-breakpoint
CREATE INDEX "parsed_credit_doc_idx" ON "parsed_credit" USING btree ("source_document_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "project_credit_unique" ON "project_credit" USING btree ("project_id","catalog_credit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rs_version_unique" ON "rs_version" USING btree ("rating_system_id","scheme","stage","version_label");
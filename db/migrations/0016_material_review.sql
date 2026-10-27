CREATE TABLE "material_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"row_id" text,
	"section_id" text,
	"section_heading" text NOT NULL,
	"section_kind" text NOT NULL,
	"section_seq" integer NOT NULL,
	"seq" integer NOT NULL,
	"text" text NOT NULL,
	"leed_ref" text,
	"credit_code" text,
	"project_credit_id" text,
	"kind" text NOT NULL,
	"note" text,
	"target_text" text,
	"answer" text,
	"value" text,
	"unit" text,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "material_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"delivered_on" text NOT NULL,
	"po_number" text,
	"weight_t" double precision,
	"volume_m3" double precision,
	"cost_sar" double precision,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_doc" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"answer_id" text,
	"slot" text,
	"evidence_doc_id" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_product_part" (
	"product_id" text NOT NULL,
	"part" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_product_type" (
	"product_id" text NOT NULL,
	"section_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_product" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"submittal_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"previous_revision_id" text,
	"name" text NOT NULL,
	"location_of_use" text,
	"interior" boolean DEFAULT true NOT NULL,
	"manufacturer" text,
	"supplier" text,
	"country_of_origin" text,
	"contact_name" text,
	"contact_mobile" text,
	"status" text,
	"reviewed_on" text,
	"reviewer" text,
	"applicable" boolean,
	"remarks" text,
	"manufacturer_signatory" text,
	"manufacturer_signed_on" text,
	"contractor_signatory" text,
	"contractor_signed_on" text,
	"boq_weight_t" double precision,
	"boq_volume_m3" double precision,
	"boq_cost_sar" double precision,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_submittal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"discipline" text,
	"supplier" text,
	"submitted_on" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smq_row" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"seq" integer NOT NULL,
	"text" text NOT NULL,
	"leed_ref" text,
	"credit_code" text,
	"project_credit_id" text,
	"kind" text DEFAULT 'fixed' NOT NULL,
	"note" text,
	"target_text" text,
	"value_unit" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smq_section" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text DEFAULT 'material_type' NOT NULL,
	"heading" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"default_parts" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smq_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"revision" text,
	"expiry_years" integer DEFAULT 3 NOT NULL,
	"boq_material_cost_sar" double precision,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"updated_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_doc" ALTER COLUMN "project_credit_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD COLUMN "material_product_id" text;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD COLUMN "issued_on" text;--> statement-breakpoint
ALTER TABLE "material_answer" ADD CONSTRAINT "material_answer_product_id_material_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."material_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_answer" ADD CONSTRAINT "material_answer_row_id_smq_row_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."smq_row"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_answer" ADD CONSTRAINT "material_answer_section_id_smq_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."smq_section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_answer" ADD CONSTRAINT "material_answer_project_credit_id_project_credit_id_fk" FOREIGN KEY ("project_credit_id") REFERENCES "public"."project_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_delivery" ADD CONSTRAINT "material_delivery_product_id_material_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."material_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_doc" ADD CONSTRAINT "material_doc_product_id_material_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."material_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_doc" ADD CONSTRAINT "material_doc_answer_id_material_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."material_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_doc" ADD CONSTRAINT "material_doc_evidence_doc_id_evidence_doc_id_fk" FOREIGN KEY ("evidence_doc_id") REFERENCES "public"."evidence_doc"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_product_part" ADD CONSTRAINT "material_product_part_product_id_material_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."material_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_product_type" ADD CONSTRAINT "material_product_type_product_id_material_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."material_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_product_type" ADD CONSTRAINT "material_product_type_section_id_smq_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."smq_section"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_product" ADD CONSTRAINT "material_product_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_product" ADD CONSTRAINT "material_product_submittal_id_material_submittal_id_fk" FOREIGN KEY ("submittal_id") REFERENCES "public"."material_submittal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_product" ADD CONSTRAINT "material_product_previous_revision_id_material_product_id_fk" FOREIGN KEY ("previous_revision_id") REFERENCES "public"."material_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_submittal" ADD CONSTRAINT "material_submittal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_submittal" ADD CONSTRAINT "material_submittal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smq_row" ADD CONSTRAINT "smq_row_section_id_smq_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."smq_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smq_row" ADD CONSTRAINT "smq_row_project_credit_id_project_credit_id_fk" FOREIGN KEY ("project_credit_id") REFERENCES "public"."project_credit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smq_section" ADD CONSTRAINT "smq_section_template_id_smq_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."smq_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smq_template" ADD CONSTRAINT "smq_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smq_template" ADD CONSTRAINT "smq_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_answer_product_idx" ON "material_answer" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_answer_product_row_uq" ON "material_answer" USING btree ("product_id","row_id");--> statement-breakpoint
CREATE INDEX "material_delivery_product_idx" ON "material_delivery" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "material_doc_product_idx" ON "material_doc" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_product_part_uq" ON "material_product_part" USING btree ("product_id","part");--> statement-breakpoint
CREATE UNIQUE INDEX "material_product_type_uq" ON "material_product_type" USING btree ("product_id","section_id");--> statement-breakpoint
CREATE INDEX "material_product_submittal_idx" ON "material_product" USING btree ("submittal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "smq_template_project_uq" ON "smq_template" USING btree ("project_id") WHERE "smq_template"."project_id" is not null;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD CONSTRAINT "evidence_doc_material_product_id_material_product_id_fk" FOREIGN KEY ("material_product_id") REFERENCES "public"."material_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_doc" ADD CONSTRAINT "evidence_doc_one_owner" CHECK (("evidence_doc"."project_credit_id" is null) <> ("evidence_doc"."material_product_id" is null));
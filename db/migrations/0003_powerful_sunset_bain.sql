CREATE TABLE "evidence_review" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"evidence_doc_id" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"verdict" text,
	"summary" text,
	"quotes" text,
	"gaps" text,
	"model" text,
	"error" text,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL,
	"completed_at" integer,
	CONSTRAINT "evidence_review_evidence_doc_id_unique" UNIQUE("evidence_doc_id")
);
--> statement-breakpoint
ALTER TABLE "evidence_review" ADD CONSTRAINT "evidence_review_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_review" ADD CONSTRAINT "evidence_review_evidence_doc_id_evidence_doc_id_fk" FOREIGN KEY ("evidence_doc_id") REFERENCES "public"."evidence_doc"("id") ON DELETE no action ON UPDATE no action;
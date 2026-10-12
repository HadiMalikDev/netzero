CREATE TABLE "checklist_response_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"response_id" text NOT NULL,
	"evidence_doc_id" text NOT NULL,
	"created_at" integer DEFAULT (extract(epoch from now())::integer) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_response_photo" ADD CONSTRAINT "checklist_response_photo_response_id_checklist_response_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."checklist_response"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_response_photo" ADD CONSTRAINT "checklist_response_photo_evidence_doc_id_evidence_doc_id_fk" FOREIGN KEY ("evidence_doc_id") REFERENCES "public"."evidence_doc"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_response_photo_response_idx" ON "checklist_response_photo" USING btree ("response_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_response_photo_doc_uq" ON "checklist_response_photo" USING btree ("evidence_doc_id");
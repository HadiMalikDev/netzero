-- Sprint 2 item 3: the ESC (Erosion & Sedimentation Control) inspection form as
-- the workspace default for any credit titled "Construction Environmental
-- Management" (SS-03 in Commercial D+C). Items transcribed word for word from the
-- Jeddah contractor's form MBL-JCD-ESC-001 (received 2026-10-08), with the
-- answer that means compliant per item. Laid out as their form: NA column, a
-- Notes/Comments/Non-Conformances column, Ref No / Date / Time / Inspected by,
-- and two "Checked & verified by" sign-offs. Idempotent; skipped when the solo
-- workspace does not exist.
INSERT INTO "checklist_template" ("id", "workspace_id", "project_credit_id", "credit_title", "title", "confirmation", "plan_document", "sheet_document", "na_column", "remarks_label", "header_fields", "signatories")
SELECT 'tpl_default_esc', w."id", NULL, 'Construction Environmental Management', 'Erosion & Sedimentation Control Inspection and Corrective Action Log', '', 'CEMP developed', 'Site audit report', true, 'Notes/Comments/Non-Conformances', '["ref_no", "date", "time", "inspector"]', '["Sustainability Manager", "Environmental Manager"]'
FROM "workspace" w WHERE w."id" = 'ws_default'
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "checklist_section" ("id", "template_id", "seq", "heading")
SELECT v.* FROM (VALUES
('tpl_default_esc_s1', 'tpl_default_esc', 1, 'Dust control and soil erosion by wind'),
('tpl_default_esc_s2', 'tpl_default_esc', 2, 'Stormwater control measures'),
('tpl_default_esc_s3', 'tpl_default_esc', 3, 'Dewatering water'),
('tpl_default_esc_s4', 'tpl_default_esc', 4, 'Housekeeping')
) AS v("id", "template_id", "seq", "heading")
WHERE EXISTS (SELECT 1 FROM "checklist_template" WHERE "id" = 'tpl_default_esc')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "checklist_item" ("id", "section_id", "seq", "text", "active", "compliant_answer")
SELECT v."id", v."section_id", v."seq"::integer, v."text", v."active"::boolean, v."compliant_answer"::text FROM (VALUES
('tpl_default_esc_s1_i1', 'tpl_default_esc_s1', 1, 'Are soil stockpiles adequately covered or stabilized', true, 'yes'),
('tpl_default_esc_s1_i2', 'tpl_default_esc_s1', 2, 'Are hauling loads are covered with a screen or moistened during transfer', true, 'yes'),
('tpl_default_esc_s1_i3', 'tpl_default_esc_s1', 3, 'Is housekeeping on the hauling roads is regular and adequate?', true, 'yes'),
('tpl_default_esc_s1_i4', 'tpl_default_esc_s1', 4, 'Is perimeter fencing effective in reducing wind speed causing soil erosion?', true, 'yes'),
('tpl_default_esc_s1_i5', 'tpl_default_esc_s1', 5, 'Is there any damage in perimeter fencing?', true, 'no'),
('tpl_default_esc_s1_i6', 'tpl_default_esc_s1', 6, 'Is there a dust problem prevailing on the construction site', true, 'no'),
('tpl_default_esc_s2_i1', 'tpl_default_esc_s2', 1, 'Is there any incidence of rain in the last 24 hours?', true, NULL),
('tpl_default_esc_s2_i2', 'tpl_default_esc_s2', 2, 'Do you have storm water-control measures in place?', true, 'yes'),
('tpl_default_esc_s2_i3', 'tpl_default_esc_s2', 3, 'Do you have earth bund around the site for the diversion of stormwater entering to your site from the surrounding area?', true, 'yes'),
('tpl_default_esc_s2_i4', 'tpl_default_esc_s2', 4, 'Is it effective during rain?', true, 'yes'),
('tpl_default_esc_s2_i5', 'tpl_default_esc_s2', 5, 'Do you have provision for sedimentation control?', true, 'yes'),
('tpl_default_esc_s2_i6', 'tpl_default_esc_s2', 6, 'Is the stormwater discharge point is protected from siltation?', true, 'yes'),
('tpl_default_esc_s2_i7', 'tpl_default_esc_s2', 7, 'Is there any sedimentation basin for settling storm water prior to discharge into storm waterline?', true, 'yes'),
('tpl_default_esc_s2_i8', 'tpl_default_esc_s2', 8, 'Is there use of silt screen (Geo-textile) in storm water channel inside the site?', true, 'yes'),
('tpl_default_esc_s2_i9', 'tpl_default_esc_s2', 9, 'Is there any damage to silt curtain?', true, 'no'),
('tpl_default_esc_s2_i10', 'tpl_default_esc_s2', 10, 'Do you allow settling of sediments within the project area?', true, NULL),
('tpl_default_esc_s2_i11', 'tpl_default_esc_s2', 11, 'Is it changed regularly in the event of clogging after a rain incidence?', true, 'yes'),
('tpl_default_esc_s3_i1', 'tpl_default_esc_s3', 1, 'Do you have provision for dewatering water to control sedimentation.', true, 'yes'),
('tpl_default_esc_s3_i2', 'tpl_default_esc_s3', 2, 'Is there sedimentation tank for settling of groundwater prior to disposal?', true, 'yes'),
('tpl_default_esc_s3_i3', 'tpl_default_esc_s3', 3, 'Do you have any other measures to control sedimentation and erosion from dewatering water?', true, 'yes'),
('tpl_default_esc_s3_i4', 'tpl_default_esc_s3', 4, 'Do you allow infiltration of dewatering water?', true, NULL),
('tpl_default_esc_s4_i1', 'tpl_default_esc_s4', 1, 'Is the project area being tidy and clean?', true, 'yes'),
('tpl_default_esc_s4_i2', 'tpl_default_esc_s4', 2, 'Is proper storage and stacking of material at the staging area?', true, 'yes'),
('tpl_default_esc_s4_i3', 'tpl_default_esc_s4', 3, 'Is waste properly collected and disposed of in a timely manner?', true, 'yes'),
('tpl_default_esc_s4_i4', 'tpl_default_esc_s4', 4, 'Is there safekeeping of hazardous material?', true, 'yes'),
('tpl_default_esc_s4_i5', 'tpl_default_esc_s4', 5, 'Is there any spill or leak at site?', true, 'no'),
('tpl_default_esc_s4_i6', 'tpl_default_esc_s4', 6, 'Is the concrete washout area being in order and regular maintenance is there?', true, 'yes'),
('tpl_default_esc_s4_i7', 'tpl_default_esc_s4', 7, 'Is there any vehicular maintenance at the site?', true, 'no')
) AS v("id", "section_id", "seq", "text", "active", "compliant_answer")
WHERE EXISTS (SELECT 1 FROM "checklist_template" WHERE "id" = 'tpl_default_esc')
ON CONFLICT ("id") DO NOTHING;

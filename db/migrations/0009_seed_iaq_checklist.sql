-- Sprint 2 item 3: the IAQ inspection form as the workspace default for any
-- credit titled "Indoor Air Quality" (HC-10 in Commercial D+C). Items are the
-- Jeddah contractor's own form (received 2026-10-07) plus Moisture & Mold
-- Control, which Mostadam HC-10 requires. Projects copy it on first use.
-- Idempotent: fixed ids, ON CONFLICT DO NOTHING; skipped when the solo
-- workspace does not exist.
INSERT INTO "checklist_template" ("id", "workspace_id", "project_credit_id", "credit_title", "title", "confirmation", "plan_document", "sheet_document")
SELECT 'tpl_default_iaq', w."id", NULL, 'Indoor Air Quality', 'Construction Indoor Air Quality Inspection', 'I confirm the checked activities to be proceeding according to the construction Indoor Air Quality Management Plan. Items that are not checked will be addressed, initialled and dated once corrective actions have been taken. Items that are not applicable are labelled as such.', 'IAQ Management Plan', 'Completed IAQ Checklist'
FROM "workspace" w WHERE w."id" = 'ws_default'
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "checklist_section" ("id", "template_id", "seq", "heading")
SELECT v.* FROM (VALUES
('tpl_default_iaq_s1', 'tpl_default_iaq', 1, 'HVAC Protection'),
('tpl_default_iaq_s2', 'tpl_default_iaq', 2, 'Source Control'),
('tpl_default_iaq_s3', 'tpl_default_iaq', 3, 'Pathway Interruption'),
('tpl_default_iaq_s4', 'tpl_default_iaq', 4, 'Housekeeping'),
('tpl_default_iaq_s5', 'tpl_default_iaq', 5, 'Scheduling and Construction Activity Sequence'),
('tpl_default_iaq_s6', 'tpl_default_iaq', 6, 'Moisture & Mold Control')
) AS v("id", "template_id", "seq", "heading")
WHERE EXISTS (SELECT 1 FROM "checklist_template" WHERE "id" = 'tpl_default_iaq')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "checklist_item" ("id", "section_id", "seq", "text", "active")
SELECT v.* FROM (VALUES
('tpl_default_iaq_s1_i1', 'tpl_default_iaq_s1', 1, 'Filters at supply air intake', true),
('tpl_default_iaq_s1_i2', 'tpl_default_iaq_s1', 2, 'Filters at return air openings', true),
('tpl_default_iaq_s1_i3', 'tpl_default_iaq_s1', 3, 'Seal supply diffusers and return air during demolition', true),
('tpl_default_iaq_s1_i4', 'tpl_default_iaq_s1', 4, 'Seal supply diffusers and return air openings during construction', true),
('tpl_default_iaq_s1_i5', 'tpl_default_iaq_s1', 5, 'Mechanical rooms clean and neat', true),
('tpl_default_iaq_s1_i6', 'tpl_default_iaq_s1', 6, 'Periodic duct inspections during construction', true),
('tpl_default_iaq_s1_i7', 'tpl_default_iaq_s1', 7, 'Contractor to document with photographs', true),
('tpl_default_iaq_s2_i1', 'tpl_default_iaq_s2', 1, 'Low/no VOC products as indicated by specifications', true),
('tpl_default_iaq_s2_i2', 'tpl_default_iaq_s2', 2, 'Restrict vehicle traffic volume and prohibit idling', true),
('tpl_default_iaq_s2_i3', 'tpl_default_iaq_s2', 3, 'Cycle equipment off, when not being used or needed', true),
('tpl_default_iaq_s2_i4', 'tpl_default_iaq_s2', 4, 'Exhaust pollution sources to the outside', true),
('tpl_default_iaq_s2_i5', 'tpl_default_iaq_s2', 5, 'Keep containers of wet products closed', true),
('tpl_default_iaq_s2_i6', 'tpl_default_iaq_s2', 6, 'Cover or seal containers of waste materials', true),
('tpl_default_iaq_s2_i7', 'tpl_default_iaq_s2', 7, 'Protect absorptive building materials from weather and moisture', true),
('tpl_default_iaq_s2_i8', 'tpl_default_iaq_s2', 8, 'Contractor to document with photographs', true),
('tpl_default_iaq_s3_i1', 'tpl_default_iaq_s3', 1, 'Provide duct containers or temporary enclosures', true),
('tpl_default_iaq_s3_i2', 'tpl_default_iaq_s3', 2, 'Locate pollutant sources as far as possible from supply ducts and areas occupied by workers', true),
('tpl_default_iaq_s3_i3', 'tpl_default_iaq_s3', 3, 'Isolate areas of work to prevent contamination of clean or occupied areas', true),
('tpl_default_iaq_s3_i4', 'tpl_default_iaq_s3', 4, 'When using VOC emitting materials ventilate using 100% outside air', true),
('tpl_default_iaq_s3_i5', 'tpl_default_iaq_s3', 5, 'General contractor to document with photographs', true),
('tpl_default_iaq_s4_i1', 'tpl_default_iaq_s4', 1, 'Provide regular cleaning, including HVAC equipment', true),
('tpl_default_iaq_s4_i2', 'tpl_default_iaq_s4', 2, 'If necessary clean HVAC equipment prior testing, adjusting and balancing the system', true),
('tpl_default_iaq_s4_i3', 'tpl_default_iaq_s4', 3, 'Suppress and minimize dust with wetting agents or sweeping compounds', true),
('tpl_default_iaq_s4_i4', 'tpl_default_iaq_s4', 4, 'Remove accumulations of water inside the building', true),
('tpl_default_iaq_s4_i5', 'tpl_default_iaq_s4', 5, 'Protect porous materials', true),
('tpl_default_iaq_s4_i6', 'tpl_default_iaq_s4', 6, 'General contractor to document with photographs', true),
('tpl_default_iaq_s5_i1', 'tpl_default_iaq_s5', 1, 'Scheduling pollution activities prior to installing absorbent materials', true),
('tpl_default_iaq_s5_i2', 'tpl_default_iaq_s5', 2, 'Coordinate construction activities to minimize or eliminate disruption of operations in the occupied portions of the building', true),
('tpl_default_iaq_s6_i1', 'tpl_default_iaq_s6', 1, 'Store absorptive materials off the floor, under cover and away from wet work', true),
('tpl_default_iaq_s6_i2', 'tpl_default_iaq_s6', 2, 'Remove standing water and dry wetted areas promptly', true),
('tpl_default_iaq_s6_i3', 'tpl_default_iaq_s6', 3, 'Replace absorptive materials that have been wet and show staining or mould', true),
('tpl_default_iaq_s6_i4', 'tpl_default_iaq_s6', 4, 'Contractor to document with photographs', true)
) AS v("id", "section_id", "seq", "text", "active")
WHERE EXISTS (SELECT 1 FROM "checklist_template" WHERE "id" = 'tpl_default_iaq')
ON CONFLICT ("id") DO NOTHING;

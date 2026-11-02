-- Client review Rev 01 (D49): the SMQ's two parts are "General requirements"
-- (every product) and "Material-specific requirements" (the material types).
-- Renames the default's block, each project copy's, and the wording already
-- copied into answers. A block a project renamed itself is left as it is.
UPDATE "smq_section" SET "heading" = 'General requirements'
WHERE "kind" = 'all_materials' AND "heading" = 'For all materials';
--> statement-breakpoint
UPDATE "material_answer" SET "section_heading" = 'General requirements'
WHERE "section_kind" = 'all_materials' AND "section_heading" = 'For all materials';

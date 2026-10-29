# 03 — Editor UX: read first, edit on demand

Raised: 2026-10-29 (after item 01 merged) · Branch: `main` (by request: "Do direct on main")

## The requests

1. > the way of showing saved and edit states are just odd. Why not show read-only input fields
   > that swap to editable ones once a user clicks edit, along with more visible action buttons.
   > Also don't hide the values behind "Edit". makes it hard from a UX perspective to glance at
   > requirements. Also its a bit unintuitive to open the collapsed accordion and see all these
   > values all at once, and not be behind an edit function. redesign to be more breathable.
2. > [Switch off] use a more industry standard
3. > Credit type is also a bit ambiguous on the material questionnaire … the block name is also
   > bit odd … there should be one input field and a user should enter the name as they enter the
   > name they should see like different options they can click those options and those options
   > show up as tags and they can then cut and add those. Like right now, I don't want to give
   > them a predefined list.

## Decisions

### D42 — What replaces "Switch off" (2026-10-29)
- Options offered:
  - (a) Archive / Restore, archived items collapsed into an "N archived" group at the end of
    each section (Stripe-style).
  - (b) **An "Active" toggle switch** on each row and material type; inactive items stay in
    place, greyed, with an "Inactive" tag.
  - (c) Archive / Restore, kept in place with an "Archived" tag.
- **Answer: (b) Active toggle switch.**

### D43 — A product's material type that is later made inactive (2026-10-29)
- Options offered:
  - (a) Keep it on the product until someone unticks it.
  - (b) **Drop it when the product's material types are saved again**, as now; its answers are
    kept hidden and come back if the type is made active and picked again.
- **Answer: (b) Drop it, as now.**

## Choices I made (flagged — say if any is wrong)

1. Saved values show as labelled text, not disabled inputs: disabled inputs looked like a form
   you can't use and were as crowded as the edit state, which the third message of request 1
   asked to avoid. Edit swaps one block to inputs with Save and Cancel.
2. A row shows only the details that are set (target, unit, LEED reference, note); a
   project-value row without a target says "Not set yet".
3. The same pattern is used on the submittal page, "New submittal", and the product's
   information, material types, credit parts, BOQ quantities and review. The product's
   questionnaire answers stay always editable: they are the data entry itself.
4. An unreviewed product opens with its review form ready; an old revision shows no Edit.
5. The inspections (IAQ/ESC) form editor keeps "Switch off" for now; it is a different editor.
6. Request 3: the credit parts a type counts toward are calculated in code (MW-05 steel, HC-11
   VOC …), so a typed name that matches none of them would count toward nothing. "No predefined
   list" is read as: don't show every option up front; typing shows the matching parts, and only
   those can be added.

## Done

- `3d3fe13` feat(materials): saved values read as text, Edit opens the inputs
  - Evidence: `evidence/ux-1-view.png` (resting state), `evidence/ux-2-row-edit.png` (one row
    in edit), `evidence/ux-8-product-top.png` (product page).
- D42: the Active switch — `evidence/sw-1-row-inactive.png` (inactive rows greyed and tagged).
  Checked in a browser: the switch flips at once, saves, shows "Inactive", and switches back,
  on a row and on a material type.
- `5feef2c` feat(materials): an Active switch replaces Switch off (D42)
- Request 3: the credit calculations a section, material type or product is counted in are
  picked as tags from one input. Nothing is listed until something is typed; typing "hc", "ksa"
  or "steel" shows the matching calculations, click or Enter adds a tag, × or Backspace removes
  one, and the list closes when the input loses focus. Labels: "Block name" → "Section name" /
  "Material type name"; "Every product counts toward" → "Every product is counted in", with a
  line saying what that means. The product page's "Counts toward" uses the same picker.
  - Evidence: `evidence/tag-1-suggest.png`, `evidence/tag-2-tags.png`,
    `evidence/tag-4-all-edit.png`.
  - Checked in a browser: suggestions, add by click and by Enter, "no match", remove, save
    (persisted, then restored), Cancel, and blur closing the list on the product page.
  - `pnpm test` 212 passed; `pnpm test:db` 262 passed; lint 0 errors; build passes.

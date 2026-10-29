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

4. > Instead of [the up and down arrows] can we have … two dots horizontally, three dots
   > vertically … drag and drop these … Is it just immediate or is there a button we need to
   > click? Also … "add a row under …", just call it add a row and … when I'm scrolling down past
   > for all materials, I want for all materials to stick to the top. … do these in separate
   > commits … and then push on main.

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
7. Request 4: a drop saves at once, with no Save button, as in Notion, Linear and Trello. A
   refused drop (the list changed in another tab) puts the list back, says so, and reloads.
   Dragging works from the keyboard too: focus the grip, Space, arrow keys, Space.
8. Request 4: drag and drop uses `@dnd-kit` (core 6.3.1, sortable 10.0.0, utilities 3.2.2), the
   usual React library for sortable lists; native HTML drag and drop has no touch or keyboard
   support.

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
- Request 4, three commits:
  - "Add a row": the button no longer repeats the section's name.
  - Sticky headers: a section's header stays at the top of the page while its rows scroll past,
    and leaves with the section (`evidence/st-1-sticky.png`).
  - Drag and drop: a ⋮⋮ grip on each row and on each material type's header replaces ↑ ↓.
    Checked in a browser: a dragged row and a dragged material type are saved in the dropped
    order (read back from the database), the page keeps its scroll, the keyboard moves a row,
    and clicking a type's grip doesn't open or close it (`evidence/dnd-2-types.png`,
    `evidence/dnd-3-dragging.png`). DB test: a stale or partial order is refused and changes
    nothing; "For all materials" stays first.
  - `pnpm test` 212 passed; `pnpm test:db` 263 passed; lint 0 errors; build passes.

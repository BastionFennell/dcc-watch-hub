# Feature 008: Real crawlers - sheets and renders

**Branch**: `008-real-crawlers` (on top of `007-npc-registry`) · **Created**: 2026-09-18

Author: "I've added character sheets and our first two fully rendered characters to
/character-portraits and /character-sheets, lets update the page to match the files."

## Scope
- Replace the invented five-crawler sample party with the show's real crawlers from the four
  filled sheets: **Harry**, **Mimi Rivers**, **Ronald "Madio" Hudson**, **Xavier "XO" Ortiz**.
  Ids: `harry`, `mimi`, `ronald`, `xo`.
- Initial state per crawler from the sheets: name, handle (the crawler-facing name/nickname),
  player (if on the sheet), race, pronouns, crawler number, class, level, HP max (current = max
  at episode start unless the sheet says otherwise), stats (STR INT CON DEX CHA - enhanced value
  when both are given), starting Hotlist, skills (name + rank), inventory items, gear slots.
  Anything the sheet leaves blank is omitted (optional fields) - never invented.
- Art: Mimi and Ronald get full-figure `art` (optimized web copy) and a bust `portrait` cropped
  from the render; Harry and XO keep generated placeholder busts and no `art` until renders exist.
- Sample episodes keep their event shape but actors are remapped to the real ids
  (`stuntman → ronald`, `psychic → mimi`, `actress → mimi` or dropped where a duplicate would be
  nonsensical); every sample test stays green (counts may change; update the tests' expectations
  where they encode the old five-crawler party).
- Source material (`/character-sheets`, `/character-portraits`) stays out of git; the README
  placeholder list is updated (two real renders in, two still placeholders).

## Not in scope
Fixtures used by unit/page tests keep their own invented party; no engine or UI changes beyond
what real data exposes (e.g. a longer skills list or empty optional fields).

## Acceptance
- The party rail shows Harry, Mimi Rivers, Ronald Hudson, XO with the right levels/HP at t=0.
- Opening Mimi's or Ronald's record shows the render in the art column; their bust is the crop.
- The dossier/glance stats, hotlist, skills, inventory, and gear match the sheets.
- `npm test` green; Lighthouse performance stays ≥ 90 (images optimized: art ≤ 250 kB, bust ≤ 40 kB).

---

# Revision 2 (2026-09-18) - short hotbar names, quantities, tooltips, spells, art fit

Author: "Make the hotlist just say Heal and Standard Mana Potion, add a box in the corner for
quantity for the mana potions. On hover or click it should show a tooltip with the full item,
skill, spell description. Add a spells section similar to skills with the full description of the
heal spell. Adjust the size of the image for Mimi so it fits better."

## Scope
- **Entries with structure** (backward compatible with plain strings everywhere):
  `HotlistEntry | string` where `HotlistEntry = { name; qty?; desc? }`; `InventoryEntry | string`
  = `{ name; qty?; desc? }`; `SkillEntry` gains `desc?`; new `SpellEntry = { name; rank?; mana?; desc? }`
  with `Crawler.spells?: SpellEntry[]` and a `spell` event `{ actor, name, rank?, mana?, desc? }`
  (upsert by name, like `skill`). Reducer/selectors/converter/schema/samples/fixtures updated;
  strings keep working (normalized to `{ name }` in state).
- **Hotbar**: slot shows the short `name`; a small quantity box in the slot's top-right corner
  when `qty > 1` ("x5"); the slot is a button that shows a **tooltip** with the full description
  on hover, focus, and click (click toggles; Escape closes; `role="tooltip"`, `aria-describedby`).
- **Tooltips** on skill, spell, and inventory tiles in the record (same component); entries
  without a description get no tooltip and no affordance.
- **SPELLS** section in the record and the stacked dossier between SKILLS and INVENTORY, tiles
  like skills with a mono footer "Rank N · N mana"; "View all" list view like the others; the
  glance card is unchanged.
- **Mimi's data** from her sheet: Hotlist = `Heal` (desc: the sheet's full Heal spell text, with
  mana cost and rank) and `Standard Mana Potion` (qty 5, desc from the sheet if given); Spells =
  `Heal` with rank, mana cost, and the full description. Other crawlers: unchanged unless their
  sheets list spells.
- **Art fit**: the art column no longer stretches to the viewport height; it hugs the image
  (width 100%, height auto, max-height the previous cap, still sticky), so a render with empty
  margins sits without a large blank band beneath it.

## Acceptance
- Mimi's hotbar reads "Heal" and "Standard Mana Potion" with an "x5" box; hovering or clicking
  either shows the full text; keyboard focus shows it too; Escape hides it.
- Mimi's record has a SPELLS section with Heal and its full description in the tooltip and in the
  list view.
- Old data with string entries renders exactly as before; converter rows accept `name|qty|desc`
  for hotlist/inventory (`field1 = name, field2 = qty, field3 = desc` for `inventory add`? see
  contract) without breaking existing CSVs.
- The art column height matches the image; tests and Lighthouse a11y stay green.

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

## Revision 3 (2026-09-18) - cast credits and pronoun format
- Player credits from the author: Harry - Bobby, Mimi - Lulu, Ronald - Madio, X.O. - Danny.
  A fifth crawler, **Lauren (played by Sarah)**, joins when her sheet arrives; not yet in data.
- Pronouns use the slash form ("she/her"), not the sheet's "she + her".

## Revision 4 (2026-09-18) - shared spell registry from the Crawlers book

Author: "Take all of the spells in the Crawlers book and model them out to make sure our spell
model works for all cases, then have Ronald and Mimi's heal spells point to that model instead of
each one being modeled independently."

Source: `Crawlers_Digital_Hi-Res_081226.pdf` (gitignored, copyrighted; pp. 36-41, "Spell Skills"
and the SPELLS CHART on p. 2). Every spell entry carries: Name (with parenthesised aliases), a
flavour quote, a type line (`Attack` or `Passive`, optionally `Interrupt`, a damage type, `Area of
Effect`), Mana Cost, optional Range / Duration / AI Favor / Limitations / Cooldown, a description,
optional Base Damage, and an UPGRADES block (`Rank N: text`, or `None`). The chart adds a d100 roll
range and page number.

### Model
- New registry `public/data/spells.json` (`show.json` gains `spellsUrl`, loaded like `registryUrl`):
  `{ spells: SpellDef[] }` with `SpellDef = { id (kebab), name, aliases?: string[], quote?, kind:
  'attack' | 'passive', interrupt?: boolean, damageType?: string, areaOfEffect?: boolean,
  manaCost: number, range?: string, duration?: string, aiFavor?: number, limitations?: string,
  cooldown?: string, description: string, baseDamage?: string, upgrades: { rank: number; text:
  string }[], roll?: [number, number], page?: number }`. Validated by `validateSpells` (same shape
  of failure handling as `validateRegistry`); JSON schema in `specs/008-real-crawlers/contracts/spells.schema.json`.
- Crawler spell entries and the `spell` event gain `ref?: string` (a `SpellDef.id`). A referenced
  entry inherits name, mana, and the full description from the registry; `rank` stays per crawler;
  `mana`/`desc` on the entry are explicit overrides (kept for homebrew or scroll-only spells with
  no registry row). An entry with neither `ref` nor `name` is invalid; an unknown `ref` is a
  validation warning that falls back to the entry's own fields (or the ref as the name).
- `HotlistEntry` gains the same `ref?`, so a hotlist key can point at a spell and get its name and
  tooltip from the registry.
- Resolution lives in `src/engine/spells.ts` (React-free): `resolveSpell(entry, registry) ->
  SpellView { id?, name, rank?, mana?, kind?, tags: string[], range?, duration?, aiFavor?,
  limitations?, cooldown?, description, baseDamage?, upgrades, quote? }`. Selectors take the
  registry the way they take the NPC registry today; `Dossier.spells` and `hotbarSlots` return
  resolved views.
- Tooltip body for a resolved spell: name, tag line ("Interrupt · Passive" / "Attack · Fire ·
  Area of Effect"), then "Mana N · Range … · Duration …" as present, Limitations / Cooldown lines,
  description, Base Damage, and Upgrades ("Rank 5: …"). Unresolved entries keep today's plain body.
  The spells list view shows the same fields under the name.

### Data
- `spells.json` carries every spell on the chart (Astral Paw through the end of the chapter),
  transcribed verbatim from the book. This is the "all cases" check: a samples test asserts the
  chart's names all resolve, every entry validates, and at least one spell exercises each optional
  field (aliases, interrupt, AoE, duration, aiFavor, limitations, cooldown, baseDamage, `upgrades:
  []`).
- Mimi: `spells: [{ ref: 'heal', rank: 1 }]`, hotlist `[{ ref: 'heal' }, { name: 'Standard Mana
  Potion', qty: 5, desc }]`; her inline Heal `desc` strings are removed. Ronald: his hotlist string
  "Heal Spell (Interrupt) Rank 1 (Max): Mana Cost 2, heal 2 slots" becomes `{ ref: 'heal' }` and he
  gains `spells: [{ ref: 'heal', rank: 1 }]`; the sample `spell` events use `ref: 'heal'`.
- Converter: `spell` rows accept a registry id in field1 (`ref` when it matches `^[a-z0-9-]+$` and
  `--spells` is given, else `name`); `--spells <path>` validates refs like `--registry` does.

### Non-goals
Spells are not listed in the Dungeon Codex; no random-roll UI; the book text stays in the data
file only (private repo - flag before any public release).

## Revision 5 (2026-09-18) - fifth crawler, and what stays private
- Veil Ravencrest (real name Lauren Summers, played by Sarah) joins the party from her sheet:
  human, she/they, level 1, crawler 13666, Heal + Soul Collector (registry refs), nine skills,
  inventory with the sheet's notes as descriptions. Placeholder portrait until a render arrives.
- **Never transcribed**: the sheet's Past Trauma, Loose Ends, and Regrets boxes. They are the
  player's private backstory, not System-visible data, and have no field in the model on purpose.

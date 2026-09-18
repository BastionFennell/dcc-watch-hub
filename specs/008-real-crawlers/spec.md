# Feature 008: Real crawlers — sheets and renders

**Branch**: `008-real-crawlers` (on top of `007-npc-registry`) · **Created**: 2026-09-18

Author: "I've added character sheets and our first two fully rendered characters to
/character-portraits and /character-sheets, lets update the page to match the files."

## Scope
- Replace the invented five-crawler sample party with the show's real crawlers from the four
  filled sheets: **Harry**, **Mimi Rivers**, **Ronald "Madio" Hudson**, **Xavier "XO" Ortiz**.
  Ids: `harry`, `mimi`, `ronald`, `xo`.
- Initial state per crawler from the sheets: name, handle (the crawler-facing name/nickname),
  player (if on the sheet), race, pronouns, crawler number, class, level, HP max (current = max
  at episode start unless the sheet says otherwise), stats (STR INT CON DEX CHA — enhanced value
  when both are given), starting Hotlist, skills (name + rank), inventory items, gear slots.
  Anything the sheet leaves blank is omitted (optional fields) — never invented.
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

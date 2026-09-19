# Feature 009 - Mana

Author (2026-09-18): "Add mana to all of the characters; each character has a max mana equal to
their intelligence and should have a current mana that starts equal to their max." Also: "add a
closing paren to the witchy kit" (Veil's inventory note).

## Model
- `Crawler.mana?: { current: number; max: number }`. When absent, the state derives
  `max = stats.int` and `current = max` (so existing data and fixtures gain mana with no edits).
  When present it wins verbatim (sheets can disagree with the rule; the rule is the default).
- New `mana` event `{ type: 'mana'; actor; current: number; max?: number }`, the exact shape and
  semantics of the `hp` event (set current, optionally max; clamp current to [0, max]).
- `CrawlerState.mana: { current; max }` always present (0/0 when there is no INT either).
- Glance and Dossier expose `mana`; feed label "Mana", feed text `mana(actor, current, max)`
  in the System voice, matching the `hp` line's shape.
- Converter: `mana` CSV row = field1 current, field2 max (optional), mirroring the `hp` row.
  Schema: `specs/009-mana/contracts/episode.schema.json` (copy of 008's + `mana` field and event);
  `src/data/samples.test.ts` repointed; sample episodes get a couple of `mana` events per file.

## UI
- VITALS gains a MANA row directly under HP in the glance card and the full record: label
  "MANA", a segmented strip with `max` segments in System blue (filled = current), and mono
  `current/max`. Hidden when `max` is 0. Accessible name "Mana 5 of 5". Phone layout unchanged.
- Timeline/log treat `mana` like `hp` (same colour family as the hp marker; no new legend entry
  unless hp has one).

## Data
- Sheets: Mimi INT 5 (sheet says Max Mana 5), Veil INT 6 (sheet 6/6), Harry/Ronald/XO per INT.
  Store explicit `mana` on all five in `public/data/ep{1,2,3}.json` and
  `scripts/samples/ep1.initial.json`, current = max.
- Veil's "Witchy Traveling Kit" desc gains its closing parenthesis.

## Acceptance
- Every crawler's record shows MANA n/n equal to INT; a `mana` event at t moves the strip and
  scrubbing back restores it (time-truth); unknown/negative values are rejected by validation;
  tests, Lighthouse a11y 100, axe clean.

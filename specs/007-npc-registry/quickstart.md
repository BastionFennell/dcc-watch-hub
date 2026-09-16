# Quickstart: NPC encounters + System Registry

The dev server is `http://localhost:5180` (`npm run dev`); `npm run preview` serves the
production build at `http://localhost:4173`. `?fake=1`, `?panel=` and `?record=` are **DEV-only**
flags — they exist on 5180 and are compiled out of the build 4173 serves. Every URL below was
opened and checked in Chrome 152 headless at 1440 × 900 and 400 × 800.

## Run

```sh
npm install
npm run dev            # http://localhost:5180/
```

## The episode page (US1)

| URL | What to see |
|-----|-------------|
| `http://localhost:5180/ep/1?fake=1&t=120` | before the first `npc` event (2:10): **ENCOUNTERED** under the party rail reads "No entities tagged yet." |
| `http://localhost:5180/ep/1?fake=1&t=560` | three chips, newest first — The Hoarder (boss, struck through, `DEFEATED`), Quartermaster Vel (ally, initial disc "Q"), Grull Industries Representative (vendor, portrait) |
| `http://localhost:5180/ep/1?fake=1&t=560&panel=npc:the-hoarder` | the entity record open in the rail: Boss · Floor 1, the intro, `DEFEATED`, **FACTS** with only "It nests behind the crate wall it builds…" (the `lair` fact, unlocked at 6:20), **MOMENTS** 9:00 / 6:20 / 2:10 each seek-able and shareable, and **Open in the Registry** |
| `http://localhost:5180/ep/1?fake=1&t=246` | the unfiled id: the feed says "Entity · the-listener-below enters the broadcast — Unfiled. The System has no record of this one." and the strip still has only three chips |
| `http://localhost:5180/ep/2?fake=1&t=820&panel=npc:the-hoarder` | an entity that spans episodes: four chips (signal-choir, mother-of-pipes `DEFEATED`, the-hoarder, grull-rep), and The Hoarder's record here shows only the `ledger` fact — released at 5:30 in *this* episode — and status **ACTIVE**, because overlay state is a pure function of *this* episode's log and episode 2 never kills it. The registry, which is cross-episode, still says "Defeated in episode 1." |

Drag the dev scrubber back from 560 to 120 and the record closes, the three chips go, and the
strip returns to its standby line. Drag forward again and they come back in the same order.

**Phone.** The same page at 400 × 800 (DevTools device mode) has a fifth tab, **NPCS**, after
LOG. It renders the same chips as a two-column grid; tapping one opens the record as a bottom
sheet over the stage. The tab exists only when the show has a `registryUrl`.

## The System Registry (US2)

| URL | What to see |
|-----|-------------|
| `http://localhost:5180/registry` | three sections — "Episode 1 — The World Dungeon" (3 entities), "Episode 2 — The Meat District" (2), "Episode 3 — Descent" (3) — with search and three kind chips (Boss 3, Vendor / Guide 2, Ally / Faction 3) |
| `http://localhost:5180/registry#the-hoarder` | that entry already expanded and scrolled clear of the sticky header: facts tagged `Ep 1` and `Ep 2`, four appearances linking to `/ep/1?t=130`, `/ep/1?t=380`, `/ep/1?t=540` and `/ep/2?t=330`, closing with "Defeated in episode 1." |
| search `crate king` | one entry, The Hoarder — matched on an alias, not the name |
| search `zzz` | "The Registry has no such entity." |
| kind chips Vendor + Ally | five entries across all three sections (any-of) |

The same page at 400 × 800: one column, the search full width on its own row with the three chips
beneath it, and no horizontal scroll.

## The converter

```sh
# a clean run — no id checking without --registry
npm run sheet-to-json -- scripts/samples/ep1.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/ep1.json

# with the registry: unknown entity and unknown fact become WARNings (exit 0, file still written)
npm run sheet-to-json -- scripts/samples/ep1-broken.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json \
  --registry public/data/npcs.json --out /tmp/ep1-broken.json
# WARN row 16: unknown entity "the-listener-below" (not in the registry)
# WARN row 17: unknown fact "lantern" on entity "the-hoarder"
# wrote /tmp/ep1-broken.json (19 events, 8 warnings)
```

## Manual acceptance

SC-601 sweep at npc boundaries; SC-602 registry sections/facts/appearances; SC-603 hash +
"Open in the Registry"; SC-604 gates + Lighthouse a11y 100 on both pages.

---

## Results

Measured 2026-09-16 on Node 20.9.0, Chrome 152 headless driven over CDP (puppeteer-core 22.15),
axe-core 4.13.0 with every rule enabled, and Lighthouse 11.7.1 against `npm run preview`.
Episode-page runs use the dev server because `?fake=1` is DEV-only; registry runs use the
production build.

### Gates (T717)

```
npm run typecheck   tsc --noEmit            clean
npm run lint        eslint .                clean
npm test            42 files, 787 tests     all passing  (786 before wave 3)
npm run build       vite build + postbuild  ✓ built, dist/404.html written
```

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `dist/assets/index-*.js` | 391.02 kB | **122.42 kB** |
| `dist/assets/index-*.css` | 73.93 kB | 12.59 kB |
| `dist/index.html` | 0.72 kB | 0.42 kB |

007 costs 6.1 kB gzipped of JS and 2.0 kB of CSS over the post-006 build (116.3 / 10.6), still
well inside the 150 kB gzipped budget, and adds no dependency.

### SC-601 — strip, record and feed match the log ≤ t, forward and back

Swept `/ep/1` at every `npc` boundary and the second either side of it — t = 0, 129, **130**,
164, **165**, 204, **205**, 244, **245**, 379, **380**, 539, **540**, 600 — forwards, then the
same fourteen backwards. **0 mismatches**: the chip list (ids and defeated flags), the feed's
Entity rows and the standby line were byte-identical at every t in both directions.

| t | strip (newest first) |
|---|----------------------|
| 0, 129 | — (standby: "No entities tagged yet.") |
| 130 | the-hoarder |
| 165 | grull-rep, the-hoarder |
| 205 | quartermaster-vel, grull-rep, the-hoarder |
| 245 | unchanged — `the-listener-below` is not in the registry, so it files no chip |
| 380 | the-hoarder (its update makes it newest), quartermaster-vel, grull-rep |
| 540 | the-hoarder **defeated**, quartermaster-vel, grull-rep |

The record was swept the same way with the panel held open on The Hoarder:

| t | facts | status | moments |
|---|-------|--------|---------|
| 129 | — | record closed (the entity is not met yet) | — |
| 130, 379 | none ("The System has released nothing further.") | ACTIVE | 1 |
| 380, 539 | `lair` | ACTIVE | 2 |
| 540, 600 | `lair` | DEFEATED | 3 |

`weakness` and `ledger` never appear in episode 1: `ledger` is released in episode 2, `weakness`
in no published episode at all — and so it is absent from the registry page too (below).

At t = 246 the feed reads "Entity · the-listener-below enters the broadcast — Unfiled. The System
has no record of this one.", the broadcast log carries the same row, and the strip still shows
three chips. Nothing throws.

### SC-602 — the registry lists every entity, in the right section, with the right tags

`/registry` on the production build:

| Section | Entities |
|---------|----------|
| Episode 1 — The World Dungeon (3) | the-hoarder, grull-rep, quartermaster-vel |
| Episode 2 — The Meat District (2) | mother-of-pipes, signal-choir |
| Episode 3 — Descent (3) | the-tollkeeper, the-lamplighter, ghaza-provisioner |

All eight registry entities appear, each filed under the episode that first shows it — including
Grull Industries Representative, which is met in episode 1 and sighted again in episode 2, and
The Hoarder, whose `ledger` fact is released a whole episode after it dies. The unfiled
`the-listener-below` is not a section, an entry or a count anywhere.

The Hoarder expanded: facts `Ep 1` (lair) and `Ep 2` (ledger) — `weakness` is correctly omitted,
because no published episode unlocks it; appearances `/ep/1?t=130` MET, `/ep/1?t=380` AMENDED,
`/ep/1?t=540` DEFEATED, `/ep/2?t=330` AMENDED, in that order; footer "Defeated in episode 1."

Search `crate king` (an alias) leaves only The Hoarder; `zzz` shows "The Registry has no such
entity."; the Vendor chip alone leaves grull-rep + ghaza-provisioner (`aria-pressed="true"`),
and Vendor + Ally leaves five across all three sections.

### SC-603 — `#<id>` and "Open in the Registry"

Both land clear of the sticky header. `scroll-margin-top: calc(var(--header-h) + var(--space-6))`
on `.entry` is what does it (added in wave 3; without it the entry's top sat under the header).

| Route | Entry top | Header bottom | Clearance |
|-------|-----------|---------------|-----------|
| `/registry#the-hoarder`, 1440 × 900 | 59.89 px | 36 px | **+23.89 px** |
| `/registry#the-hoarder`, 400 × 800 | 59.73 px | 36 px | **+23.73 px** |
| "Open in the Registry" clicked from `/ep/1?fake=1&t=560`, 1440 × 900 | 106.89 px | 36 px | **+70.89 px** |

In all three the entry arrives already expanded (`data-expanded="true"`), the URL is
`/registry#the-hoarder`, and the document title is "System Registry · Dungeon Crawl Cast". The
in-app click lands lower because the header is still at its full 48 px when the scroll is issued
and compacts to 36 px afterwards — clear either way.

### SC-604 — gates, Lighthouse and axe

**Lighthouse 11.7.1** against `npm run preview` (4173):

| Page | Preset | Perf | **A11y** | Best practices | FCP / LCP / TBT / CLS |
|------|--------|------|----------|----------------|------------------------|
| `/registry` | desktop | 100 | **100** | 100 | 0.4 s / 0.6 s / 0 ms / 0 |
| `/ep/1` | desktop | 100 | **100** | 96 | 0.4 s / 0.5 s / 0 ms / 0.007 |
| `/registry` | mobile | 98 | **100** | 100 | 1.5 s / 2.3 s / 0 ms / 0 |

No accessibility audit fails on any of the three. `/registry` fetches `show.json`, `npcs.json`
and all three episode files before it can render, and still paints in 0.4 s on desktop; the
mobile 98 is `render-blocking-resources` on the one CSS file, which is the same audit the rest of
the site trades away and not a 007 regression. `/ep/1`'s best-practices 96 is the YouTube embed's
own console issue, unchanged from 006.

**axe-core 4.13.0, every rule enabled**:

| Surface | Width | Violations |
|---------|-------|------------|
| Encountered strip (scoped) | 1440 | 0 |
| Entity record in the rail (scoped to `rail-panel`) | 1440 | 0 |
| Episode page, whole document, strip + record open | 1440 | 0 real — one hit on the **dev scrubber's** label (`3.23:1`), which is `?fake=1` chrome compiled out of production |
| NPCs tab, whole document | 400 | same single dev-scrubber hit, nothing else |
| NPCs tab strip (scoped) | 400 | 0 |
| Entity record as a bottom sheet, whole document | 400 | same single dev-scrubber hit, nothing else |
| `/registry` collapsed, whole document (production build) | 1440 and 400 | **0** |
| `/registry` with an entry expanded, whole document | 1440 and 400 | **0** |

The dev-scrubber label is the same known, DEV-only item recorded in the 006 Results.

### Contrast

Measured from the live computed styles (sRGB relative luminance, translucent layers composited
onto the first opaque ancestor). Everything below is body text or a badge, so the bar is
**4.5:1**; nothing on these surfaces qualifies for the 3:1 large-text allowance.

| Surface | Sample | Ratio |
|---------|--------|-------|
| Kind disc, ally | `#131320` on `#5DCAA5` | 9.16:1 |
| Kind disc, vendor | `#131320` on `#FAC775` | 11.82:1 |
| Kind disc, **boss** | `#131320` on `#E24B4A` | **4.68:1** (tightest on the page) |
| `DEFEATED` tag / record status | `#131320` on `#E24B4A` | 4.68:1 |
| Kind badge (mono caps) | `#888780` on `#1D1D28` | 4.63:1 |
| Entity name, strip and entry | `#B4B2A9` / `#EEEDFE` on `#1D1D28` | 7.85:1 / 14.44:1 |
| Strip name on an open chip | `#B4B2A9` on `#26215C` | 6.79:1 |
| `ENCOUNTERED` title | `#888780` on `#131320` | 5.10:1 |
| `Ep N` fact tag | `#CECBF6` on `#26215C` | 9.28:1 |
| Fact text | `#EEEDFE` on `#1D1D28` | 14.44:1 |
| Appearance link (title / time / action) | `#B4B2A9` / `#888780` on `#1D1D28` | 7.85:1 / 4.63:1 |
| Section bar title / count | `#EEEDFE` / `#888780` on `#0D0D16` | 16.74:1 / 5.36:1 |
| Kind chips | `#EEEDFE` on `#1D1D28` | 14.44:1 |
| "Open in the Registry" | `#CECBF6` on `#1D1D28` | 10.72:1 |

The three kind tints are only ever used as **backgrounds under dark text** or as a 3 px spine —
no tint is ever asked to carry a ratio as a foreground on the dark ground.

### Layout

- No horizontal scroll at 1440, 400 or **360** px on `/registry` (`scrollWidth === innerWidth`).
- At 360 and 400 the toolbar wraps: the search takes a full-width row (336 px / 376 px) and the
  three kind chips sit on one row beneath it, right edge 291 px — room to spare for a fourth.
- The phone NPCs tab is a two-column grid (chips at x = 10 and x = 204, 186 px wide); an odd
  final chip spans both columns, the same rule the party grid uses for its fifth crawler.
- `prefers-reduced-motion: reduce` collapses the registry disclosure and the phone sheet to
  ~0 s (`animation-name: none`, durations 1e-05 s).

### Fixes made in wave 3

1. **`?panel=npc:<id>`** — the DEV panel flag in `EpisodePage.tsx` handled `map` and `dossier:`
   but not `npc:`, so an entity record could not be screenshot or QA'd from a URL. One branch
   added, plus a page test that mounts `/ep/1?fake=1&t=200&panel=npc:hoarder`.
2. **Hash landing under the header** — `/registry#<id>` scrolled the entry to y = 0, where the
   sticky header covered its first line. `scroll-margin-top: calc(var(--header-h) + var(--space-6))`
   on `.entry` in `RegistryEntry.module.css`; measured above.
3. **Doubled section heading** — `copy.registryEpisodeSection(1, 'Episode 1 — The World Dungeon')`
   rendered "Episode 1 — Episode 1 — The World Dungeon", because the sample titles already carry
   the prefix. The key now returns the title unchanged when it already starts with `Episode ${n}`
   (case-insensitive) and prefixes it otherwise; the mono-caps bar styling is untouched. The
   RegistryPage test now asserts the literal string both ways.

### Checked by hand or by test, not by this run

Honest list of what the headless pass did **not** cover:

- **A real phone.** 400 × 800 with `setViewport` is a viewport, not a touchscreen: the sheet's
  drag-to-dismiss on the entity record, tab swiping onto the NPCs tab, and momentum scrolling of
  the desktop strip were not exercised on hardware.
- **A screen reader.** Roles, names and states are asserted by the component tests and by axe,
  but no VoiceOver / NVDA pass was made over the strip, the record or the registry.
- **A registry that fails to load, and an episode file that fails to load.** Both paths
  ("The Registry has not been transmitted.", "1 recap episode could not be indexed.") are covered
  by `RegistryPage.test.tsx` and `registry.test.ts` with stubbed fetches; neither was reproduced
  against a live server, which would mean breaking `public/data` on disk.
- **A show with no `registryUrl`.** The "no strip, no tab, no header link" edge case is covered by
  `EpisodePage.test.tsx` and `App.test.tsx`, not by a browser run.
- **Duplicate `met` events for one entity.** Reducer-level test only; the samples contain none.
- **Tens of entities on one floor.** The strip's `overflow-x: auto` was not stress-tested beyond
  the three chips the samples produce.

### For the author

- Three of the eight entities begin with "The", so their initial discs all read **T** (The
  Tollkeeper, The Lamplighter, The Signal Choir). It is legible but not distinguishing. Skipping a
  leading article when picking the initial would fix it in one line in two components — left alone
  here because it changes rendering in `NpcRecord` and `EncounterRail`, outside this wave's remit.
- `weakness` on The Hoarder and several other facts are never unlocked by any sample episode, so
  they are invisible everywhere. That is the intended behaviour, but if you want the registry to
  look full, add `update` rows that release them.

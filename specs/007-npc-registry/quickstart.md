# Quickstart: NPC encounters + System Registry

The dev server is `http://localhost:5180` (`npm run dev`); `npm run preview` serves the
production build at `http://localhost:4173`. `?fake=1`, `?panel=` (`map`, `dossier:<id>`, `npc:<id>`, `registry`, `registry:<id>`) and
`?record=` are **DEV-only**
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

## The Registry beside the broadcast (R3)

| URL | What to see |
|-----|-------------|
| `http://localhost:5199/ep/1?fake=1&t=560&panel=registry` | the **SYSTEM REGISTRY / System Registry** panel in the right rail, beside a stage that is still playing: **Scope** reading "Through Episode 1 — The World Dungeon", the search box, chips Boss 1 / Vendor / Guide 1 / Ally / Faction 1, one bar "EPISODE 1 — THE WORLD DUNGEON · 3 entities" over the-hoarder, grull-rep and quartermaster-vel, and **Open the full Registry** → `/registry?scope=through-1` at the foot |
| the same URL, entry expanded | The Hoarder's **FACTS** (`Ep 1` · the lair) and **APPEARANCES** — 2:10 MET, 6:20 AMENDED, 9:00 DEFEATED — each a **seek button** with a share icon, not a link, because they are in the episode on screen. Activating the first moves the caption clock from 9:20 to 2:10 and navigates nowhere |
| scope → **All episodes**, entry expanded | the same entry now also lists `Episode 2 — The Meat District · 5:30 AMENDED`, and *that* row is a link to `/ep/2?t=330` |
| `http://localhost:5199/ep/1?fake=1&t=560&panel=registry:the-hoarder` | what the record's **Open in the Registry** does: the panel opens with that entry expanded, scrolled into view and on the brand ground, and the footer link carries it out as `/registry?scope=through-1#the-hoarder` |

Escape, the panel's close control and a second press of **Browse the Registry** all close it, and
focus returns to whatever opened it. While it is open, drag the dev scrubber: the **ENCOUNTERED**
strip beneath changes with the playhead and the panel does not — it lists what the archive has
published, not what this device has watched.

**Phone.** The same two URLs at 400 × 800 render the panel as a bottom sheet over the tabs with
the stage still visible above it, drag-to-dismiss and backdrop-tap included. **Browse the
Registry** sits in the **NPCS** pane's header.

## The System Registry (US2)

| URL | What to see |
|-----|-------------|
| `http://localhost:5180/registry` | three sections — "Episode 1 — The World Dungeon" (3 entities), "Episode 2 — The Meat District" (2), "Episode 3 — Descent" (3) — with search and three kind chips (Boss 3, Vendor / Guide 2, Ally / Faction 3) |
| `http://localhost:5180/registry#the-hoarder` | that entry already expanded and scrolled clear of the sticky header: facts tagged `Ep 1` and `Ep 2`, four appearances linking to `/ep/1?t=130`, `/ep/1?t=380`, `/ep/1?t=540` and `/ep/2?t=330`, closing with "Defeated in episode 1." |
| search `crate king` | one entry, The Hoarder — matched on an alias, not the name |
| search `zzz` | "The Registry has no such entity." |
| kind chips Vendor + Ally | five entries across all three sections (any-of) |
| `http://localhost:5180/registry?scope=through-1#the-hoarder` | the **Scope** select reading "Through Episode 1 — The World Dungeon"; one section, three entities (The Hoarder, Grull Industries Representative, Quartermaster Vel), The Hoarder open with the `lair` fact only — no `Ep 2` tag, no `/ep/2?t=330` appearance — and still "Defeated in episode 1." |
| `http://localhost:5180/registry?scope=ep-2` | "Only Episode 2 — The Meat District": one section headed with that title, four entities (The Hoarder, Grull Industries Representative, Mother of Pipes, The Signal Choir), each entry's appearances all `/ep/2?t=…`, and The Hoarder still carrying its episode 1 facts and defeat |
| `?scope=ep-2` + search `toll` | "The Registry has no such entity." with the scope still selected |

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
R2-SC-605 scoped subsets against the samples; R2-SC-606 both episode-page links land scoped.

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

---

## Results (revision 2)

Measured 2026-09-16 on Node 20.9.0. The subsets below are hand-computed from
`public/data/{show,npcs,ep1,ep2,ep3}.json` and asserted in `src/engine/registry.test.ts`
("scopeRegistry over public/data"), which reads those files off disk exactly as
`src/data/samples.test.ts` does.

### Gates (T721)

```
npm run typecheck   tsc --noEmit            clean
npm run lint        eslint .                clean
npm test            43 files, 818 tests     all passing  (789 before revision 2)
npm run build       vite build + postbuild  ✓ built, dist/404.html written
```

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `dist/assets/index-*.js` | 393.55 kB | **123.33 kB** |
| `dist/assets/index-*.css` | 74.77 kB | 12.66 kB |

Revision 2 costs 0.91 kB gzipped of JS and 0.07 kB of CSS, and adds no dependency.

### R2-SC-605 — scoped subsets over the sample archive

The unscoped index holds eight entities, in broadcast order: `the-hoarder`, `grull-rep`,
`quartermaster-vel` (episode 1), `mother-of-pipes`, `signal-choir` (episode 2),
`the-tollkeeper`, `the-lamplighter`, `ghaza-provisioner` (episode 3). `the-listener-below`,
episode 1's deliberate unfiled id, is in no registry and so in no scope.

| Scope | Entities | Notes checked |
|-------|----------|----------------|
| `?scope=through-1` | **3** — the-hoarder, grull-rep, quartermaster-vel | the-hoarder's facts are `[lair]` only (`ledger` is released at 5:30 of episode 2); `defeatedIn` = 1 |
| `?scope=through-2` | **5** — the three above + mother-of-pipes, signal-choir | the-hoarder's facts are `[lair, ledger]`; episode 3's three debuts are absent |
| `?scope=ep-2` | **4** — the-hoarder, grull-rep, mother-of-pipes, signal-choir | the-hoarder's appearances are exactly `[{ episodeId: 2, t: 330 }]`, its facts `[lair, ledger]`, and `defeatedIn` = 1 is **kept** — a boss beaten in episode 1 still reads defeated in an episode 2 view, because that is history this viewer has |
| `?scope=ep-3` | **3** — the-tollkeeper, the-lamplighter, ghaza-provisioner | every appearance is in episode 3 |
| `?scope=all` / absent / `?scope=banana` | **8** | an unreadable scope opens the whole archive (R2-FR-631) |

Order is the index's own in every scope (debut episode, then timecode, then id): scoping trims,
it never re-sorts, and `only` does not re-file anyone — an entity's `firstEpisode` is what it
always was; only the section it is displayed under follows the scope.

### R2-SC-606 — the episode page lands scoped

| From | Href |
|------|------|
| Entity record, "Open in the Registry", on `/ep/1` | `/registry?scope=through-1#the-hoarder` |
| Encountered strip header, "Registry for this episode", on `/ep/1` | `/registry?scope=ep-1` |
| The same strip link in the phone **NPCS** pane | `/registry?scope=ep-1` |

The record's link keeps the hash, so the Registry opens with that entry expanded *inside* the
scope; changing the scope select afterwards keeps both the hash and any other search param, so
the entry stays open as the view widens or narrows around it.

`/registry?scope=ep-2` was served 200 by the dev server in a headless check (no console errors).

---

## Results (revision 3)

Measured 2026-09-16 on Node 20.9.0, Chrome 152 headless over CDP (puppeteer-core 22.15.0),
axe-core 4.10.3 and Lighthouse 11.7.1. The episode page runs against `npm run dev` on port 5199
(the `?panel=` flag is DEV-only); the Registry page runs against `npm run preview` on 4173.

### Gates (T725)

```
npm run typecheck   tsc --noEmit            clean
npm run lint        eslint .                clean
npm test            45 files, 841 tests     all passing  (818 before revision 3)
npm run build       vite build + postbuild  ✓ built, dist/404.html written
```

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `dist/assets/index-*.js` | 399.33 kB | **124.97 kB** |
| `dist/assets/index-*.css` | 76.58 kB | 12.71 kB |

Revision 3 costs 1.64 kB gzipped of JS and 0.05 kB of CSS over revision 2 (123.33 / 12.66), adds
no dependency, and stays well inside the 150 kB gzipped budget.

The 23 new tests: `RegistryIndexContext` (4 — lazy, once, cached, one missing episode),
`RegistryBrowser` (7), `registrySections` / `matchesRegistryQuery` (6), `usePanel` (1),
`NpcRecord` (1), and the desktop page suite (+4). `EncounterRail`'s and the phone suite's
revision 2 link assertions were rewritten as panel-trigger assertions rather than added to.

### R3-SC-607 — the panel opens beside the broadcast, and nothing moves

At 1440 × 900, `/ep/1?fake=1&t=560&panel=registry`:

| Measured | Value |
|----------|-------|
| Stage rect | x 16, width 1072, height 603 |
| Panel rect | x 1104, width 320 — **no overlap** with the stage (constitution III) |
| Scope select | `through-1`, "Through Episode 1 — The World Dungeon" |
| Chips | Boss 1, Vendor / Guide 1, Ally / Faction 1 |
| Section | "Episode 1 — The World Dungeon", 3 entities — the-hoarder, grull-rep, quartermaster-vel |
| Footer link | `/registry?scope=through-1` ("Open the full Registry") |
| Strip trigger | `encounter-browse`, `aria-expanded="true"`, `aria-controls="rail-panel"` |
| Console | no errors, no warnings |
| Horizontal scroll | 0 at 1440, 400 **and** 360 px (page and panel both) |

That the open does not touch playback is proved in jsdom rather than by eye
(`EpisodePage.test.tsx`, "browses the Registry beside the broadcast, without touching the
video"): with `seek` and `pause` spied on the fake source, opening the panel calls neither,
`getTime()` is unchanged, and `source.playing` stays false. The phone suite asserts the same for
the sheet. Scrubbing while the panel is open changes the strip beneath and leaves the panel's
scope, search and entries exactly as they were.

### R3-SC-608 — current-episode appearances seek, others link

Expanding The Hoarder in the panel on `/ep/1`:

| Appearance | Rendered as |
|------------|-------------|
| Episode 1 · 2:10 MET | `<button data-current="true">` + share icon |
| Episode 1 · 6:20 AMENDED | `<button data-current="true">` + share icon |
| Episode 1 · 9:00 DEFEATED | `<button data-current="true">` + share icon |
| Episode 2 · 5:30 AMENDED (scope **All episodes**) | `<a href="/ep/2?t=330">` |

Activating the first button moved the caption clock from **9:20 to 2:10** with no navigation.

### Accessibility

| Run | Result |
|-----|--------|
| Lighthouse a11y, `/ep/1?t=560&panel=registry` (dev, panel open) | **100** |
| Lighthouse a11y, `/ep/1?t=560&panel=registry:the-hoarder` (dev) | **100** |
| Lighthouse a11y, `/registry` (preview) | **100** |
| Lighthouse a11y, `/registry?scope=through-1#the-hoarder` (preview) | **100** |
| axe on the panel (`[data-testid="rail-panel"]`), 1440 | **0 violations** — 26 passes collapsed, 29 with an entry expanded |
| axe on the whole episode page, 1440 and 400, panel open | 0 violations beyond the pre-existing DEV scrubber label (`Simulated broadcast — dev scrubber`, 3.23:1), which is present without the panel and is compiled out of the build |
| axe on `/registry#the-hoarder` (preview), 1440 and 400 | **0 violations** |

One real defect surfaced and was fixed: the entry the hash (or `focusId`) names sits on the brand
ground, where the dimmest text step falls to 4.0:1 — under AA for the 10 px `FACTS` /
`APPEARANCES` labels inside it. `.entry[data-target]` now raises `--text-3` one step for its own
subtree, which fixes the panel and the page's `#<id>` landing together.

### Screenshots

- **1440 × 900, rail panel** (`panel-1440-expanded.png`): the stage fills the left column with
  the dev scrubber at 9:20; the right rail carries `SYSTEM REGISTRY / System Registry` with a
  close control, the scope select at full width, the search box under it, the three kind chips
  wrapping onto two rows, the black mono-caps episode bar with "3 entities", and The Hoarder's
  card — struck-through name, `BOSS · FLOOR 1`, red `DEFEATED` tag, intro, `Ep 1` fact, three
  appearance rows each with a share icon, closing with "Defeated in episode 1." Under the party
  rail, **ENCOUNTERED** carries **Browse the Registry** on its right.
- **400 × 800, bottom sheet** (`sheet-400.png`): the stage stays visible at the top; the sheet
  covers the tabs from y 240 with its grab handle, the same kicker and title, and the toolbar
  scrolled just above the focused entry — The Hoarder on the brand ground, expanded, its three
  appearance rows and share icons at thumb size, with Grull Industries Representative below.

### Notes for the author

- The panel's scope is deliberately **not** in the URL: changing it must not navigate, or the
  broadcast would reload. Shareability lives in the footer link, which carries the scope (and the
  open entity) to `/registry`.
- The index is fetched once per visit, by whichever of the page or the panel asks first. Opening
  the panel on a cold page shows "The System is indexing the archive." for as long as the episode
  files take, then fills in; a file that fails still yields "N recap episodes could not be
  indexed." inside the panel.

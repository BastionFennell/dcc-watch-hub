---
description: "Task list for DCC Watch Hub v2 (Lean-Forward)"
---

# Tasks: DCC Watch Hub v2 ("Lean-Forward")

**Input**: `/specs/002-watch-hub-v2/` (spec, plan, research, data-model, contracts, quickstart).
v1 code is on `main`; read `specs/001-watch-hub-v1/` for the existing architecture.
**Tests**: REQUIRED (constitution I/VI): reducer, selectors, storage, and page-level tests via `FakeTimeSource`.
**Organization**: Setup → Foundational → US1+US4 (dossier & sparklines) → US2 (map) → US3 (resume) → Polish.

## Format: `[ID] [P?] [Story] Description with file path`

## Execution waves

| Wave | Tasks | Agents |
|------|-------|--------|
| 1 | Phase 1 + Phase 2 (T101–T112) | one agent (types, engine, data, converter, storage, adapter are coupled) |
| 2 | Phase 3 (US1) + Phase 4 (US4) (T113–T121) ∥ Phase 5 (US2, T122–T124 only — not T125) ∥ Phase 6 (US3, T126–T128 only — not T129) | three agents; ownership below |
| 3 | T125, T129 (page wiring for map + resume) + T130 | one agent |
| 4 | Phase 7 (T131–T135) | one agent |

**File ownership in wave 2**: "dossier" owns `src/hooks/usePanel.ts`, `src/components/RailPanel/**`,
`src/components/CrawlerDossier/**`, `src/components/PartyRail/**`, `src/components/EventFeed/**`,
`src/pages/EpisodePage.tsx`, `src/pages/EpisodePage.module.css`, `src/pages/EpisodePage.test.tsx`.
"map" owns `src/components/FloorMap/**`, `src/components/MiniMapBadge/**`, `src/components/FloorMap/FloorMap.test.tsx`.
"resume" owns `src/playback/useResume.ts`, `src/playback/useResume.test.tsx`, `src/components/ResumeCard/**`.
Everyone appends to `src/copy.ts` only at the end of the file. Nobody in wave 2 edits `src/engine/**`,
`src/data/**`, `scripts/**`, or `public/**`.

---

## Phase 1: Setup

- [ ] T101 Append v2 copy to `src/copy.ts` (end of object, under a `/* --- v2 --- */` banner):
  panel close label ("Close"), dossier kicker "CRAWLER DOSSIER", section titles (Vitals, Debuffs,
  Stats, Hotlist, Skills, Inventory, Achievements, History), sheet labels (Race, Pronouns,
  Crawler #, Level, Class, Floor, Player, Handle), empty states in System voice (e.g. "No debuffs
  on record.", "Hotlist empty.", "No skills logged.", "Nothing carried.", "No achievements yet.",
  "No moments logged."), "Unranked", "Unclassed", rank labels (Current, Best), sparkline summary
  `(from, to, count, best) => string`, map kicker "SYSTEM CARTOGRAPHY", map title `(floor) => 'Floor N'`,
  map controls (Zoom in, Zoom out, Fit), map trigger label "Open the floor map", map summary
  `(revealed, total, labels) => string`, resume kicker "BROADCAST BOOKMARK", resume title
  `(time) => 'Rejoin at m:ss?'`, resume body "The System has your place marked.", resume actions
  ("Rejoin the broadcast", "Start from the beginning"), party rank line `(rank) => 'Party rank #N'`,
  feed labels for `skill` ("Skill"), `class` ("Class"), `hotlist` ("Hotlist"), feedText templates
  for the three (`skill(actor, name, rank?)`, `classChange(actor, cls)`, `hotlist(actor, add, remove)`).
- [ ] T102 [P] Add tokens to `src/styles/tokens.css`: HP segment scale `--hp-seg-1`…`--hp-seg-10`
  (red #E24B4A → amber #EF9F27 → green #639922 ramp), `--panel-z: 20`, `--focus-ring: 0 0 0 2px var(--brand-2)`;
  add `body.panel-open { overflow: hidden }` to `src/styles/global.css`.
- [ ] T103 [P] Raise the per-file event ceiling in `src/data/samples.test.ts` from 40 to 60 and add
  `skill`, `class`, `hotlist` to its "every known type ≥ 2×" expectation.

## Phase 2: Foundational

- [ ] T104 `src/data/types.ts`: add `SkillEntry { name; rank? }`, `CrawlerStats`, optional `Crawler`
  fields (`race`, `pronouns`, `crawlerNumber`, `stats`, `hotlist`, `skills`), events `SkillEvent`,
  `ClassEvent`, `HotlistEvent`, extend `Event`, `EventType`, `KNOWN_EVENT_TYPES`.
- [ ] T105 `src/data/validate.ts`: normalize the three events (coerce `rank`, split nothing — arrays
  arrive as arrays) and the optional crawler fields (drop malformed optional fields with a
  `console.warn`, never throw); extend `src/data/validate.test.ts`.
- [ ] T106 `src/engine/state.ts` + `src/engine/reducer.ts`: `CrawlerState` gains `skills`, `hotlist`
  seeded from initial fields; reducer cases per data-model §1 (skill upsert by name, class set,
  hotlist union). Extend `src/engine/reducer.test.ts` (upsert replaces rank, keeps order; class;
  hotlist add/remove; unknown actor ignored).
- [ ] T107 `src/engine/selectors.ts`: add `crawlerHistory`, `rankSeries`, `hpSegments`,
  `crawlerDossier`, `mapLabels` per data-model §3; `toFeedItem` handles the three new types with
  `copy.labels`/`copy.feedText`. Extend `src/engine/selectors.test.ts` with the cases in research R12.
- [ ] T108 [P] `src/test/fixtures.ts`: add the facts in data-model §5 (keep all existing times and
  texts so v1 page tests still pass).
- [ ] T109 [P] Sample data `public/data/ep{1,2,3}.json`: add sheet fields to all five crawlers, ≥ 2
  `skill`, ≥ 2 `class`, ≥ 2 `hotlist` events, ≥ 3 crawler-scoped `rank` events for two crawlers,
  a third labeled `map_reveal`; keep every `t ≤ durationSec` and ascending; diegetic text.
  `npm test -- samples` must pass against the v2 schema (see T110).
- [ ] T110 [P] Contracts + converter: point `src/data/samples.test.ts` and `scripts/sheet-to-json.test.ts`
  at `specs/002-watch-hub-v2/contracts/episode.schema.json`; extend `scripts/sheet-to-json.ts` with
  `skill`/`class`/`hotlist` rows per `contracts/sheet-csv.md`; update `scripts/samples/ep1.csv`,
  `ep1-broken.csv`, `ep1-error.csv`, `ep1.initial.json`; extend `scripts/sheet-to-json.test.ts`.
- [ ] T111 [P] `src/playback/resume.ts` per `contracts/resume-storage.md` (`createResumeStore`,
  default export bound to `localStorage`) + `src/playback/resume.test.ts` (round-trip, bad JSON,
  wrong episode, negative t, throwing storage, clear).
- [ ] T112 [P] `src/playback/YouTubeTimeSource.ts`: queue `seek` until `onReady` (latest wins),
  apply with `seekTo(t, true)` and emit a tick; update the header comment. No test (host-bound);
  `contracts/time-source.md` §6 documents it.

**Checkpoint**: `typecheck`, `lint`, `test`, `build` green; v1 tests untouched and passing.

---

## Phase 3: User Story 1 — Crawler dossier (Priority: P1) 🎯

- [ ] T113 [P] [US1] `src/hooks/usePanel.ts` per `contracts/panels.md` (state, open/toggle/close,
  Escape with menu-first rule, focus return, `body.panel-open` at ≤ 900 px via `matchMedia`, reset
  on episode id) + `src/hooks/usePanel.test.tsx` (renderHook; jsdom `matchMedia` stub).
- [ ] T114 [P] [US1] `src/components/RailPanel/RailPanel.tsx` + `.module.css`: region with kicker,
  title, close button (`IconClose` added to `src/components/icons.tsx`), scrollable body; desktop
  `max-height: calc(100vh - var(--header-h) - 2 * var(--space-6))`; ≤ 900 px fixed overlay
  (`z-index: var(--panel-z)`, canvas background, safe-area padding); 150 ms fade honoring reduced motion.
- [ ] T115 [P] [US1] `src/components/CrawlerDossier/HpSegments.tsx` (ten cells, filled count from
  `hpSegments`, colors `--hp-seg-N`, `role="img"` aria-label "HP 12 of 22") and
  `src/components/CrawlerDossier/CrawlerDossier.module.css` (sheet styling: black section bars with
  mono caps, two-column header, definition rows, lists; System blue header band).
- [ ] T116 [US1] `src/components/CrawlerDossier/CrawlerDossier.tsx`: props `{ dossier: Dossier; meta: EpisodeMeta }`;
  sections in FR-110 order with empty states from copy; achievements show `formatTime(t)`; history
  reuses `FeedItemView`. (Sparkline slot rendered by T120.)
- [ ] T117 [US1] `src/components/PartyRail/CrawlerFrame.tsx` + `PartyRail.module.css`: the frame becomes
  a `<button>` trigger per `contracts/panels.md` (keep `data-testid="crawler-frame"`, `data-crawler`,
  `data-danger`, `data-levelup` on the button); props gain `expanded: boolean`, `onActivate(el)`;
  hover/focus ring, `cursor: pointer`. `PartyRail` passes `activeId` and `onActivate`.
- [ ] T118 [US1] `src/pages/EpisodePage.tsx` + `.module.css`: use `usePanel`; right rail renders
  `EventFeed` when `none`, else `RailPanel` wrapping `CrawlerDossier` (map body comes in T125 — leave a
  clear `case 'map'` slot rendering `null` for now); wire `PartyRail` trigger; reset panel on episode change.
- [ ] T119 [US1] Extend `src/pages/EpisodePage.test.tsx`: click Harry → dossier region with his name,
  class "Compensated Anarchist" at 200, hotlist "Crowbar" at 200 and "Door" at 110, skills for X.O.
  upsert (rank 2 at 160, rank 1 at 100), inventory at t vs after a backward seek (crowbar gone before
  its loot time), achievements list; Escape closes and focus returns to the frame; clicking X.O.
  switches; clicking Harry again closes; `aria-expanded` toggles; menu-first Escape (open the
  Episodes `<details>`, press Escape → menu closed, panel still open; press again → panel closed).

## Phase 4: User Story 4 — Rank sparklines (Priority: P4)

- [ ] T120 [P] [US4] `src/components/CrawlerDossier/RankSparkline.tsx` + css per research R4; props
  `{ series: RankSeries }`; renders nothing with zero points; `role="img"` + `aria-label` from
  `copy.sparklineSummary`; current/best numbers beside it. Mount it in `CrawlerDossier` vitals.
- [ ] T121 [US4] `src/components/EventFeed/EventFeed.tsx`: new prop `partyRank: number | null`
  renders `copy.partyRankLine(rank)` under the header when non-null; page passes
  `rankSeries(events, t, 'party').current`. Tests: sparkline points/summary for Harry at 200 and
  at 120; party rank line appears at 125, absent at 120 (in `EpisodePage.test.tsx`).

**Checkpoint**: dossier + sparklines demonstrable via `?fake=1&t=200`.

---

## Phase 5: User Story 2 — Expanded floor map (Priority: P2)

- [ ] T122 [P] [US2] `src/components/FloorMap/FloorMap.tsx` + `.module.css` per research R5: props
  `{ cells: MapCellsView; recent: Set<string>; labels: MapLabel[]; floor: number }`; SVG grid, labels
  at centroids, zoom steps, pan with pointer capture and clamping, keyboard `+ - 0`, buttons Zoom
  in / Zoom out / Fit (disabled at limits), `role="img"` summary, sr-only label list.
- [ ] T123 [P] [US2] `src/components/FloorMap/FloorMap.test.tsx` (jsdom): renders cols×rows rects;
  revealed/recent states; labels text and count; zoom buttons change the transform and disable at
  limits; Fit resets; keyboard `+`/`0`.
- [ ] T124 [P] [US2] `src/components/MiniMapBadge/MiniMapBadge.tsx` + css: becomes a `<button>` trigger
  per `contracts/panels.md` (`aria-label` from copy, `aria-expanded`, pointer events on, hover/focus
  ring); decorative grid stays `aria-hidden`; props gain `expanded`, `onActivate(el)`.
- [ ] T125 [US2] (wave 3) Wire the map into `EpisodePage.tsx`: badge trigger → `toggle({ kind: 'map' })`;
  `case 'map'` renders `RailPanel` + `FloorMap` with `mapCells(state)`, `recentlyRevealed`, `mapLabels(events, t)`.
  Extend `EpisodePage.test.tsx`: open map → labels "The Meat District" (at 100) and both (at 180);
  seek back → one label; one-panel rule (map open, click Harry → dossier replaces map); Escape closes
  and focuses the badge.

---

## Phase 6: User Story 3 — Resume (Priority: P3)

- [ ] T126 [P] [US3] `src/playback/useResume.ts` per `contracts/resume-storage.md` (throttle via
  `Date.now()` ref, `pagehide`/`visibilitychange` listeners, unmount save, clear rules, `pending`,
  `rejoin` retries when the source arrives, `startOver`). Injectable store for tests.
- [ ] T127 [P] [US3] `src/playback/useResume.test.tsx` (renderHook + `FakeTimeSource` + in-memory store,
  fake timers): pending thresholds (29 → null, 30 → offer, duration−29 → null), save cadence
  (two ticks within 5 s → one write), pause writes, `pagehide` writes, ended clears, `t ≥ duration−30`
  clears, rejoin seeks and resolves, startOver clears, throwing store never throws.
- [ ] T128 [P] [US3] `src/components/ResumeCard/ResumeCard.tsx` + css: System-styled card centered over
  the stage (`z-index: 3`, above toast/badge, below nothing else), kicker/title/body from copy, two
  buttons (Rejoin primary in `--brand-2`, Start over secondary), `role="dialog"` `aria-labelledby`,
  initial focus on Rejoin, Escape = start over.
- [ ] T129 [US3] (wave 3) Wire into `EpisodePage.tsx`: `const resume = useResume(meta, source, playhead)`;
  render `ResumeCard` inside `VideoStage` children when `resume.pending`; extend `EpisodePage.test.tsx`
  with an injected store: record `{t: 120}` → card; Rejoin → fake source at 120, feed header 2:00,
  card gone; Start over → store cleared; `fake.end()` → store cleared; record `{t: 10}` → no card.
- [ ] T130 (wave 3) `README.md` + `specs/002-watch-hub-v2/quickstart.md`: document panels, map
  controls, resume behavior and its storage key, new CSV rows, and the new sheet fields.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T131 [P] Accessibility pass on panels: focus order, `aria-expanded` sync, region labels,
  reduced motion, contrast of new colors (HP segments on panel, sparkline stroke) ≥ 3:1 for
  graphics, 4.5:1 for text; fix in tokens if needed.
- [ ] T132 [P] Responsive pass: panel overlay at 360/400 px (no horizontal scroll, close reachable,
  body scroll locked), dossier header wraps, map controls reachable; desktop panel body scrolls
  internally and the stage never moves when a panel opens (measure `getBoundingClientRect` of the
  stage before/after in a test).
- [ ] T133 [P] Performance check: `npm run build`, note gzipped JS in README (must stay ≤ 150 kB),
  Lighthouse on `/ep/1` from `npm run preview` if Chrome is available; record under quickstart `## Results`.
- [ ] T134 Diegetic copy review of every new string; no "Dashboard/Home/Ads"; forbidden-word grep.
- [ ] T135 Final verification: `typecheck && lint && test && build`, walk quickstart, tick spec SCs with
  evidence under quickstart `## Results`, ensure every task here is `[X]`.

## Dependencies

Phase 1 → Phase 2 → { Phase 3+4 ∥ Phase 5 (T122–T124) ∥ Phase 6 (T126–T128) } → { T125, T129, T130 } → Phase 7.

## Notes

- Agents MUST NOT run git write commands; the orchestrator commits at wave boundaries.
- Everything rendered in a panel is derived per render from `reduceTo` + selectors; no memoization, no timers.
- Never import `YT` outside the two adapter files. No new runtime dependencies.

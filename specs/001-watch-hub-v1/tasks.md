---
description: "Task list for DCC Watch Hub v1 (System Feed)"
---

# Tasks: DCC Watch Hub v1 ("System Feed")

**Input**: Design documents from `/specs/001-watch-hub-v1/` (plan.md, spec.md, research.md,
data-model.md, contracts/, quickstart.md) plus `/dcc-watch-hub-spec.md` and `wireframe.html`.
**Tests**: REQUIRED for the engine, data ordering, the episode page (via `FakeTimeSource`), the
converter, and sample-data schema conformance (constitution Principles I and VI; spec SC-002/003/009).
**Organization**: Setup → Foundational → one phase per user story (P1…P5) → Polish.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: parallelizable (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md

## Execution waves (for multi-agent execution)

| Wave | Tasks | Notes |
|------|-------|-------|
| 1 | Phase 1 + Phase 2 (T001–T018) | single agent; everything else depends on it |
| 2 | Phase 3 (US1) ∥ Phase 4 (US2, except T030) ∥ Phase 7 (US5) | three agents; file ownership below prevents collisions |
| 3 | Phase 5 (US3) + Phase 6 (US4) + T030 | one agent; edits EpisodePage/VideoStage after US1 lands |
| 4 | Phase 8 (Polish) | one agent; full verification |

**File ownership in wave 2**: US1 owns `src/pages/EpisodePage.tsx`, `src/pages/EpisodePage.module.css`,
`src/components/VideoStage/**`, `src/components/PartyRail/**`, `src/components/EventFeed/**`,
`src/playback/YouTubeTimeSource.ts`, `src/playback/loadYouTubeApi.ts`, `src/pages/EpisodePage.test.tsx`.
US2 owns `src/components/SiteHeader/**`, `src/components/NextEpisodeCard/**`, `src/pages/HubPage*`,
`src/App.tsx`, `src/hooks/useScrolled.ts`. US5 owns `scripts/**`. Nobody in wave 2 edits
`src/engine/**`, `src/data/**`, or `src/copy.ts` except to append new string keys to `src/copy.ts`
(append-only, at the end of the file, to keep merges trivial).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Toolchain, project skeleton, tokens, CI.

- [X] T001 Scaffold the Vite + React + TypeScript project at repo root: `package.json` (name
  `dcc-watch-hub`, `"type": "module"`, `engines.node ">=20.9 <21 || >=22"`, scripts `dev`,
  `build` = `vite build && node scripts/postbuild.mjs`, `preview`, `typecheck` = `tsc --noEmit -p tsconfig.json`,
  `lint` = `eslint .`, `test` = `vitest run`, `test:watch`, `sheet-to-json` = `tsx scripts/sheet-to-json.ts`),
  deps `react@19`, `react-dom@19`, `react-router@7`; devDeps `vite@6`, `@vitejs/plugin-react@4`,
  `typescript@5`, `@types/react`, `@types/react-dom`, `@types/youtube`, `vitest@3`, `jsdom`,
  `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/dom`, `eslint@9`,
  `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`,
  `tsx`, `csv-parse`, `ajv`, `ajv-formats`; files `vite.config.ts` (base from `process.env.VITE_BASE ?? '/'`,
  plugin-react, `test: { environment: 'node', setupFiles: ['src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'] }`),
  `tsconfig.json` (strict, `moduleResolution: bundler`, `jsx: react-jsx`, `types: ["vite/client", "youtube", "vitest/globals"]`, include `src`, `scripts`),
  `tsconfig.node.json`, `index.html` (lang en, viewport, `<title>Dungeon Crawl Cast · System Feed</title>`, theme-color `#131320`, no external fonts, `<div id="root">`),
  `.gitignore` (node_modules, dist, .DS_Store, *.log, .env*), `src/vite-env.d.ts`. Run `npm install` and confirm `npm run typecheck` passes on an empty `src/main.tsx`.
- [X] T002 [P] Create `eslint.config.js` (flat): typescript-eslint recommended, react-hooks
  recommended, react-refresh; `no-restricted-globals` for `YT` and `onYouTubeIframeAPIReady`
  everywhere except `src/playback/YouTubeTimeSource.ts` and `src/playback/loadYouTubeApi.ts`
  (use a second config block with `files` for those two paths that turns the rule off); ignore
  `dist/`, `node_modules/`, `specs/`.
- [X] T003 [P] Create `src/styles/tokens.css` (custom properties: `--canvas:#131320`,
  `--panel:#1d1d28`, `--panel-deep:#0d0d16`, `--hairline:#2C2C2A`, `--hairline-2:#444441`,
  `--text:#EEEDFE`, `--text-2:#B4B2A9`, `--text-3:#888780`, `--text-4:#5F5E5A`,
  `--system-bg:#0C447C`, `--system-fg:#B5D4F4`, `--system-pill-fg:#85B7EB`, `--system-pill-border:#185FA5`,
  `--brand:#3C3489`, `--brand-2:#534AB7`, `--brand-deep:#26215C`, `--brand-fg:#CECBF6`, `--brand-fg-2:#EEEDFE`,
  `--amber-bg:#633806`, `--amber-fg:#FAC775`, `--danger:#E24B4A`, `--hp:#639922`,
  `--marker-loot:#EF9F27`, `--marker-achievement:#378ADD`, `--marker-boss:#D4537E`, `--marker-levelup:#5DCAA5`, `--marker-story:#888780`,
  `--label-loot:#FAC775`, `--label-rank:#9FE1CB`, `--label-map:#F0997B`,
  radii 4/6/8/10, spacing scale, `--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  `--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace`, `--header-h:48px`, `--header-h-compact:36px`)
  and `src/styles/global.css` (reset, `body{background:var(--canvas);color:var(--text);font-family:var(--font-sans)}`,
  `:focus-visible` outline in brand-2, `.sr-only`, `@media (prefers-reduced-motion: reduce)` disables transitions/animations).
- [X] T004 [P] Create `.github/workflows/ci.yml`: on push and pull_request; `actions/checkout@v4`,
  `actions/setup-node@v4` with `node-version: 20.9.0` and npm cache; `npm ci`, `npm run typecheck`,
  `npm run lint`, `npm test`, `npm run build`.
- [X] T005 [P] Create `.github/workflows/deploy.yml` (on push to `main`; permissions `pages: write`,
  `id-token: write`; build with `VITE_BASE=/dcc-watch-hub/`; `actions/upload-pages-artifact@v3` of
  `dist`; `actions/deploy-pages@v4`), `scripts/postbuild.mjs` (copy `dist/index.html` → `dist/404.html`),
  and `public/_redirects` (`/* /index.html 200`).
- [X] T006 [P] Create `src/copy.ts` exporting a single `copy` object with every user-facing string
  in System voice (site title, "System feed" pill, "Broadcast archive", "Recap episodes",
  "Event feed · synced {time}", "Next recap episode →", "Return to the broadcast archive",
  "No such recap episode exists in the archive.", "Feed unavailable. The System is
  recalibrating.", "Sponsored", labels Loot/Rank/Map/Achievement/Level up/Status/Inventory/Chapter/Note,
  "Episodes", "YouTube", "Discord", "Previous recap episode", "Next recap episode", "Menu",
  "scrubbing rewinds the feed") and `src/components/icons.tsx` with inline SVG components
  `IconBroadcast`, `IconMap`, `IconLoot`, `IconRank`, `IconPlay`, `IconChevronLeft`, `IconChevronRight`,
  `IconMenu` (24×24 viewBox, `currentColor`, `aria-hidden`).

**Checkpoint**: `npm install`, `npm run typecheck`, `npm run lint` all pass on the skeleton.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Framework-free data + engine layers, playback interface, sample data, routing shell.

- [X] T007 Create `src/data/types.ts` per data-model.md §1: `Show`, `Season`, `Floor`,
  `EpisodeMeta`, `EpisodeData`, `InitialState`, `Crawler`, `MapState`, `Cell`, the `Event`
  discriminated union (12 known types with `t`, optional `actor`), `UnknownEvent = { type: 'unknown'; t: number; raw: unknown }`,
  `AnyEvent = Event | UnknownEvent`, `KNOWN_EVENT_TYPES` const array, `CHAPTER_KINDS` const array.
- [X] T008 Create `src/data/validate.ts`: `isShow(x): x is Show`, `isEpisodeData(x): x is EpisodeData`
  (structural checks, not exhaustive), `normalizeEvent(raw: unknown): AnyEvent` (returns
  `UnknownEvent` for unknown/malformed types; coerces numeric strings for `t`, `current`, `max`,
  `level`, `rank`, `durationSec`; clamps negative `t` to 0), `normalizeEpisode(raw): EpisodeData`
  (normalizes events and stable-sorts by `t`), `class DataError extends Error`. Add
  `src/data/validate.test.ts` covering unknown type → `unknown`, malformed hp → `unknown`, sort stability.
- [X] T009 [P] Create `src/data/load.ts`: `joinBase(base: string, url: string)`, `fetchShow(): Promise<Show>`,
  `fetchEpisode(meta: EpisodeMeta): Promise<EpisodeData>` (both resolve leading-slash URLs
  against `import.meta.env.BASE_URL`, throw `DataError` on non-2xx or validation failure). Unit
  test `joinBase` in `src/data/load.test.ts` (`/` + `/data/ep1.json`, `/dcc-watch-hub/` + `/data/ep1.json`, already-absolute http URL untouched).
- [X] T010 [P] Create `src/data/show.ts`: `orderedEpisodeIds(show)`, `orderedEpisodes(show)`,
  `findEpisode(show, id)`, `prevNext(show, id)`, `episodesByFloor(show)` (append an "Unsorted"
  group for ids missing from floors, `console.warn` once). Test in `src/data/show.test.ts`:
  ordering across two floors, prev undefined at first, next undefined at last, grouping, unsorted fallback.
- [X] T011 Create `src/engine/state.ts` (`OverlayState`, `CrawlerState`, `fromInitialState`) and
  `src/engine/reducer.ts` (`applyEvent(state, event): OverlayState` handling all 12 types per
  data-model.md table, ignoring `unknown` and unknown actors; HP clamped to `[0, max]`;
  `reduceTo(episode: EpisodeData, t: number): OverlayState`). No React/DOM imports. Test in
  `src/engine/reducer.test.ts`: one case per event type, unknown type ignored, unknown actor
  ignored, clamp, determinism (two calls deep-equal), `reduceTo(ep, e.t - 0.001)` excludes `e`
  and `reduceTo(ep, e.t)` includes `e` for every event in the fixture.
- [X] T012 Create `src/engine/time.ts` (`formatTime(sec)` → `m:ss`/`mm:ss` under 1 h, `h:mm:ss`
  at/after; floors fractional seconds) and `src/engine/selectors.ts` per data-model.md §3:
  `elapsed`, `partyFrames` (with `danger`, `levelUpPulse` window 1.2 s), `feedItems(events, t, n=8)`
  (known types only, newest first, each `{ id, t, kind, label, text, actorName? }` — `id` =
  index in the original array so React keys are stable), `activeSponsor`, `activeToast` (FIFO
  math: `start_i = max(t_i, end_{i-1})`, `end_i = start_i + 6`), `timelineMarkers(events, durationSec, party)`
  (chapter kind→color token name, achievement, level_up; `pos` clamped 0..1; label rules),
  `mapCells(state)`, `stageCaption(meta, t)`. Test in `src/engine/selectors.test.ts`: feed at t=0
  empty; mid; backward shrinks; forward grows; never-early invariant across every event; toast
  FIFO with 3 clustered achievements (5:00/5:01/5:02 → windows 300–306, 306–312, 312–318, none at 318);
  active sponsor window edges; overlapping sponsors pick latest; markers positions/colors incl. unknown kind → story;
  `formatTime(0)`, `formatTime(61)`, `formatTime(3661)`.
- [X] T013 [P] Create `src/playback/TimeSource.ts` (interface per contracts/time-source.md +
  `createEmitter<T>()` helper) and `src/playback/FakeTimeSource.ts` (`set(t)`, `advance(dt)`,
  `play()` using `setInterval` 250 ms at 1×, `pause()`, `end()`, `seek(t)`, `destroy()`; every
  state change emits a tick). Test in `src/playback/FakeTimeSource.test.ts` with fake timers.
- [X] T014 [P] Create `src/playback/usePlayhead.ts`: `usePlayhead(source: TimeSource | null): { t: number; playing: boolean; ended: boolean }`
  subscribing in `useEffect`, initial `t = source?.getTime() ?? 0`, cleanup unsubscribes.
- [X] T015 [P] Create sample data: `public/data/show.json` (title "Dungeon Crawl Cast"; season 1;
  Floor 1 label "Floor 1" episodes [1,2]; Floor 2 label "Floor 2" episodes [3]; episodes 1–3
  with titles "Episode 1 — The World Dungeon", "Episode 2 — The Meat District", "Episode 3 — Descent";
  `youtubeId: "M7lc1UVf-VE"` for all; `durationSec: 240`; `dataUrl: "/data/epN.json"`; links
  `https://www.youtube.com/@DungeonCrawlCast` and `https://discord.gg/REPLACE_ME`), and
  `public/data/ep1.json`, `ep2.json`, `ep3.json` each with the five crawlers
  (`stuntman` "The Stuntman" handle "Dungeon Crawler Danny" player "Danny"; `psychic` "The Psychic";
  `harry` "Harry"; `xo` "X.O."; `actress` "The Actress"; levels 1–4, hp maxes 18–26,
  portraits `/img/crawlers/<id>.svg`, `class: null`, small inventories, `rank: null`),
  `partyRank: null`, map `{ floor, grid: { cols: 12, rows: 8 }, revealed: [] }` and 25–40 events
  spread across 0–235 s that between them exercise every event type at least twice, including:
  three clustered achievements (e.g. t=60, 61, 62), an hp event that drops Harry below 25%,
  a status add then remove, a sponsor lasting 20 s, chapters of kinds boss/loot/story, two
  map_reveals with labels, a rank scope party and a rank scope crawler, a note, and one event
  of type `"future_type"` with `t: 100` to prove forward compatibility.
- [X] T016 [P] Create placeholder art: `public/img/crawlers/{stuntman,psychic,harry,xo,actress}.svg`
  (monochrome bust silhouettes, 96×96, each with a distinct brand-tinted background and the
  crawler initial), `public/img/dcc-mark.svg` (circular "DC" mark in brand colors, matching the
  wireframe), `public/favicon.svg` (same mark). Reference favicon from `index.html`.
- [X] T017 [P] Create `src/data/samples.test.ts`: loads `contracts/show.schema.json` and
  `contracts/episode.schema.json` from `specs/001-watch-hub-v1/contracts/` with `ajv` +
  `ajv-formats` (draft-07, `strict: false`) and asserts every `public/data/*.json` validates;
  also asserts each `episodeId` matches `show.episodes[].id`, every `dataUrl` file exists, and
  every event `actor` is a party id (except the deliberate `future_type` event).
- [X] T018 Create the app shell: `src/main.tsx` (imports `styles/tokens.css`, `styles/global.css`;
  `BrowserRouter basename={import.meta.env.BASE_URL}`; `<App/>`), `src/App.tsx` (loads show via
  `fetchShow` in a `ShowProvider` context `src/data/ShowContext.tsx` exposing `{ show, error }`;
  `Routes`: `/` → `HubPage`, `/ep/:id` → `EpisodePage`, `*` → `NotFoundPage`; placeholder
  header slot), `src/components/SystemNotice/SystemNotice.tsx` + `.module.css` (blue System box
  with mono caps label "SYSTEM" and children; `tone: 'system' | 'error'`), `src/pages/NotFoundPage.tsx`
  (System voice copy + `Link` to `/`), stub `src/pages/HubPage.tsx` and `src/pages/EpisodePage.tsx`
  that render their name, `src/test/setup.ts` (`@testing-library/jest-dom/vitest`),
  `src/test/fixtures.ts` (tiny in-memory `Show` with 3 episodes across 2 floors and an
  `EpisodeData` with ~12 events incl. clustered achievements, a low-HP event, a sponsor, a chapter,
  a map reveal, and an unknown type). `npm run dev` shows the stub pages; `npm test` passes.

**Checkpoint**: `typecheck`, `lint`, `test`, `build` all green. Engine invariants proven by tests.

---

## Phase 3: User Story 1 — Watch an episode with a synchronized System feed (Priority: P1) 🎯 MVP

**Goal**: Episode page plays the YouTube embed with party rail and event feed that are a pure
function of the playhead; correct after any seek.

**Independent Test**: `npm test` (EpisodePage test with `FakeTimeSource`) + manual: `/ep/1`
play/pause/seek per quickstart steps 1–2; `/ep/1?fake=1` scrubs without network.

- [X] T019 [P] [US1] Create `src/playback/loadYouTubeApi.ts` (idempotent loader returning
  `Promise<typeof YT>`; injects `https://www.youtube.com/iframe_api` once; chains any existing
  `window.onYouTubeIframeAPIReady`; rejects after 15 s) and `src/playback/YouTubeTimeSource.ts`
  per research R4 (constructor `(container: HTMLElement, videoId: string, opts?: { onReady?: () => void })`;
  250 ms polling while PLAYING; single tick on PAUSED/BUFFERING/CUED; `onEnded` on ENDED;
  `seek` → `seekTo(t, true)` + immediate tick; `destroy` idempotent). These are the ONLY files
  allowed to reference `YT`.
- [X] T020 [P] [US1] Create `src/components/PartyRail/PartyRail.tsx`, `CrawlerFrame.tsx`, `HpBar.tsx`,
  `StatusPips.tsx`, `PartyRail.module.css`: 5-up grid (`repeat(auto-fit, minmax(0,1fr))`, wraps to
  3+2 under 640 px), frame = panel bg, hairline border, portrait 40 px round, name, "Lv N",
  HP bar (`transition: width 400ms ease`, fill `--hp`, or `--danger` when `danger`), `data-danger`
  → border `--danger` + `@keyframes dangerFlash` 600 ms, `data-levelup` → `@keyframes levelPulse` 1.2 s,
  status pips as small rounded chips. No `onClick`, `cursor: default`, no hover styles. Props: `frames: PartyFrame[]`.
- [X] T021 [P] [US1] Create `src/components/EventFeed/EventFeed.tsx`, `FeedItem.tsx`, `SponsorSlot.tsx`,
  `EventFeed.module.css`: header row "Event feed · synced {mm:ss}" (`--text-3`), optional pinned
  `SponsorSlot` (brand-deep bg, brand-2 border, brand-fg text, mono caps "SPONSORED" label),
  then items newest first: `system_message` as System box (`--system-bg`/`--system-fg`, mono caps
  "THE SYSTEM" prefix), `sponsor` as purple slot, others as panel items with a colored category
  label (`Loot` `--label-loot`, `Rank` `--label-rank`, `Map` `--label-map`, `Achievement` `--amber-fg`,
  `Level up` `--marker-levelup`, `Status`/`Inventory`/`Chapter` `--text-2`, `Note` `--text-4` muted)
  and the icon from `icons.tsx` where the wireframe shows one; footer line "scrubbing rewinds the feed".
  Text wraps; `min-width: 0`. Props: `items: FeedItem[]`, `sponsor: FeedItem | null`, `t: number`.
- [X] T022 [US1] Create `src/components/VideoStage/VideoStage.tsx`, `YouTubeStage.tsx`, `FakeStage.tsx`,
  `StageCaption.tsx`, `VideoStage.module.css`: 16:9 box (`aspect-ratio: 16/9`, panel-deep bg,
  hairline border, radius 8, `overflow: hidden`, `position: relative`), `YouTubeStage` mounts a
  div and creates a `YouTubeTimeSource` in `useEffect` (destroy on unmount / videoId change),
  calling `onSource(source)` up to the page; `FakeStage` (rendered only when `import.meta.env.DEV && searchParams.get('fake') === '1'`)
  shows a black box with a `<input type="range">` 0..durationSec, play/pause button, and a
  `FakeTimeSource`; `StageCaption` bottom-left "Ep {n} · Floor {n} · {time}" in `--text-2` 11–12 px;
  `children` slot for overlays (toast, minimap, ended card added in later stories). Props:
  `meta: EpisodeMeta`, `t: number`, `onSource: (s: TimeSource) => void`, `children?`.
- [X] T023 [US1] Implement `src/pages/EpisodePage.tsx` + `EpisodePage.module.css`: parse `:id`
  (non-integer/unknown → `NotFoundPage`); `fetchEpisode(meta)` with loading/`SystemNotice` error
  ("Feed unavailable…") while the stage still renders; hold `TimeSource` in state from
  `onSource`; `const { t, ended } = usePlayhead(source)`; compute `state = reduceTo(episode, t)`
  and selectors each render (no memo); layout per wireframe: desktop grid
  `minmax(0,1.9fr) minmax(0,1fr)` gap 10–12 px with left column = stage, (timeline slot), party
  rail; right column = feed; ≤ 900 px → single column stack: stage, timeline slot, rail, feed;
  page padding 12–16 px; no horizontal overflow (`min-width: 0` on grid children). Destroy the
  source on unmount.
- [X] T024 [US1] Create `src/pages/EpisodePage.test.tsx` (`// @vitest-environment jsdom`): stub
  `fetch` for show + episode using `src/test/fixtures.ts`; render `<MemoryRouter initialEntries={['/ep/1?fake=1']}>`
  with `import.meta.env.DEV` true in Vitest so `FakeStage` mounts, grab its `FakeTimeSource` via an
  exposed test hook (`data-testid="fake-stage"` + a module-level registry `__fakeSources` in
  `FakeStage.tsx` guarded by `import.meta.env.DEV`); assert: at t=0 rail shows initial HP text and
  feed is empty; `set(t)` past an hp event → HP text updates and `data-danger` appears for the
  low-HP crawler; `set` backward → feed item count shrinks and danger attribute clears; `set`
  forward past 10 events → feed shows exactly 8; for every fixture event `set(e.t - 0.001)` →
  its text is absent, `set(e.t)` → present (skip unknown type: must never appear); status pip
  appears then disappears. Add `npm test` to green.

**Checkpoint**: US1 independently demonstrable via `/ep/1` and `/ep/1?fake=1`; tests prove
time-truth invariants at the page level.

---

## Phase 4: User Story 2 — Navigate the broadcast archive (Priority: P2)

**Goal**: Hub page grouped by floor, persistent slim header with prev/next + dropdown + links,
ended-state next-episode card, not-found handling.

**Independent Test**: `/` groups episodes; header arrows/dropdown navigate; arrows hidden at
ends; ended card navigates; `/ep/999` shows System not-found.

- [X] T025 [P] [US2] Create `src/hooks/useScrolled.ts` (`useScrolled(threshold = 8): boolean`
  via passive scroll listener) and `src/components/SiteHeader/SiteHeader.tsx`, `EpisodesMenu.tsx`,
  `SiteHeader.module.css`: sticky top, height `--header-h` → `--header-h-compact` with
  `transition: height 200ms` when scrolled, canvas bg with hairline bottom border; left = mark
  (`/img/dcc-mark.svg`, 22 px) + "Dungeon Crawl Cast" (brand-fg) + "System feed" pill (system
  pill colors, `IconBroadcast`) linking to `/`; center (only when an episode is active, passed as
  `current?: EpisodeMeta`) = prev `Link` (`IconChevronLeft`, `aria-label` from copy, omitted when
  no prev), "S{season} · Floor {n} · Episode {n}", next `Link` (omitted when no next); right =
  `EpisodesMenu` (`<details>`/`<summary>` "Episodes" with floor-grouped `Link` lists, closes on
  navigation) + YouTube + Discord external links (`rel="noopener noreferrer"`). ≤ 640 px: hide
  the show title and right links, keep mark + episode label + an `IconMenu` `<details>` that
  contains the episodes list and the two links. Props: `show: Show`, `current?: EpisodeMeta`.
- [X] T026 [P] [US2] Implement `src/pages/HubPage.tsx` + `HubPage.module.css`: heading
  "Broadcast archive" (System voice, mono caps label "RECAP EPISODES"), sections per
  `episodesByFloor(show)` with floor label and a list of episode cards (title, "Ep N",
  `Link` to `/ep/N`), max-width ~960 px centered, panel cards with hairline borders.
- [X] T027 [P] [US2] Create `src/components/NextEpisodeCard/NextEpisodeCard.tsx` + `.module.css`:
  centered System-styled card over the stage (`position:absolute; inset:0; display:grid; place-items:center;`
  translucent canvas backdrop) with mono caps "SYSTEM" label, "Next recap episode →" `Link` to
  `/ep/{next.id}` showing the next title, or when `next` is undefined "Return to the broadcast
  archive" `Link` to `/`. Props: `next?: EpisodeMeta`.
- [X] T028 [US2] Wire `src/App.tsx`: render `SiteHeader` above routes with `current` derived from
  the location (`useMatch('/ep/:id')` + `findEpisode`), show `SystemNotice` error with a retry
  link if `show` failed to load, and make `NotFoundPage` also handle `/ep/:id` with unknown id
  (EpisodePage already delegates). Add `src/App.test.tsx` (jsdom): renders hub grouped by floor
  from the fixture; at `/ep/1` header shows "Episode 1" with no prev link and a next link to
  `/ep/2`; at `/ep/3` no next link; `/ep/999` shows the not-found copy.
- [X] T029 [US2] Add header + hub polish: `aria-current="page"` on the active episode in menus,
  skip-to-content link, `<main id="main">` wrapper in `App.tsx`, and document title updates
  (`document.title = `${episode.title} · Dungeon Crawl Cast`` in EpisodePage via `useEffect`; hub
  sets "Broadcast archive · Dungeon Crawl Cast").
- [ ] T030 [US2] (wave 3) Wire `NextEpisodeCard` into `EpisodePage.tsx`: render inside
  `VideoStage` children when `ended` is true with `next = prevNext(show, id).next`; extend
  `EpisodePage.test.tsx` with `fake.end()` → card visible with link to `/ep/2`, and on `/ep/3` the
  archive link.

**Checkpoint**: US1 + US2 together form a browsable site.

---

## Phase 5: User Story 3 — Jump to moments via the event timeline (Priority: P3)

**Goal**: Marker bar under the stage; hover labels; click seeks.

**Independent Test**: Markers at `t/durationSec`, colored by kind; tooltip on hover; click seeks
and overlay follows (assert via `FakeTimeSource.getTime()` in test).

- [ ] T031 [P] [US3] Create `src/components/EventTimeline/EventTimeline.tsx` + `.module.css`: 18 px
  tall track, 3 px hairline bar, elapsed fill `--brand-2` width `t/durationSec`, markers as 6×11 px
  rounded `<button>`s positioned `left: pos*100%` with `background: var(--marker-<kind>)`,
  `title` and `aria-label` = label, `onClick → onSeek(marker.t)`; keyboard focusable; `role="list"`
  semantics via `aria-label="Episode timeline"`. Props: `markers: Marker[]`, `t`, `durationSec`, `onSeek`.
- [ ] T032 [US3] Wire into `EpisodePage.tsx` between stage and rail (both layouts), `onSeek = (t) => source?.seek(t)`.
  Extend `EpisodePage.test.tsx`: markers count equals fixture chapters + achievements + level_ups;
  clicking a marker sets the fake source time to the marker `t` and the feed updates to that time.

**Checkpoint**: Timeline navigation works in both stage modes.

---

## Phase 6: User Story 4 — Stage moments: toasts, minimap, sponsors (Priority: P4)

**Goal**: 6 s FIFO achievement toast; non-interactive minimap badge; pinned active sponsor.

**Independent Test**: With `FakeTimeSource`: toast visible in [t, t+6), FIFO for clustered
achievements, gone after seek back; minimap cells revealed only after `map_reveal`; sponsor
pinned during its window only.

- [ ] T033 [P] [US4] Create `src/components/AchievementToast/AchievementToast.tsx` + `.module.css`:
  absolutely positioned top-left (8 px inset), System blue box (`--system-bg`/`--system-fg`), mono
  caps "NEW ACHIEVEMENT" label, title bold + desc, max-width 65%, fade-in 200 ms (no exit
  animation — it is removed when the selector returns null), `role="status"` `aria-live="polite"`.
  Props: `toast: Toast | null`.
- [ ] T034 [P] [US4] Create `src/components/MiniMapBadge/MiniMapBadge.tsx` + `.module.css`: bottom-right
  (8 px inset), 96×64 panel with hairline-2 border, header `IconMap` + "Floor {n}" (`--text-3` 11 px),
  grid `repeat(cols, 1fr)` of 1 px-gapped cells: unrevealed `--panel`, revealed `--brand-deep`, cells
  revealed within the last 5 s `--brand-2` (derived from events, pure), `pointer-events: none`,
  `aria-hidden` decorative plus an `sr-only` summary "{n} of {total} sectors revealed". Props:
  `cells: ReturnType<typeof mapCells>`, `recent: Set<string>`.
- [ ] T035 [US4] Wire toast, minimap, and pinned `activeSponsor` into `EpisodePage.tsx` /
  `VideoStage` children (sponsor pinned slot already supported by `EventFeed` props — pass
  `activeSponsor(events, t)`). Add `recentlyRevealed(events, t, windowSec = 5)` to
  `src/engine/selectors.ts` with a unit test. Extend `EpisodePage.test.tsx`: toast text at
  `t=60`, still at `65.9`, second toast at `66`, none after `78`; `set(59)` → no toast; minimap
  revealed count before/after a `map_reveal`; sponsor pinned at its `t`, not pinned at `t + durationSec`.

**Checkpoint**: Full v1 episode experience complete.

---

## Phase 7: User Story 5 — Convert an editor's sheet export into episode data (Priority: P5)

**Goal**: `npm run sheet-to-json` turns a CSV into schema-valid `ep{N}.json` with warnings.

**Independent Test**: Clean sample → valid JSON; broken sample → WARN lines naming rows, exit 0;
error sample → ERROR, exit 1, no file.

- [X] T036 [P] [US5] Create `scripts/samples/ep1.initial.json` (the five crawlers as in T015),
  `scripts/samples/ep1.csv` (header + ~30 rows covering every type per contracts/sheet-csv.md,
  timecodes as `mm:ss` and `hh:mm:ss`, a quoted field containing a comma), `scripts/samples/ep1-broken.csv`
  (clean rows + actor `ghost` row + `01:30:00` row + hp `999` row + a `mystery_type` row), and
  `scripts/samples/ep1-error.csv` (a row with timecode `abc`).
- [X] T037 [US5] Implement `scripts/sheet-to-json.ts`: parse args (`<csv> --episode N --duration S
  --initial-state path --out path`, `--help`), read CSV with `csv-parse/sync` (`columns: true,
  trim: true, skip_empty_lines: true`), validate header columns, `parseTimecode` (`h:mm:ss`,
  `mm:ss`, seconds), map rows → events per contract using a `rowToEvent(row, ctx)` function
  exported for tests, collect `warnings: string[]` and `errors: string[]` with `row N` (1-based
  data row), stable-sort by `t`, run `normalizeEpisode` from `src/data/validate.ts` on the result,
  write JSON (2-space) only if no errors, print `WARN`/`ERROR` lines to stderr and a summary to
  stdout, exit 1 on errors. Keep all logic in exported functions (`convert(csvText, ctx) →
  { episode, warnings, errors }`) with a thin `main()` guarded by `import.meta.url` check.
- [X] T038 [US5] Create `scripts/sheet-to-json.test.ts`: `convert` on the clean sample → 0
  errors, 0 warnings, events sorted, validates against `contracts/episode.schema.json` via ajv;
  broken sample → warnings include `row` numbers for `ghost`, the past-duration row, the hp 999
  row, and `mystery_type`, output still produced; error sample → errors non-empty and `episode`
  undefined; `parseTimecode` table test. Also run the CLI via `execFileSync('npx', ['tsx', ...])`
  once for the error sample to assert exit code 1 and no file written.

**Checkpoint**: Authoring pipeline proven; editors can produce real episode data.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Write `README.md`: what the site is (System voice one-liner), quickstart commands,
  data authoring flow, list of every placeholder to replace (video ids, links, portraits, Discord),
  deploy notes (Pages source = GitHub Actions), constitution pointer, and the v2/v3 fence.
- [ ] T040 [P] Accessibility + copy pass: every interactive element has a name; images have
  `alt` (portraits: crawler name); color contrast of `--text-3` on `--panel` ≥ 4.5:1 or bump
  token; `prefers-reduced-motion` honored; grep `src/` for forbidden words ("Dashboard", "Home",
  "Ads", "Advertisement") and fix; confirm no `cursor: pointer` on frames or minimap.
- [ ] T041 [P] Responsive verification at 400 px and 360 px in `EpisodePage.module.css`,
  `SiteHeader.module.css`, `PartyRail.module.css`, `EventFeed.module.css`: no element wider than
  the viewport (`overflow-x: hidden` on `body` is NOT an acceptable fix; find the cause), rail
  wraps 3+2, header collapses, feed text wraps.
- [ ] T042 Performance pass: verify `index.html` has no external fonts or blocking scripts, the
  YouTube API script loads only on episode pages, portraits are `loading="lazy"` except the first
  five, `dist/` JS ≤ 150 kB gzipped (React 19 + router + app; note the number in README); run
  Lighthouse manually per quickstart step 10 and record the score in `specs/001-watch-hub-v1/quickstart.md`
  under a "Results" heading (or note if Chrome is unavailable).
- [ ] T043 Final verification: `npm run typecheck && npm run lint && npm test && npm run build &&
  npm run preview` (smoke: curl `/` and `/ep/1` return 200 with the app shell; `dist/404.html`
  exists; `dist/_redirects` exists); walk quickstart steps 1–11 with `?fake=1` where the embed
  is not available; tick every item in spec.md §7 acceptance list by editing the handoff spec's
  checklist copy in `specs/001-watch-hub-v1/quickstart.md` "Results"; ensure every task above is
  `[X]` in this file.

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → {Phase 3, Phase 4 (T025–T029), Phase 7} in parallel → Phase 5 → Phase 6 + T030 → Phase 8**
- Within Phase 3: T019, T020, T021 [P] → T022 → T023 → T024.
- Within Phase 4: T025, T026, T027 [P] → T028 → T029; T030 waits for T023.
- Phase 5 and 6 edit `EpisodePage.tsx`/`EpisodePage.test.tsx`; run them after Phase 3 in one agent.
- Phase 7 is independent of all UI phases (depends only on Phase 2: `src/data/**`).

## Parallel Example: Wave 2

```text
Agent "episode":  T019 T020 T021 → T022 → T023 → T024
Agent "archive":  T025 T026 T027 → T028 → T029
Agent "pipeline": T036 → T037 → T038
```

## Implementation Strategy

1. Wave 1 builds the skeleton and proves the engine with tests (the constitution's core).
2. Wave 2 delivers the MVP (US1) while the archive (US2) and pipeline (US5) land alongside.
3. Wave 3 layers the broadcast flourishes (US3, US4) and the ended card.
4. Wave 4 polishes, verifies, and records acceptance results.

## Notes

- Agents MUST NOT run `git commit`; the orchestrator commits at wave boundaries.
- Mark tasks `[X]` in this file as they complete; append new copy keys to the end of `src/copy.ts`.
- Never import `YT` or `@types/youtube` outside `src/playback/{YouTubeTimeSource,loadYouTubeApi}.ts`.
- No memoization of `reduceTo`; no localStorage; no click handlers on crawler frames or minimap.

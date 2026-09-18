# Implementation Plan: DCC Watch Hub v1 ("System Feed")

**Branch**: `001-watch-hub-v1` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-watch-hub-v1/spec.md`; handoff spec
`/dcc-watch-hub-spec.md`; wireframe `/specs/001-watch-hub-v1/wireframe.html`

## Summary

Build a static, single-page React site where a YouTube episode plays inside a stage and every
overlay element (party rail, event feed, toasts, minimap badge, timeline, sponsor slot) is
rendered from `state(t) = reduce(initialState, events.filter(e => e.t <= t))`. Time flows only
through a `TimeSource` interface with one production adapter (`YouTubeTimeSource`) and one
deterministic fake for tests and a dev-only scrubber. A hub page and slim header navigate a
floor-grouped archive read from `show.json`. A Node script converts the editor's CSV export to
`ep{N}.json` with warnings. Ships with sample data, unit tests for the engine and converter, and a
CI workflow plus a GitHub Pages deploy workflow.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 20.9.0 (pinned in `.tool-versions`; asdf)  
**Primary Dependencies**: Vite 6.x, React 19, react-dom 19, react-router 7 (declarative mode),
`@vitejs/plugin-react` 4.x (Vite 7 / plugin-react 5 need Node ≥ 20.19 - excluded)  
**Dev Dependencies**: Vitest 3, `@testing-library/react`, `@testing-library/jest-dom`, jsdom,
ESLint 9 flat config + typescript-eslint + eslint-plugin-react-hooks, `tsx` (script runner),
`csv-parse` (used only by the script), `@types/youtube`, `ajv` (schema tests only)  
**Storage**: None. Static JSON under `public/data/` fetched at load  
**Testing**: Vitest (unit: reducer, selectors, show ordering, converter; component: episode page
driven by `FakeTimeSource`). Lighthouse run manually per quickstart  
**Target Platform**: Static hosting (GitHub Pages primary via Actions; Netlify/Cloudflare via
`_redirects`); current desktop Chrome/Firefox/Safari; mobile Safari/Chrome at ≥ 360 px  
**Project Type**: Single static web app + one CLI script  
**Performance Goals**: Lighthouse perf ≥ 90 on the episode page; overlay reflects a seek within
500 ms (tick at 250 ms); recompute-from-scratch per tick for ≤ ~500 events per episode  
**Constraints**: No backend, accounts, DB, audio; no UI framework; plain CSS Modules; no
blocking fonts (system font stack); nothing renders ahead of the playhead; YouTube referenced
only inside the adapter  
**Scale/Scope**: 1 show, tens of episodes, ~12 event types, 5 crawlers, 2 routes + not-found

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status (pre-design) | Status (post-design) |
|-----------|------|---------------------|----------------------|
| I. Time-Truth | Reducer pure; recompute on seek; nothing renders past playhead; unit tests for t=0 / mid / back / forward / no-early-render | PASS - `src/engine/` is pure TS with no React or DOM imports; toast queue and level-up pulse are derived from playhead, not imperative timers | PASS - data-model.md defines derived view models only; no stored overlay state |
| II. Host-Agnostic Playback | Components consume only `TimeSource`; fake exists; YouTube confined to adapter | PASS - `src/playback/YouTubeTimeSource.ts` is the only file importing `@types/youtube` globals; ESLint `no-restricted-imports`/`no-restricted-globals` rule blocks `YT` outside it | PASS - contracts/time-source.md fixed; dev scrubber uses `FakeTimeSource` |
| III. Ambient & Diegetic | Default view = stage + rail + ticker; System voice; no audio; no teasing | PASS - no click handlers on frames or minimap; copy lives in `src/copy.ts` for spot-check | PASS - the wireframe's "click a crawler" hint dropped |
| IV. Static, Dependency-Light | Static build; only React + router at runtime; no blocking fonts; unknown events ignored | PASS - runtime deps: react, react-dom, react-router. All else dev-only | PASS |
| V. Scope Discipline | No v2/v3 items; no premature optimization; FRs trace to spec | PASS - no memoization of reducer; no localStorage; no minimap interaction | PASS - dev-only `?fake=1` scrubber is a test affordance required by Principle II, tree-shaken from prod |
| VI. Author-Friendly Pipeline | Converter with warnings vs errors; sample CSV; broken-row test | PASS - `scripts/sheet-to-json.ts` shares `src/data/validate.ts` with the app | PASS - contracts/sheet-csv.md fixes column mapping |

No violations → Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-watch-hub-v1/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Entities, reducer transitions, derived view models
├── quickstart.md        # Run, test, deploy, and manual acceptance walkthrough
├── wireframe.html       # Design reference from the author
├── contracts/
│   ├── time-source.md   # TimeSource interface contract
│   ├── show.schema.json # JSON Schema for public/data/show.json
│   ├── episode.schema.json # JSON Schema for public/data/ep{N}.json
│   ├── sheet-csv.md     # Editor CSV → event mapping
│   └── routes.md        # URL contract and static-host fallback
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
.tool-versions                     # nodejs 20.9.0
package.json                       # scripts: dev, build, preview, typecheck, lint, test, sheet-to-json
vite.config.ts                     # base from VITE_BASE, plugin-react, test config (jsdom)
tsconfig.json / tsconfig.node.json
eslint.config.js
index.html                         # single entry; system font stack; no external fonts
.github/workflows/ci.yml           # typecheck + lint + test + build on push/PR
.github/workflows/deploy.yml       # build with VITE_BASE=/dcc-watch-hub/ and deploy to GitHub Pages

public/
├── data/show.json                 # sample show (2 floors, 3 episodes)
├── data/ep1.json, ep2.json, ep3.json
├── img/crawlers/*.svg             # placeholder portrait busts (generated, monochrome)
├── img/dcc-mark.svg
└── _redirects                     # Netlify/Cloudflare SPA fallback

scripts/
├── sheet-to-json.ts               # CSV → ep{N}.json with warnings/errors (tsx)
├── postbuild.mjs                  # copies dist/index.html → dist/404.html (GH Pages fallback)
└── samples/ep1.csv, ep1-broken.csv

src/
├── main.tsx                       # BrowserRouter basename=import.meta.env.BASE_URL
├── App.tsx                        # routes: /, /ep/:id, *
├── copy.ts                        # every user-facing string (System voice)
├── styles/tokens.css              # color/spacing/type tokens from spec §6 + wireframe
├── styles/global.css
├── data/
│   ├── types.ts                   # Show, EpisodeMeta, EpisodeData, Crawler, Event union
│   ├── validate.ts                # runtime guards: isShow, isEpisodeData, isKnownEvent (shared with script)
│   ├── load.ts                    # fetchShow(), fetchEpisode(meta) resolving against BASE_URL
│   └── show.ts                    # orderedEpisodes(), prevNext(show, id), episodesByFloor(show)
├── engine/
│   ├── state.ts                   # OverlayState type + fromInitialState()
│   ├── reducer.ts                 # applyEvent(state, event) pure; reduceTo(episode, t)
│   ├── selectors.ts               # partyFrames, feedItems, activeToast, timelineMarkers, mapCells, activeSponsor, levelUpPulse, dangerFlash
│   └── time.ts                    # formatTime(sec) → mm:ss | h:mm:ss
├── playback/
│   ├── TimeSource.ts              # interface + createEmitter helper
│   ├── FakeTimeSource.ts          # deterministic; set/play/pause/end
│   ├── YouTubeTimeSource.ts       # IFrame API adapter (ONLY file touching YT)
│   ├── loadYouTubeApi.ts          # idempotent script loader → Promise<typeof YT>
│   └── usePlayhead.ts             # hook: subscribe to TimeSource → {t, playing, ended}
├── components/
│   ├── SiteHeader/ (SiteHeader.tsx, EpisodesMenu.tsx, *.module.css)
│   ├── VideoStage/ (VideoStage.tsx, YouTubeStage.tsx, FakeStage.tsx [dev only], StageCaption.tsx)
│   ├── AchievementToast/
│   ├── MiniMapBadge/
│   ├── NextEpisodeCard/
│   ├── EventTimeline/
│   ├── PartyRail/ (PartyRail.tsx, CrawlerFrame.tsx, HpBar.tsx, StatusPips.tsx)
│   ├── EventFeed/ (EventFeed.tsx, FeedItem.tsx, SponsorSlot.tsx)
│   └── SystemNotice/              # blue System box used for errors/not-found/feed unavailable
├── pages/
│   ├── HubPage.tsx                # EpisodeArchive grouped by floor
│   ├── EpisodePage.tsx            # loads ep data, owns TimeSource, composes layout
│   └── NotFoundPage.tsx
└── test/
    ├── setup.ts                   # jest-dom
    └── fixtures.ts                # tiny in-memory show + episode for tests

Tests are colocated: src/engine/reducer.test.ts, src/engine/selectors.test.ts,
src/data/show.test.ts, src/data/validate.test.ts, src/pages/EpisodePage.test.tsx,
scripts/sheet-to-json.test.ts, src/data/samples.test.ts (ajv: sample JSON vs contracts/*.schema.json)
```

**Structure Decision**: Single Vite project at the repo root (no `frontend/` nesting: there is no
backend). `src/engine/` and `src/data/` are framework-free TypeScript so the converter script and
tests import them directly. `src/playback/` isolates the host adapter. Components are one folder
each with a CSS Module.

## Complexity Tracking

No constitution violations to justify.

## Phase Outputs

- Phase 0: [research.md](./research.md) - all Technical Context unknowns resolved.
- Phase 1: [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md);
  `CLAUDE.md` updated to point here.
- Phase 2: `tasks.md` via `/speckit-tasks`.

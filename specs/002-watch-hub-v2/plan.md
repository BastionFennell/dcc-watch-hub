# Implementation Plan: DCC Watch Hub v2 ("Lean-Forward")

**Branch**: `002-watch-hub-v2` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-watch-hub-v2/spec.md`; v1 plan and code on `main`;
the author's official crawler sheet (reference only, not in repo).

## Summary

Add a right-rail **panel** system to the episode page (feed by default; a crawler **dossier** or
the expanded **floor map** on demand; full-screen overlay on phones), a **resume** card backed by
per-episode `localStorage`, and **rank sparklines** inside the dossier plus a party rank line in
the feed header. Extend the event model with `skill`, `class`, and `hotlist` events and optional
sheet fields on crawlers, end to end (types → reducer → selectors → converter → schema → samples).
Everything shown in a panel stays a pure function of the playhead; storage holds the playhead only.

## Technical Context

**Language/Version**: TypeScript 5 strict, Node 20.9.0 (unchanged)  
**Primary Dependencies**: unchanged (react 19, react-dom 19, react-router 7). No new runtime deps.  
**Storage**: `localStorage` for `{ episodeId, t, savedAt }` only, wrapped in try/catch  
**Testing**: Vitest (engine + page tests via `FakeTimeSource`); new: resume storage tests with an
in-memory `Storage` stub and a throwing stub  
**Target Platform**: unchanged  
**Project Type**: unchanged (single static web app + converter)  
**Performance Goals**: Lighthouse ≥ 90 kept; panel content recomputed per tick like the feed;
the map is one SVG (≤ 12×8 = 96 rects in samples; up to ~2 000 rects stays cheap)  
**Constraints**: no panel may cover the stage on desktop; one panel at a time; Escape/close/
re-trigger close it and return focus; no audio; diegetic copy; no v2-parked or v3 items  
**Scale/Scope**: +3 event types, +6 optional crawler fields, +5 components, +2 hooks, +1 storage
module, +6 selectors, ~+60 tests

## Constitution Check (v1.1.0)

| Principle | Gate | Pre-design | Post-design |
|-----------|------|------------|-------------|
| I. Time-Truth | Panels and sparklines derive from `reduceTo` + elapsed events; storage holds playhead only; resume recomputes overlay at restored t | PASS — new selectors are pure; `resume.ts` stores `{episodeId,t,savedAt}` | PASS — data-model §3 lists every derived model; no cached panel state |
| II. Host-Agnostic Playback | Resume seeks through `TimeSource.seek`; adapter gains a queued seek for the not-ready case, still behind the interface | PASS | PASS — contracts/time-source.md amended (seek before ready) |
| III. Ambient & Diegetic | Panels open only by click/keypress, close by explicit action, never cover the stage on desktop; ambient view unchanged; triggers get affordances now that they do something | PASS | PASS — hover/focus styles only on real triggers |
| IV. Static, Dependency-Light | No new deps; sparkline and map are inline SVG; storage optional | PASS | PASS |
| V. Scope Discipline | Only the four confirmed items; no stingers/roster/v3; sheet fields limited to what the log can keep current | PASS | PASS — research R6 lists sheet fields deliberately excluded |
| VI. Author-Friendly Pipeline | New event types get converter rows, schema branches, samples, tests in the same change | PASS | PASS — contracts/sheet-csv.md amended |

No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-watch-hub-v2/
├── plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/
│   ├── episode.schema.json   # v1 schema + skill/class/hotlist events + optional crawler fields
│   ├── panels.md             # panel state machine, keyboard, focus, mobile overlay
│   ├── resume-storage.md     # key, record shape, save/clear rules
│   ├── sheet-csv.md          # v1 mapping + the three new row types
│   └── time-source.md        # v1 contract + queued seek before ready
└── checklists/requirements.md
```

### Source Code (additions and edits; repository root)

```text
src/
├── copy.ts                          # + dossier/map/resume strings (append)
├── data/types.ts                    # + SkillEvent, ClassEvent, HotlistEvent, SkillEntry, CrawlerStats; Crawler optional fields
├── data/validate.ts                 # + normalize new events/fields
├── engine/state.ts                  # CrawlerState + skills, hotlist (seeded from initial)
├── engine/reducer.ts                # + skill, class, hotlist cases
├── engine/selectors.ts              # + crawlerHistory, crawlerDossier, rankSeries, mapLabels, hpSegments
├── playback/resume.ts               # loadResume/saveResume/clearResume (try/catch, key per episode)
├── playback/useResume.ts            # throttled save, pagehide, pause, unmount; clear on end; pending offer
├── playback/YouTubeTimeSource.ts    # queue seek until onReady
├── playback/FakeTimeSource.ts       # unchanged (seek works before play)
├── hooks/usePanel.ts                # Panel state, Escape (menu-first), focus return, body scroll lock ≤900
├── components/RailPanel/            # RailPanel.tsx (+css): titled frame with close, scroll body, overlay mode
├── components/CrawlerDossier/       # CrawlerDossier.tsx, HpSegments.tsx, RankSparkline.tsx (+css)
├── components/FloorMap/             # FloorMap.tsx (+css): SVG grid, labels, zoom/pan/fit
├── components/ResumeCard/           # ResumeCard.tsx (+css)
├── components/PartyRail/CrawlerFrame.tsx   # becomes a button trigger (aria-expanded, focus ring)
├── components/MiniMapBadge/MiniMapBadge.tsx # becomes a button trigger
├── components/EventFeed/EventFeed.tsx      # + party rank line in header
└── pages/EpisodePage.tsx            # panel state, rail switch, resume card, trigger wiring

scripts/sheet-to-json.ts             # + skill/class/hotlist rows
scripts/samples/*                    # + rows and initial-state sheet fields
public/data/ep{1,2,3}.json           # + sheet fields, skill/class/hotlist events, more crawler rank events
src/test/fixtures.ts                 # + the same for the page tests
```

**Structure Decision**: Keep the single-project layout. The panel system is a page concern
(`usePanel` + `RailPanel`), the two panel bodies are ordinary components fed by selectors, and
resume is a playback-layer concern so the page only sees `{ pending, rejoin, startOver }`.

## Complexity Tracking

None.

## Phase Outputs

- Phase 0: [research.md](./research.md) · Phase 1: [data-model.md](./data-model.md),
  [contracts/](./contracts/), [quickstart.md](./quickstart.md) · Phase 2: `tasks.md`.

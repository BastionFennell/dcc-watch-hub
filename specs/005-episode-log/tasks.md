---
description: "Task list for the broadcast log"
---
# Tasks: Broadcast log

## Waves
| Wave | Tasks | Agent |
|------|-------|-------|
| 1 | T501–T506 | one agent (engine + component + page + tests) |
| 2 | T507–T509 | one agent (docs, visual/a11y, verification) |

## Phase 1: Engine + preference
- [ ] T501 `src/engine/selectors.ts`: `FeedItem.actorId?` (set in `toFeedItem` for actor events); `logItems`, `logCounts`, `applyLogFilters` per `contracts/log.md`; tests (chronological, uncapped, never-early sweep, counts, filter combos incl. no-actor exclusion under an actor filter).
- [ ] T502 `src/prefs/logOpen.ts` + test (round-trip, missing, throwing storage).
- [ ] T503 Copy keys per contract (append at END of `src/copy.ts`).

## Phase 2: Component + page (US1, US2)
- [ ] T504 `src/components/EpisodeLog/{EpisodeLog.tsx, LogFilters.tsx, EpisodeLog.module.css}`: header bar with toggle (`aria-expanded`, `aria-controls`), throttled polite count, filters (type + crawler chips ≥ 32 px tall, `aria-pressed`, counts, Clear), bounded scrolling list (`max-height: 60vh` desktop, `50vh` phone) reusing `FeedItemView`/`SponsorSlot` with seek + share, `data-latest` accent, auto-follow + "Follow the broadcast" control (scroll math per research R2; `prefers-reduced-motion` → `behavior: auto`), empty states. Sheet-style section bar look (mono caps title) consistent with the record.
- [ ] T505 `src/components/EpisodeLog/EpisodeLog.test.tsx` per research R6 (jsdom; stub `scrollHeight`/`clientHeight`/`scrollTop` for follow tests; stub storage).
- [ ] T506 `src/pages/EpisodePage.tsx` (+css): render `<EpisodeLog>` after the grid (desktop full width under the rail; phone last), fed by `logItems(episode.events, t, party)`, `playing`, `onSeek`, `onShare` (the existing `useShare`), `initialOpen={loadLogOpen()}`, `onOpenChange={saveLogOpen}`; page tests: collapsed by default; pref opens it; rows equal elapsed at 200 and shrink on a backward seek; row click seeks the fake source; row share copies `?t=<row t>`; filters; opening the log keeps the stage node/rect and rail untouched (structural assertion).

## Phase 3: Polish
- [ ] T507 README ("Broadcast log" section: where, filters, follow, preference key) + quickstart URLs verified against `public/data/ep1.json`; test count and bundle size.
- [ ] T508 Headless Chrome 1440/500/360: collapsed bar under the rail; open log with filters wrapping; chip hit sizes ≥ 32 px; contrast (chips, counts, latest accent) ≥ 4.5:1 text; stage/rail rects unchanged on open (measured); Lighthouse a11y 100 with the log open (dev URL) and on the preview build; no horizontal scroll at 360 with the log open.
- [ ] T509 Final: gates green; SC-401..404 recorded under quickstart `## Results`; all tasks `[X]`.

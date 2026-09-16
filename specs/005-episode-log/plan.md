# Implementation Plan: Broadcast log

**Branch**: `005-episode-log` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

## Summary
Add a collapsible full-width `EpisodeLog` section below the party rail (desktop) / after the feed
(phone). Rows are the existing `FeedItemView`/`SponsorSlot` (seek + share) fed by a new
`logItems` selector (all elapsed known events, chronological). Filters (types × actors, with
elapsed counts from a `logCounts` selector) are per-visit component state; the open/closed state
is a persisted preference. Auto-follow scrolls to the newest row while playing unless the viewer
scrolled up. No data-model change; no new dependencies.

## Technical Context
Unchanged stack. New: `src/engine/selectors.ts` (`logItems`, `logCounts`, `applyLogFilters`),
`src/prefs/logOpen.ts` (tiny localStorage pref with try/catch), `src/components/EpisodeLog/**`
(`EpisodeLog.tsx`, `LogFilters.tsx`, `EpisodeLog.module.css`, tests), page wiring in
`EpisodePage.tsx` (+css), copy keys. Reuses `useShare` (already on the page) and `onSeek`.

## Constitution Check (1.2.1)
| Principle | Gate | Status |
|-----------|------|--------|
| I | Rows/counts derive from `events.filter(t ≤ playhead)` per render; the pref stores a boolean only | PASS |
| II | Seek via the page's `source.seek` | PASS |
| III | Collapsed by default; opens by click; remembered as a viewer preference; appends below, never covers | PASS |
| IV | No deps; no virtualization | PASS |
| V | Only the log; no markers/gallery | PASS |
| VI | No data change | N/A |

## Project Structure (additions)
```text
src/engine/selectors.ts           # + logItems(events, t, party): FeedItem[] (chronological, uncapped)
                                  # + logCounts(items): { byType: Record<EventType, number>; byActor: Record<string, number> }
                                  # + applyLogFilters(items, { types, actors }): FeedItem[]  (actor filter uses FeedItem.actorId — add actorId to FeedItem)
src/prefs/logOpen.ts              # loadLogOpen(): boolean; saveLogOpen(open)
src/components/EpisodeLog/EpisodeLog.tsx      # section: header bar (toggle button, count live region), filters, list, follow control
src/components/EpisodeLog/LogFilters.tsx      # type chips + crawler chips + Clear
src/components/EpisodeLog/EpisodeLog.module.css
src/components/EpisodeLog/EpisodeLog.test.tsx
src/pages/EpisodePage.tsx         # renders <EpisodeLog> after the grid (desktop: full width; phone: after the feed via DOM order)
```
**Structure Decision**: one component folder; the page passes `items`, `party`, `t`, `playing`,
`onSeek`, `onShare`. `FeedItem` gains `actorId?` (engine change, additive) so actor filtering
does not depend on display names.

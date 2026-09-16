# Research: Broadcast log

## R1. Placement
- **Decision**: a full-width section after the two-column grid on desktop (fills the dead space
  under the rail), and last in the stacked phone layout. Collapsed bar by default (ambient
  principle); the open state is a persisted viewer preference (constitution I allows prefs).
- **Alternatives**: a rail panel (too narrow for filters + long rows); a dialog (covers the stage).

## R2. Order and follow
- **Decision**: chronological (oldest first). While `playing` and the viewer has not scrolled
  away (`scrollTop + clientHeight >= scrollHeight - 24`), new rows scroll into view via
  `scrollTo({ top: scrollHeight })` after render; scrolling up sets `following = false` and shows
  "Follow the broadcast"; activating it scrolls to the end and re-arms. On a backward seek the list
  simply shrinks; following is unaffected. Respect `prefers-reduced-motion` (no smooth scroll).
- **Alternatives**: newest-first like the feed (a transcript reads top-down).

## R3. Filters
- **Decision**: chips as `<button aria-pressed>`, two groups (Types, Crawlers) with per-chip
  elapsed counts from `logCounts(items)` (counts are computed on the unfiltered elapsed items so a
  viewer can see what else is available); combination = `(types.size === 0 || types.has(kind)) &&
  (actors.size === 0 || (actorId && actors.has(actorId)))`. Chips with a zero count are still
  shown but disabled? No — shown enabled but dimmed at 0 so the set is stable. `Clear` resets.
  State is component `useState` (per visit).
- **Type set**: every known type except `unknown`; labels from `copy.labels`.

## R4. Rendering rows
- Reuse `FeedItemView` and `SponsorSlot` with `onSeek`/`onShare` so rows behave exactly like the
  feed (seek button + sibling share button). Keys = `item.id` (event index; stable across seeks).
  Active row: the last elapsed row gets `data-latest` and a subtle left accent.

## R5. Live region cadence
- The header count is `aria-live="polite"`; to avoid a tick-rate announcement storm, the count
  text is updated through a `useThrottledValue(value, 1000)` hook (viewer notice cadence, not
  overlay state).

## R6. Tests
- Selectors: `logItems` chronological + uncapped + never-early sweep; `logCounts`; `applyLogFilters`
  combos (none, type, actor, both, no-actor events excluded under actor filter).
- Component: collapsed by default; toggle opens and persists (stubbed storage); rows render with
  time/category/text; chips toggle `aria-pressed` and filter; counts "N of M"; Clear; empty
  states (no events / no matches); follow control appears after scrolling up (stub scroll metrics);
  row seek and share callbacks.
- Page: log after the grid, opening it doesn't unmount/move the stage node; seek on row click
  moves the fake source; backward seek removes rows; the persisted pref opens it on mount.

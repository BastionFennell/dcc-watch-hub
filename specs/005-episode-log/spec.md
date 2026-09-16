# Feature Specification: Broadcast log (full episode log with filters)

**Feature Branch**: `005-episode-log`  
**Created**: 2026-09-15  
**Status**: Draft  
**Input**: UX review triage items 1.7 and 1.11, adopted by the author: "The feed is a rolling
window of roughly eight items — by 8:59 the entire cold open is unreachable. Add a scrollable
full log for the episode, filterable by event type and by crawler, with click-to-seek. All data
already exists; it's being discarded." and "Large empty region below the party row on every
episode page. Use it for the episode log."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the whole broadcast so far (Priority: P1)

Under the party rail, a collapsed "Broadcast log" bar shows how many moments have elapsed. The
viewer opens it and sees every elapsed event in order, oldest at the top and newest at the
bottom, each with its time, category, and text. Clicking a row seeks the broadcast to that
moment; each row also has a share action. The log never shows anything ahead of the playhead;
scrubbing back removes rows. The viewer's open/closed choice is remembered on this device.

**Acceptance Scenarios**:

1. **Given** the episode page at 9:00, **When** the viewer opens the log, **Then** it lists
   every known event with `t ≤ 9:00` in chronological order, with time, category, and text, and
   the bar reads the elapsed count.
2. **Given** the log is open, **When** the playhead moves back to 3:00, **Then** rows after
   3:00 disappear within 500 ms and the count updates.
3. **Given** a row at 2:34, **When** the viewer clicks it, **Then** playback seeks to 2:34 and
   the overlay follows; **When** they use the row's share action, **Then** the link carries
   `t=154` and nothing seeks.
4. **Given** the log is closed, **When** the page loads, **Then** only the collapsed bar is
   rendered (ambient default); **Given** the viewer opened it earlier on this device, **When**
   they reload, **Then** it opens automatically.
5. **Given** zero elapsed events, **When** the log is open, **Then** it shows the standby line.
6. **Given** the log is open and playing, **When** new rows arrive, **Then** the list follows
   the newest row unless the viewer has scrolled up; a "Follow the broadcast" control resumes
   following.

---

### User Story 2 - Filter by type and by crawler (Priority: P2)

Above the list, the viewer can toggle categories (system, achievement, loot, vitals, level up,
rank, map, sponsor, chapter, status, inventory, note, skill, class, hotlist, equip) and crawlers.
Each chip shows the elapsed count for that filter; chips with nothing elapsed yet are not shown. Filters combine as "any selected type AND any
selected crawler"; nothing selected means everything. A "Clear" action resets.

**Acceptance Scenarios**:

1. **Given** the log at 9:00, **When** the viewer selects "Achievement", **Then** only elapsed
   achievements remain, in order, and the bar count reads "N of M moments".
2. **Given** "Achievement" is selected, **When** the viewer also selects "Harry", **Then** only
   Harry's achievements remain; events without an actor are excluded when any crawler is selected.
3. **Given** filters are set, **When** the playhead moves, **Then** counts and rows update and
   the filters persist for the visit (not across reloads).
4. **Given** a filter yields nothing, **Then** the list shows "Nothing on the log matches."
5. **Given** the viewer activates "Clear", **Then** all chips deselect and the full log returns.

---

### Edge Cases

- Unknown event types never appear (as in the feed).
- Sponsor rows appear as purple slots in the log too; system messages as System boxes (reuse the
  feed row rendering).
- Very long episodes (hundreds of events): the list scrolls inside a bounded area (≈ 60 vh on
  desktop); no virtualization needed at v1 scale.
- Phone: the log sits after the feed at the end of the stacked page; filters wrap; chips ≥ 32 px tall.
- Opening the log must not move the stage, timeline, or rail.

## Requirements *(mandatory)*

- **FR-400**: A collapsible "Broadcast log" section MUST sit below the party rail on desktop
  (full width of the page) and after the feed on phones; collapsed by default; state remembered
  on this device (viewer preference only).
- **FR-401**: The log MUST list every known elapsed event (`t ≤ playhead`) chronologically,
  rendering each row like a feed row (time, category, text; System/sponsor styling) with
  click-to-seek and a share action; rows for the same second keep file order.
- **FR-402**: Filters MUST support multi-select by type and by crawler with elapsed counts per
  chip, combined as type-any AND crawler-any, plus Clear; filter state is per visit.
- **FR-403**: The section header MUST show the elapsed count and, when filtered, "N of M".
- **FR-404**: The list MUST auto-follow the newest row while playing unless the viewer scrolled
  away; a "Follow the broadcast" control MUST restore following.
- **FR-405**: All content MUST be a pure function of the playhead; opening the log MUST NOT
  shift the stage or rail (it appends below).
- **FR-406**: Keyboard: chips are toggle buttons with `aria-pressed`; rows are buttons; the
  section is a labelled region with a heading; the count updates in a polite live region no more
  than once per second.

### Key Entities

- **Log row (derived)**: a `FeedItem` (existing) — the log is `feedItems(events, t, ∞, party)` in
  chronological order.
- **Log filters (viewer state)**: `{ types: Set<EventType>; actors: Set<string> }`.
- **Log open (persisted preference)**: boolean under `dcc-watch-hub:prefs:v1:log-open`.

## Success Criteria *(mandatory)*

- **SC-401**: At every event boundary in a scripted sweep (forward and back) the log's row set
  equals the elapsed known events; never a future row.
- **SC-402**: Filters produce exactly the expected subsets and counts for the fixture at 200.
- **SC-403**: Row click seeks; row share copies the row's link; opening the log leaves the stage
  and rail rects unchanged (measured).
- **SC-404**: Lighthouse accessibility 100 with the log open; no horizontal scroll at 360 px;
  all prior tests pass.

## Assumptions

- The rolling 8-item feed stays as the ambient ticker; the log is the deep view.
- Chronological order (oldest first) for the log, unlike the feed, because it is read as a
  transcript; the follow control handles "where is now".
- No virtualization at v1 scale (≤ ~500 events per episode).

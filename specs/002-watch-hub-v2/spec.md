# Feature Specification: DCC Watch Hub v2 ("Lean-Forward")

**Feature Branch**: `002-watch-hub-v2`  
**Created**: 2026-09-15  
**Status**: Draft  
**Input**: User description: "Continue to the next milestone: the v2 items parked in the handoff
spec - click-open character sheets (inventory / skills / history), an interactive minimap with pan
and labels, resume where you left off (localStorage), and per-crawler fame/rank sparklines.
Stinger sounds and the roster page stay parked until real audio and art exist." Reference: the
author supplied the official Dungeon Crawler Carl RPG character sheet (Renegade Game Studios;
kept out of the repo). The dossier borrows its vocabulary and section order, not its artwork.

Builds on v1 (`specs/001-watch-hub-v1/`): the ambient view (stage, party rail, feed, timeline,
toasts, badge, sponsors, header, archive, converter) is unchanged unless stated below.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a crawler's dossier (Priority: P1)

A viewer clicks (or keyboard-activates) a crawler frame in the party rail. The right rail swaps
the event feed for that crawler's System dossier, laid out like the official crawler sheet:
header (portrait, name, handle, player, race, pronouns, crawler number, level, class, floor),
vitals (a ten-segment HP bar, rank with sparkline, debuffs), stats when known, then Hotlist,
Skills, Inventory, Achievements, and a history of that crawler's moments - all exactly as of
the playhead. Scrubbing backward while
the dossier is open removes items the crawler has not yet earned. A close control (or Escape,
or clicking the same frame again) returns the feed. Clicking a different frame switches
dossiers. On a phone the dossier is a full-screen panel over the stacked layout.

**Why this priority**: The single most requested "lean-forward" feature; every other v2 item
either lives inside it (sparklines) or shares its panel mechanics (map).

**Independent Test**: With the dev scrubber, open a dossier at t, verify every section against
the event log ≤ t, scrub back, verify items disappear, press Escape, verify the feed returns.

**Acceptance Scenarios**:

1. **Given** the episode page at playhead t, **When** the viewer clicks Harry's frame, **Then**
   the right rail shows Harry's dossier with level, HP, statuses, rank, inventory, skills,
   achievements, and history as of t, and the feed is hidden.
2. **Given** Harry's dossier is open at 8:00 showing "Enchanted Crowbar" (looted at 7:42),
   **When** the viewer seeks to 7:00, **Then** the crowbar is no longer listed.
3. **Given** a dossier is open, **When** the viewer presses Escape, clicks the close control, or
   clicks the same frame, **Then** the feed returns and focus goes back to that frame.
4. **Given** Harry's dossier is open, **When** the viewer clicks X.O.'s frame, **Then** the
   dossier switches to X.O. without closing.
5. **Given** a crawler has no rank events yet, **When** the dossier renders, **Then** the rank
   reads "Unranked" and no sparkline is drawn.
6. **Given** a crawler frame, **When** the viewer hovers or focuses it, **Then** it shows an
   affordance (pointer cursor, subtle highlight) and exposes `aria-expanded`.
7. **Given** a phone-width viewport, **When** a dossier opens, **Then** it covers the viewport
   as a panel with a visible close control and the page behind does not scroll.
8. **Given** any dossier, **When** the playhead advances past a level-up, loot, or status event
   for that crawler, **Then** the dossier updates within 500 ms without closing.

---

### User Story 2 - Explore the floor map (Priority: P2)

A viewer clicks the minimap badge. The right rail (or, on a phone, a full-screen panel) shows
the expanded floor map: a larger grid of sectors, revealed sectors tinted, each revealed
neighborhood labeled at its center, sectors revealed in the last few seconds highlighted. The
viewer can zoom in and out and drag to pan when the map is larger than its panel, and reset to
fit. Nothing unrevealed at the playhead is shown or labeled. Closing returns the feed.

**Why this priority**: The map is the show's spatial story; v1 only teased it as a badge.

**Independent Test**: Open the map at t, count revealed cells and labels against the log ≤ t,
scrub back, verify labels vanish, zoom and pan, press fit, close.

**Acceptance Scenarios**:

1. **Given** the badge, **When** the viewer clicks it, **Then** the expanded map opens in the
   right rail with the floor label, grid, revealed sectors, and neighborhood labels as of t.
2. **Given** map reveals at 3:40 ("The Meat District") and 12:10 ("The Rot Market"), **When**
   the playhead is 10:00, **Then** only "The Meat District" is labeled; at 12:10 both are.
3. **Given** the expanded map, **When** the viewer zooms in twice, **Then** the grid scales and
   can be dragged; **When** they press "Fit", **Then** it returns to fit the panel.
4. **Given** the expanded map is open, **When** a reveal event elapses, **Then** its cells
   appear highlighted for five seconds, then settle to the revealed tint.
5. **Given** the expanded map, **When** the viewer presses Escape or the close control,
   **Then** the feed returns and focus goes back to the badge.
6. **Given** the badge, **When** the viewer hovers it, **Then** it shows an affordance; it is
   keyboard-focusable and announces "Floor N - open the floor map" (its visible text plus the action, so the name matches the label).
7. **Given** the map and a dossier, **When** one opens, **Then** the other closes (one panel).

---

### User Story 3 - Resume where you left off (Priority: P3)

A viewer leaves an episode partway (closes the tab, navigates away, refreshes). When they open
that episode again, a System-styled card over the stage offers to rejoin the broadcast at the
saved time or start from the beginning. Choosing rejoin seeks the video there and the overlay
is already correct for that moment. Positions are remembered per episode on that device only.
Finishing an episode clears its saved position.

**Why this priority**: Episodes are long; losing your place is the top reason to give up on a
watch-along. Independent of the panels.

**Independent Test**: Play to 2:00, reload, verify the card offers 2:00, rejoin, verify the
playhead and overlay; play to the end, reload, verify no card.

**Acceptance Scenarios**:

1. **Given** the viewer watched episode 1 to 2:00 and left, **When** they reopen episode 1,
   **Then** a card offers "Rejoin at 2:00" and "Start from the beginning".
2. **Given** the card, **When** the viewer chooses rejoin, **Then** playback seeks to 2:00 and
   the party rail and feed show the state at 2:00 within 500 ms.
3. **Given** the card, **When** the viewer chooses start over, **Then** playback stays at 0:00
   and the saved position is discarded.
4. **Given** a saved position under 30 seconds or within the last 30 seconds of the episode,
   **When** the episode opens, **Then** no card is shown.
5. **Given** the viewer watches to the end, **When** they reopen the episode, **Then** no card
   is shown (finishing clears the position).
6. **Given** the browser blocks storage (private mode, disabled), **When** the episode opens
   and plays, **Then** nothing breaks and no card ever appears.
7. **Given** a saved position for episode 1, **When** episode 2 opens, **Then** no card is
   shown for episode 2 (positions are per episode).
8. **Given** playback is in progress, **When** the viewer navigates to another episode or
   closes the tab, **Then** the position saved is within 5 seconds of where they were.

---

### User Story 4 - Read a crawler's rank history (Priority: P4)

Inside a dossier, a sparkline shows how the crawler's rank has moved over the episode so far:
each rank event up to the playhead is a point, with better (lower) ranks drawn higher, and the
current and best rank so far shown as numbers. The party's rank gets the same treatment at the
top of the feed header area.

**Why this priority**: Adds narrative texture to the dossier; cheap once the dossier exists.

**Independent Test**: Open a dossier with three rank events elapsed; count three points; scrub
back to one; verify one point and the numbers update.

**Acceptance Scenarios**:

1. **Given** Harry has rank events 4188 → 3012 → 3550 by t, **When** his dossier renders,
   **Then** the sparkline has three points, the second highest on the chart, current reads
   #3550 and best reads #3012.
2. **Given** the playhead moves before the second event, **When** the dossier renders,
   **Then** the sparkline has one point and current and best both read #4188.
3. **Given** a crawler with no rank events, **When** the dossier renders, **Then** no chart is
   drawn and the rank reads "Unranked".
4. **Given** party rank events, **When** the feed renders, **Then** a small party rank line
   with current rank appears in the feed header; with none, it is omitted.
5. **Given** the sparkline, **When** an assistive technology reads it, **Then** it gets a
   text summary ("Rank moved from #4188 to #3550 across 3 updates; best #3012").

---

### Edge Cases

- Dossier open when the episode data fails to load: the panel shows the feed-unavailable notice.
- Dossier open when the viewer navigates to another episode: the panel closes; the new episode
  opens ambient.
- Two panels requested at once (click frame, then badge): last request wins; one panel visible.
- Expanded map with a 1×1 grid or an empty reveal set: renders the grid with no labels.
- A label whose cells are not contiguous: label sits at the centroid of that event's cells.
- Two reveals share a label: one label, at the centroid of the union.
- Resume saved time greater than the episode duration (data changed): treat as no saved position.
- Storage quota errors on save: ignore silently; never surface to the viewer.
- Escape pressed while the Episodes menu is open: closes the menu, not the panel; a second
  Escape closes the panel.
- Very long inventories or histories: the panel scrolls internally; the stage never moves.
- New event types (`skill`, `class`) in old data files: absent is fine; old converters and pages
  ignore them per FR-006.

## Requirements *(mandatory)*

### Functional Requirements

**Panels (shared by US1 and US2)**

- **FR-100**: The right rail MUST host exactly one of: the event feed (default), a crawler
  dossier, or the expanded map. Opening a panel replaces the feed; closing restores it.
- **FR-101**: Panels MUST open only from an explicit click or keypress on their trigger, MUST
  close on the close control, Escape, or re-activating the same trigger, and MUST return focus
  to the trigger on close.
- **FR-102**: On desktop a panel MUST NOT cover the video stage. At ≤ 900 px a panel MUST
  present as a full-viewport overlay with a close control and MUST lock page scroll behind it.
- **FR-103**: Panel content MUST be a pure function of the playhead; scrubbing in either
  direction while open MUST update it within 500 ms.
- **FR-104**: Panel triggers (crawler frames, minimap badge) MUST show hover and focus
  affordances, a pointer cursor, `aria-expanded`, and an accessible name.

**Crawler dossier (US1)**

- **FR-110**: The dossier MUST show, in this order (mirroring the official sheet): a header with
  portrait, name, handle, player, race, pronouns, crawler number, level, class (or "Unclassed"),
  and floor; vitals with a ten-segment HP bar (10%..100%, red through green) plus current/max,
  current rank (or "Unranked") with the sparkline, and debuffs (statuses); a stats row (STR, INT,
  CON, DEX, CHA) when the data provides one; Hotlist entries as of t; Skills as of t (name and
  rank); Inventory as of t; Achievements earned as of t (title, description, time); and a
  history list of that crawler's elapsed events newest first (hp, loot, inventory, level,
  status, achievement, skill, class, hotlist, rank). Sections with nothing to show render a
  one-line System empty state rather than disappearing.
- **FR-111**: The dossier MUST be styled as a System document (mono caps section labels,
  System blue header) and MUST use the System voice for empty states.
- **FR-112**: Three new event types MUST be supported end to end (types, reducer, feed label,
  converter, schema, samples): `skill` `{ actor, name, rank?, desc? }` adds a skill or updates
  its rank; `class` `{ actor, class }` sets the crawler's class; `hotlist` `{ actor, add[],
  remove[] }` edits the crawler's Hotlist. All three appear in the feed and history.
- **FR-113**: The crawler record in episode data MUST accept optional sheet fields - `race`,
  `pronouns`, `crawlerNumber`, `stats { str, int, con, dex, cha }`, `hotlist[]`, `skills[]`
  (`{ name, rank? }`) - and existing v1 files without them MUST keep working. The converter's
  `--initial-state` file carries them; no new CSV columns.

**Expanded map (US2)**

- **FR-120**: The expanded map MUST render the floor grid with revealed sectors as of t, cells
  revealed within the last 5 s highlighted, and one label per distinct reveal label placed at the
  centroid of its cells, all limited to events ≤ t.
- **FR-121**: The map MUST support zoom in/out (buttons and keyboard +/−), drag-to-pan when
  zoomed beyond the panel, and a "Fit" reset. Zoom and pan are viewer state, not overlay state,
  and reset when the panel closes.
- **FR-122**: The badge MUST remain the ambient, non-expanded view and MUST become the map's
  trigger (button semantics), keeping its non-interactive look until hovered or focused.

**Resume (US3)**

- **FR-130**: The site MUST save the playhead per episode on this device while playing (at
  most every 5 s), on pause, on navigation away, and on page hide; it MUST clear the saved
  position when playback ends or the playhead is within the last 30 s.
- **FR-131**: On opening an episode with a saved position ≥ 30 s, the site MUST show a
  System-styled card over the stage offering to rejoin at that time or start from the beginning;
  no card otherwise. The card MUST not block the stage controls (it dismisses on either choice).
- **FR-132**: Rejoining MUST seek playback to the saved time; the overlay MUST be correct for
  that time within 500 ms. Starting over MUST discard the saved position.
- **FR-133**: Storage MUST hold only `{ episodeId, t, savedAt }`; never overlay state. Storage
  failures MUST be silent and MUST NOT affect playback.

**Rank sparklines (US4)**

- **FR-140**: The dossier MUST draw an inline sparkline of the crawler's rank events ≤ t (better
  rank higher), with current and best-so-far numbers, and an accessible text summary; omitted
  with no rank events.
- **FR-141**: The feed header MUST show the party's current rank when any party rank event has
  elapsed, omitted otherwise.

**Unchanged constraints** (v1 FR-001..FR-006, FR-060..FR-084 still apply): static delivery,
schema contracts (extended, not broken), diegetic copy, colors, no audio, no webfonts,
Lighthouse ≥ 90, desktop browsers and phone widths.

### Key Entities

- **Panel (viewer state)**: `none | { kind: 'dossier', crawlerId } | { kind: 'map' }`; not
  persisted; resets on episode change.
- **Crawler dossier (derived)**: everything in FR-110 computed from `reduceTo(episode, t)` plus
  the crawler's elapsed events.
- **Skill / Class / Hotlist events (new)**: see FR-112; the crawler's derived state gains
  `skills` and `hotlist` lists seeded from the optional initial fields (FR-113).
- **Map label (derived)**: `{ label, row, col }` centroid per distinct label from reveals ≤ t.
- **Map view (viewer state)**: `{ zoom, panX, panY }`; resets on close.
- **Rank series (derived)**: ordered `{ t, rank }` points ≤ t for a crawler or the party.
- **Resume record (persisted)**: `{ episodeId, t, savedAt }` under a per-episode key.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: Opening, switching, and closing dossiers works by mouse and keyboard; content at
  any playhead matches the event log ≤ t in 100% of scripted checks, including backward seeks.
- **SC-102**: The expanded map labels exactly the reveals ≤ t at every event boundary in a
  scripted sweep; zoom, pan, and fit function; close restores the feed.
- **SC-103**: A saved position ≥ 30 s produces the rejoin card; rejoining lands within 1 s of
  the saved time with a correct overlay; ending clears it; blocked storage never errors.
- **SC-104**: Sparklines plot exactly the elapsed rank events and expose a text summary.
- **SC-105**: All v1 acceptance items still pass (no regressions in the 188-test suite plus new
  tests), Lighthouse performance ≥ 90 on the episode page, no horizontal scroll at 360 px with a
  panel open.
- **SC-106**: The ambient view is visually unchanged with no panel open, except the new hover
  and focus affordances on triggers and the party rank line in the feed header.

## Assumptions

- "Hot list history" from the handoff is read as the crawler's chronological history of elapsed
  events; there is no separate "hot list" data.
- The official sheet has far more fields (evade, DR, mana, attacks, gear slots, pet, mount,
  deity, clubs, sponsors, abilities). v2 carries only what an edit-pass event log can plausibly
  keep current: identity, level, HP, class, rank, debuffs, stats, Hotlist, skills, inventory,
  achievements. The rest is not shown rather than shown stale.
- "Hot list history" in the handoff maps to the sheet's Hotlist section plus the history list.
- Resume is device-local only (no accounts, per v3 fence).
- The map has no crawler position data in the log, so it shows sectors and labels only.
- Panel placement in the right rail (rather than a modal) is chosen to keep the stage
  uncovered on desktop, per the ambient principle; phones get a full overlay because the rail
  is below the fold there.
- Sample data will gain skill and class events, additional crawler rank events (≥ 3 for at
  least two crawlers) and labeled reveals so every v2 story is testable.

## Out of Scope (still parked, do not build)

- Stinger sounds (opt-in toggle) and the roster page with commissioned art - need assets.
- v3: alternate video sources, live premiere sync, sponsor slot management, accounts.

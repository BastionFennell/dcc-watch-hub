# Feature Specification: DCC Watch Hub v1 ("System Feed")

**Feature Branch**: `001-watch-hub-v1`  
**Created**: 2026-09-14  
**Status**: Draft  
**Input**: User description: "Build v1 of the Dungeon Crawl Cast Watch Hub from the handoff spec
(`dcc-watch-hub-spec.md`) and wireframe (`specs/001-watch-hub-v1/wireframe.html`): a static
watch-along site where a YouTube episode plays with a synchronized, spoiler-safe overlay styled as
the in-fiction System's broadcast feed — party status, event ticker, achievement toasts, minimap
badge, sponsor slots, event-marked timeline, a site header with episode navigation, a hub page
listing episodes by floor, and an editor script that converts a sheet export into episode data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch an episode with a synchronized System feed (Priority: P1)

A viewer opens an episode page. The episode video plays in a stage area. Beneath the stage sit
five crawler frames (portrait, name, level, HP bar, status pips); to the right runs the System's
event feed. As the video plays, the frames and feed update exactly when the corresponding moment
happens in the video. If the viewer scrubs backward, the feed and frames rewind to what was true
at that point; if they scrub forward, everything catches up. Nothing about a future moment is ever
visible.

**Why this priority**: This is the product. Without synchronized, spoiler-safe overlay state
there is no watch hub; every other story decorates this one.

**Independent Test**: Load one episode page with its two data files, play, pause, seek back,
seek forward, and confirm the party rail and feed always match the playhead. Can be fully
tested with a scripted fake time source without the video host.

**Acceptance Scenarios**:

1. **Given** an episode page at playhead 0, **When** it renders, **Then** the party rail shows
   each crawler's initial level, HP, and (empty) statuses and the feed is empty.
2. **Given** playback reaches an HP event for a crawler, **When** the playhead passes that event's
   time, **Then** that crawler's HP bar animates to the new value within half a second, and the
   frame border flashes the danger color if HP is below 25% of max.
3. **Given** the playhead is at 20:00 with 12 events elapsed, **When** the viewer seeks to 5:00
   where only 3 events have elapsed, **Then** the feed shows only those 3 events and the party
   rail shows the state after exactly those 3 events.
4. **Given** the playhead is at 5:00, **When** the viewer seeks to 40:00, **Then** the feed shows
   the 8 most recent events at 40:00 (newest first) and the party rail reflects all events up to
   40:00.
5. **Given** any playhead position, **When** the overlay renders, **Then** no event whose time is
   later than the playhead is visible anywhere on the page.
6. **Given** a level-up event for a crawler, **When** the playhead passes it, **Then** that frame
   pulses once and shows the new level.
7. **Given** a status event adding "Poisoned" to a crawler, **When** the playhead passes it,
   **Then** a "Poisoned" pip appears on that frame; when a later status event removes it, the pip
   disappears.
8. **Given** the feed contains a system message and a sponsor event, **When** they render,
   **Then** the system message appears as a blue System box and the sponsor as a purple slot,
   each in the System's voice.
9. **Given** the page is refreshed mid-episode, **When** it reloads, **Then** the video and
   overlay both start from the beginning and remain consistent with each other.
10. **Given** the video host inserts an ad, **When** content time pauses, **Then** the overlay
    does not advance.

---

### User Story 2 - Navigate the broadcast archive (Priority: P2)

A viewer arrives at the site root and sees the broadcast archive: episodes grouped by floor.
They pick an episode. A slim, dark header persists on every page showing the season, floor, and
episode with previous/next arrows, an "Episodes" dropdown grouped by floor, and links to the
show's YouTube and Discord. When the current episode ends, a System-styled "Next recap episode →"
card appears over the stage.

**Why this priority**: Gets viewers into and between episodes. Required for the site to be
usable with more than one episode, but the single-episode experience (US1) stands without it.

**Independent Test**: Load the hub, confirm grouping by floor, click through to an episode,
use prev/next arrows and the dropdown, confirm the header hides arrows at the first/last
episode, and confirm the ended-state card appears and navigates.

**Acceptance Scenarios**:

1. **Given** the show data lists episodes across two floors, **When** the hub loads, **Then**
   episodes appear grouped under their floor labels in episode order, each linking to its page.
2. **Given** episode 3 of 7 is open, **When** the header renders, **Then** it reads
   "S1 · Floor {n} · Episode 3" with both a previous and a next arrow.
3. **Given** the first episode is open, **When** the header renders, **Then** the previous arrow
   is hidden; at the last episode the next arrow is hidden.
4. **Given** any page, **When** the viewer opens the Episodes dropdown, **Then** episodes are
   listed grouped by floor and choosing one navigates to it.
5. **Given** a non-final episode's video ends, **When** the ended state is reached, **Then** a
   System-styled card offering the next recap episode appears over the stage and clicking it
   opens the next episode; on the final episode, the card instead returns to the archive.
6. **Given** the viewer scrolls down an episode page, **When** the header is no longer at the top,
   **Then** it shrinks so the stage stays dominant.
7. **Given** a phone-width viewport, **When** the header renders, **Then** it collapses to the
   mark, the episode label, and a menu containing the episode list and links.
8. **Given** an episode id that does not exist, **When** its page is requested, **Then** the
   viewer sees a System-voiced "no such recap episode" message with a link to the archive.

---

### User Story 3 - Jump to moments via the event timeline (Priority: P3)

Under the stage is a thin timeline bar with colored markers for chapters, achievements, and
level-ups. Hovering a marker shows its label; clicking it seeks the video to that moment, and the
overlay follows.

**Why this priority**: Turns the overlay into navigation. Valuable, but the feed is usable
without it.

**Independent Test**: Load an episode, hover each marker for its tooltip, click one, confirm the
video seeks to the marker time and the overlay state matches.

**Acceptance Scenarios**:

1. **Given** an episode with chapter, achievement, and level-up events, **When** the timeline
   renders, **Then** each has a marker positioned at (event time ÷ episode duration) along the
   bar, colored by kind (boss, loot, achievement, level-up, story).
2. **Given** a marker, **When** the viewer hovers it, **Then** a tooltip shows the marker label.
3. **Given** a marker at 16:40, **When** the viewer clicks it, **Then** playback seeks to 16:40
   and within half a second the party rail and feed reflect state at 16:40.
4. **Given** the playhead moves, **When** the timeline renders, **Then** the elapsed portion of
   the bar is filled in brand purple up to the playhead.
5. **Given** a chapter event of an unknown kind, **When** the timeline renders, **Then** it is
   shown with the default story marker color rather than breaking the bar.

---

### User Story 4 - See stage moments: toasts, minimap, sponsors (Priority: P4)

While watching, an achievement pops a System-styled toast in the top-left of the stage for six
seconds; several achievements in quick succession queue and show one at a time. A small minimap
badge in the bottom-right of the stage shows which map cells have been revealed so far. Sponsor
events show as purple slots in the feed and as the currently active sponsor while their duration
lasts.

**Why this priority**: These are the broadcast flourishes that sell the fiction; they layer on
US1 and can ship after it.

**Independent Test**: Seek to just before an achievement, play, confirm the toast timing and
queueing; seek past a map reveal and confirm the badge cells update; seek backward and confirm
the badge and toast reset.

**Acceptance Scenarios**:

1. **Given** an achievement event at 5:00, **When** the playhead is between 5:00 and 5:06,
   **Then** a toast with the achievement title and description is shown top-left over the stage;
   at 5:07 it is gone.
2. **Given** three achievements at 5:00, 5:01, and 5:02, **When** playback runs, **Then** toasts
   show one at a time in order, each for six seconds, without overlapping.
3. **Given** the viewer seeks backward past an achievement that was shown, **When** the overlay
   renders, **Then** no toast is shown for it (and it will show again if the playhead re-crosses it).
4. **Given** map reveal events at 13:40 for cells (3,2) and (4,2), **When** the playhead passes
   13:40, **Then** those cells appear revealed in the minimap badge with the floor label; seeking
   before 13:40 hides them again.
5. **Given** the minimap badge, **When** the viewer hovers or clicks it, **Then** nothing happens
   and the cursor stays default.
6. **Given** a sponsor event at 15:00 lasting 20 seconds, **When** the playhead is between 15:00
   and 15:20, **Then** the sponsor is shown as the active sponsor slot pinned at the top of the
   feed; afterwards it remains in the feed as an ordinary purple sponsor item.
7. **Given** a `note` event, **When** it elapses, **Then** it appears only in the feed and never
   as a toast or timeline marker.

---

### User Story 5 - Convert an editor's sheet export into episode data (Priority: P5)

During the edit pass, the editor logs events in a spreadsheet with columns
`timecode, type, actor, field1, field2, field3`. They export it as CSV and run one command that
produces the episode data file and prints warnings for suspicious rows (unknown actor,
HP that changes without an HP event, a timecode past the episode's duration) without refusing to
produce output.

**Why this priority**: Required for real episodes to exist, but the site can be built and
tested against hand-written sample data first.

**Independent Test**: Run the converter on the sample CSV and confirm the output matches the
episode schema; run it on a CSV with a deliberately broken row and confirm the warning names the
row and the output is still produced.

**Acceptance Scenarios**:

1. **Given** the sample CSV, **When** the converter runs, **Then** it writes an episode data
   file whose events are sorted by time and conform to the episode schema.
2. **Given** a row whose actor is not in the party, **When** the converter runs, **Then** it
   prints a warning naming the row number and actor, and still writes the file.
3. **Given** a row whose timecode exceeds the episode duration, **When** the converter runs,
   **Then** it prints a warning and still writes the file.
4. **Given** a row whose timecode cannot be parsed, **When** the converter runs, **Then** it
   reports an error naming the row and exits without writing.
5. **Given** an event type the converter does not know, **When** it encounters it, **Then** it
   passes the row through as-is with a warning rather than dropping it.

---

### Edge Cases

- Two or more events share the same time: they apply in file order and all appear in the feed.
- An event references an actor not in the party: the reducer ignores the actor-specific part and
  the feed still shows the event text.
- An unknown event type: ignored by the reducer, omitted from feed, toast, and timeline; the
  page never crashes.
- HP event with `current` above `max` or below zero: clamp for display; never break the bar.
- Episode data file fails to load or is malformed: the stage still shows the video and the
  overlay shows a System-voiced "feed unavailable" notice; the header still works.
- Show data fails to load: hub and header show a System-voiced error with a retry link.
- Video unavailable or private: the host player shows its own error; overlay state stays at 0.
- `durationSec` disagrees with the real video length: timeline markers use `durationSec`;
  events later than the actual end simply never fire.
- Sponsor events overlap: the most recent one that is still within its duration is the active
  sponsor.
- Achievement toast queue exceeds what fits before the next seek: a seek clears the queue and
  it is rebuilt from the "within last 6 seconds of playhead" rule.
- Party has fewer or more than five crawlers: the rail lays out however many exist.
- Empty `revealed` map at start: badge shows an unrevealed grid with the floor label.
- Very long feed text: wraps inside its box; the feed never causes horizontal scroll.
- Phone width: stage, then party rail, then feed stack vertically with no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

**Time-truth and sync**

- **FR-001**: The overlay's displayed state MUST be fully determined by the episode's initial
  state plus the events whose time is less than or equal to the current playhead.
- **FR-002**: On any seek, forward or backward, the overlay MUST reflect the state at the new
  playhead within 500 ms.
- **FR-003**: No information from an event whose time is later than the playhead MAY be visible.
- **FR-004**: Playhead time MUST be content time (pauses during host ads and while paused).
- **FR-005**: All overlay components MUST obtain time through a single playback-time abstraction
  so that the video host can be swapped without changing the overlay.
- **FR-006**: Unknown event types MUST be ignored without error.

**Party rail**

- **FR-010**: The party rail MUST show, per crawler: portrait, name, level, HP bar with current
  and max, and status pips, all as of the playhead.
- **FR-011**: The HP bar MUST animate on change; the frame border MUST flash the danger color
  when HP is below 25% of max; the frame MUST pulse on level-up.
- **FR-012**: Clicking or hovering a crawler frame MUST do nothing and MUST NOT show a pointer
  cursor or any affordance.

**Event feed**

- **FR-020**: The feed MUST show the 8 most recent elapsed events, newest first, and drop items
  when the playhead moves before their time.
- **FR-021**: System messages MUST render as blue System boxes; sponsors as purple slots; loot,
  rank, map, achievement, level-up, HP, status, inventory, chapter, and note events as neutral
  panel items with a category label.
- **FR-022**: The active sponsor (a sponsor event whose duration includes the playhead) MUST be
  pinned at the top of the feed.
- **FR-023**: The feed header MUST show the synced playhead time as `mm:ss` (or `h:mm:ss` past
  an hour).

**Stage overlays**

- **FR-030**: An achievement toast MUST appear top-left over the stage for the 6 seconds after
  the achievement's time, one at a time, in first-in-first-out order when achievements cluster.
- **FR-031**: The minimap badge MUST show the map grid with cells revealed as of the playhead and
  the floor label, bottom-right over the stage, and MUST be non-interactive.
- **FR-032**: The stage MUST show a caption "Ep {n} · Floor {n} · {time}" bottom-left.
- **FR-033**: When the video ends, a System-styled card MUST offer the next recap episode (or
  the archive on the final episode).

**Timeline**

- **FR-040**: The timeline MUST place a marker at time ÷ duration for each chapter event and for
  each achievement and level-up event, colored by kind: boss, loot, achievement, level-up, story.
- **FR-041**: Hovering a marker MUST show its label; clicking it MUST seek playback to its time.
- **FR-042**: The bar MUST show elapsed progress up to the playhead.

**Header and navigation**

- **FR-050**: A persistent header at most 48 px tall MUST show: left, the DCC mark linking to the
  hub; center, "S1 · Floor {n} · Episode {n}" with previous/next episode links hidden at the
  ends; right, an "Episodes" dropdown grouped by floor plus YouTube and Discord links.
- **FR-051**: The header MUST shrink when the page is scrolled away from the top.
- **FR-052**: At phone widths the header MUST collapse to mark, episode label, and a menu.
- **FR-053**: The hub page MUST list episodes grouped by floor from the show data, each linking
  to its episode page.
- **FR-054**: Episode pages MUST be addressable as `/ep/{id}` and the hub as `/`.
- **FR-055**: An unknown episode id MUST show a System-voiced not-found message linking to the hub.

**Data and delivery**

- **FR-060**: The site MUST be deployable as static files with no server code; all episode data
  MUST come from one show-level JSON file and one JSON file per episode fetched at load.
- **FR-061**: Data files MUST conform to the `show.json` and `ep{N}.json` schemas in the handoff
  spec (Section 4).
- **FR-062**: Sample data for at least two episodes across two floors MUST ship with the site so
  every story can be exercised without real episode data.
- **FR-063**: The episode page MUST load and render on a static host with only the two data files.

**Authoring pipeline**

- **FR-070**: A command MUST convert a CSV with columns `timecode (hh:mm:ss), type, actor,
  field1, field2, field3` into a valid `ep{N}.json`.
- **FR-071**: The converter MUST warn (and still write output) on unknown actors, HP changes not
  backed by an HP event, and timecodes past the episode duration; it MUST error (and not write)
  on unparseable timecodes or missing required columns.
- **FR-072**: A sample CSV and a deliberately broken sample row MUST be included and covered by
  an automated check.

**Voice, visuals, and platform**

- **FR-080**: All user-facing copy MUST use the System's voice: "broadcast archive", "recap
  episode", "sponsor", never "dashboard", "home", or "ad".
- **FR-081**: Colors MUST follow the handoff spec Section 6 and the wireframe: canvas #131320,
  panel #1d1d28, hairline borders; System blue #0C447C/#B5D4F4; brand purple #3C3489/#534AB7
  with text #CECBF6/#EEEDFE; achievement amber #633806/#FAC775; danger #E24B4A; HP green
  #639922; marker colors loot #EF9F27, achievement #378ADD, boss #D4537E, level-up #5DCAA5.
- **FR-082**: Layout MUST match the wireframe: on desktop a two-column grid (stage column about
  1.9× the feed column) with the timeline and party rail under the stage; on phones a single
  stacked column: stage, timeline, party rail, feed.
- **FR-083**: No audio MAY play. No fonts MAY block first render.
- **FR-084**: The site MUST work on current desktop Chrome, Firefox, and Safari and on phone
  widths without horizontal scroll.

### Key Entities

- **Show**: Title, seasons → floors → ordered episode ids, the flat episode list, and external
  links. Source of header, hub, and prev/next ordering.
- **Episode (show-level entry)**: id, title, video id, floor, duration in seconds, and the path
  to its event data.
- **Episode Data**: the episode id, an initial state, and an ordered event log.
- **Initial State**: the party (crawlers), the party rank, and the map (floor, grid size,
  revealed cells).
- **Crawler**: id, name, handle, player, level, HP (current/max), portrait, class, inventory,
  rank; statuses (derived, empty at start).
- **Event**: time in seconds plus a type and type-specific fields; optional actor referencing a
  crawler id. Types: system_message, achievement, loot, hp, level_up, rank, map_reveal, sponsor,
  chapter, status, inventory, note. Unknown types are tolerated.
- **Overlay State (derived)**: the result of applying all elapsed events to the initial state;
  never stored, always recomputed.
- **View Models (derived)**: party frames, feed items, active toast, timeline markers, minimap
  cells, active sponsor.
- **Sheet Row**: one editor-logged line: timecode, type, actor, and up to three fields, mapped to
  one event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An episode page loads and shows a correct overlay from static hosting using only the
  show data file and that episode's data file.
- **SC-002**: Overlay state is correct at t=0, mid-episode, after seeking backward, after
  seeking forward, and after a mid-episode refresh, in 100% of scripted checks.
- **SC-003**: Zero events render before their time across the full scripted event log
  (verified automatically at every event boundary).
- **SC-004**: The party rail reflects HP, level, and status at the playhead within 500 ms of any
  seek.
- **SC-005**: Every timeline marker seeks to within 1 second of its event time.
- **SC-006**: The ended state shows the next-episode card; header previous/next navigate
  correctly across the whole ordering, with arrows hidden at both ends.
- **SC-007**: The hub lists 100% of episodes from the show data, grouped under the right floor.
- **SC-008**: Desktop Chrome, Firefox, and Safari play an episode with a working overlay; at a
  400 px wide viewport the page has no horizontal scroll and stacks stage, rail, feed.
- **SC-009**: The converter turns the sample CSV into schema-valid episode data and flags the
  deliberately broken row by row number.
- **SC-010**: Lighthouse performance score on the episode page is 90 or higher.
- **SC-011**: A reader of the page copy finds no non-diegetic labels (spot check of every
  visible string).

## Assumptions

- The real Dungeon Crawl Cast episodes, video ids, and portraits do not exist yet; the site
  ships with clearly labeled sample data (five sample crawlers matching the wireframe names,
  placeholder portraits, and a publicly embeddable placeholder video) so every story is testable.
  Replacing sample data with real data requires no code change.
- Crawler statuses start empty; the initial-state schema has no `status` field, so an empty
  list is assumed.
- A `rank` event with `scope: "party"` updates the party rank; with `scope: "crawler"` and an
  `actor` it updates that crawler's rank.
- "Refresh mid-episode" restarts both video and overlay from the beginning (no resume in v1).
- The wireframe's "N watching" audience counter and "Click a crawler for full sheet" hint are
  not in the handoff spec's v1 scope and are omitted; the footer hint would tease a v2 feature.
- Timeline markers for achievements and level-ups use the achievement and level-up colors; a
  chapter with an unknown kind uses the story color.
- Deploy target is any static host; the build emits a fallback so deep links to `/ep/{id}` work
  on hosts without rewrite rules.
- The spreadsheet's `field1..field3` map per event type as follows: system_message/note → text;
  achievement → title, desc; loot → item, source; hp → current, max; level_up → level; rank →
  scope, rank; map_reveal → cells (as `r,c;r,c`), label; sponsor → text, durationSec; chapter →
  label, kind; status → add (`;`-separated), remove; inventory → add, remove.
- Text sizes in the wireframe are illustrative of hierarchy, not literal pixel requirements;
  legibility on a phone takes precedence.

## Out of Scope (parked, do not build)

- v2: click-open character sheets, interactive minimap, localStorage resume, stinger sounds,
  roster page, per-crawler rank sparklines.
- v3: alternate video sources, live premiere sync, sponsor slot management, accounts.

# Feature Specification: Crawler Record (glance card + full record)

**Feature Branch**: `003-crawler-record`  
**Created**: 2026-09-15  
**Status**: Draft  
**Input**: Author: "I'm wondering if it would make sense to have a smaller more succinct side panel
view and maybe a popover for a full view of the character? Once we have a lot of achievements and
a full hotlist and etc. I feel like that side panel is going to feel messy." Agreed direction: the
rail shows a fixed-height glance card; a wide, modal full record mirrors the official sheet's
landscape layout. Tooltips/explanations are a later feature but the record must leave room for them.

Builds on v2 (`specs/002-watch-hub-v2/`): the panel system, dossier selectors, sparkline, HP
segments, map, and resume are unchanged unless stated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Glance at a crawler without leaving the broadcast (Priority: P1)

A viewer clicks a crawler frame. The right rail shows a compact, fixed-height glance card:
who they are, how they're doing right now (HP, rank, debuffs), what's newest in each list
with a count, and their last few moments. It reads in a couple of seconds and never scrolls
on a laptop screen. A single "Open full record" action leads to the complete sheet.

**Why this priority**: This is the view most viewers will use most of the time; it must stay
tidy no matter how long the episode's lists get.

**Independent Test**: With the dev scrubber at a late time in a sample episode, open a frame,
confirm every line against the event log, scrub back and confirm counts and "newest" items
change, confirm the card's height does not grow as lists grow.

**Acceptance Scenarios**:

1. **Given** Harry's frame is clicked at 9:20, **When** the rail renders, **Then** it shows the
   glance card: portrait, name, handle · player, class · level, ten-segment HP with numbers,
   rank current/best with the sparkline, debuff chips (or "No debuffs on record."), a ledger
   with one row per list (Hotlist, Skills, Inventory, Achievements) showing the count and the
   newest entry (achievements also show the time), the last three history moments, and a
   primary "Open full record" button.
2. **Given** the glance card is open, **When** the playhead moves before an item's time,
   **Then** that list's count decreases and its "newest" entry changes within 500 ms.
3. **Given** a crawler with 40 achievements and a 10-entry hotlist, **When** the card renders,
   **Then** it is the same height as for a crawler with none (lists never expand in the card).
4. **Given** the card, **When** the viewer presses Escape, clicks close, or clicks the same
   frame, **Then** the feed returns and focus goes to the frame (unchanged from v2).
5. **Given** a list is empty, **When** the ledger row renders, **Then** it shows the count 0
   and the System empty-state phrase instead of a newest entry.

---

### User Story 2 - Open the full record (Priority: P2)

From the glance card, the viewer opens the full record: a wide, modal dialog laid out like the
official sheet in landscape — identity and vitals across the top, stats, then columns for
Hotlist and Skills, Inventory and Achievements, and History. It keeps updating with the
playhead while open. Escape, the close control, or clicking the backdrop closes it and returns
focus to the "Open full record" button. On a phone it is a full-screen page with the same
sections stacked.

**Why this priority**: The deep view; valuable, but the glance card stands on its own.

**Independent Test**: Open the record at a late time, verify all sections, scrub while open,
verify updates, close by each method, verify focus return; at 400 px verify stacking.

**Acceptance Scenarios**:

1. **Given** the glance card, **When** the viewer activates "Open full record", **Then** a modal
   dialog titled with the crawler's name opens over the page with: identity header (portrait,
   name, handle, player, race, pronouns, crawler #, level, class, floor), vitals (HP segments,
   rank + sparkline, debuffs), stats when present, and the sections Hotlist, Skills, Inventory,
   Achievements, History in full.
2. **Given** the record is open, **When** the playhead passes a loot event for that crawler,
   **Then** the Inventory section and History update without the dialog closing or moving.
3. **Given** the record is open, **When** the viewer presses Escape, **Then** only the dialog
   closes; the glance card in the rail stays open and focus lands on "Open full record".
4. **Given** the record is open, **When** the viewer clicks the dimmed backdrop or the close
   control, **Then** the dialog closes the same way.
5. **Given** the record is open, **When** the viewer presses Tab repeatedly, **Then** focus
   cycles inside the dialog and never reaches the page behind it.
6. **Given** a ≤ 900 px viewport, **When** the record opens, **Then** it fills the viewport,
   sections stack in the sheet's order, the close control is visible at the top, and the page
   behind does not scroll.
7. **Given** the record is open, **When** the viewer navigates to another episode, **Then** the
   dialog closes.
8. **Given** the record is open, **When** the video keeps playing, **Then** playback is not
   paused, and the timeline/feed keep updating behind the dialog.

---

### Edge Cases

- Glance card for a crawler with no rank events: "Unranked", no sparkline, rank row still present.
- Newest-entry text longer than the row: single line, ellipsized, full text in the record.
- The record open while the panel is switched to the map (keyboard shortcut or click on the
  badge is impossible while modal; if the panel closes for any other reason — episode change,
  data reload — the record closes too).
- Resume card and record: the record cannot open before data loads, and the resume card only
  appears at start; if both exist, the record is above and answering the resume card is deferred.
- Very small heights (short laptop): the glance card may scroll as a last resort; the record
  always scrolls internally.

## Requirements *(mandatory)*

### Functional Requirements

**Glance card (US1)**

- **FR-200**: The rail dossier panel MUST become a glance card with exactly: header (portrait,
  name, handle · player, class · level), HP segments + numbers, rank current/best + sparkline (or
  "Unranked"), debuffs, a ledger of four rows (Hotlist, Skills, Inventory, Achievements) each with
  count and newest entry (achievement rows include the time), the last three history items, and
  one "Open full record" button.
- **FR-201**: The card MUST NOT grow with list length; at ≥ 1024 px height it MUST NOT scroll.
- **FR-202**: All card content MUST be a pure function of the playhead; counts and newest
  entries MUST reflect only events ≤ t.
- **FR-203**: Ledger rows MUST be static text (no interaction) in this feature; the only control
  is the "Open full record" button (and the panel's close).

**Full record (US2)**

- **FR-210**: The record MUST be a modal dialog (`aria-modal`, labelled by the crawler's name,
  focus trapped, initial focus on the close control, Escape/backdrop/close dismiss, focus
  returns to "Open full record"). The page behind MUST be inert to pointer and keyboard.
- **FR-211**: Layout MUST mirror the official sheet in landscape on desktop: a top band
  (identity + vitals + stats), then three columns (Hotlist + Skills | Inventory + Achievements |
  History) with the sheet's black section bars; ≤ 900 px stacks the same sections in order and
  fills the viewport.
- **FR-212**: Width MUST be `min(1200px, 94vw)`, height at most 90 vh with internal scroll; the
  backdrop dims the page. Opening MUST NOT pause playback; content MUST keep updating with the
  playhead.
- **FR-213**: The record MUST close on episode change and when the rail panel closes.
- **FR-214**: The record MUST reserve a consistent place for future per-item explanations
  (each list item is a distinct element with a stable structure), without adding tooltips now.

**Unchanged**: constitution I–VI; v2 FR-100..FR-104 (panels), FR-140 (sparkline). The rail
panel's kicker becomes "CRAWLER GLANCE" and the record's kicker "CRAWLER RECORD".

### Key Entities

- **Glance (derived)**: `{ identity, hp, rank, debuffs, ledger: { hotlist, skills, inventory,
  achievements } → { count, newest?: { text, t? } }, recentHistory: FeedItem[3] }` from the
  existing `Dossier`.
- **Record (viewer state)**: `crawlerId | null`; not persisted; closes with the panel or the episode.

## Success Criteria *(mandatory)*

- **SC-201**: The glance card height is identical for the fixture crawler with the most items
  and one with none (measured in a real browser); no scroll at 1440×900.
- **SC-202**: Every ledger count and newest entry matches the event log ≤ t at all event
  boundaries in a scripted sweep, forward and backward.
- **SC-203**: The record opens/closes by all three methods with focus trapped and returned;
  content updates live; playback state is unchanged by opening.
- **SC-204**: Lighthouse accessibility stays 100; no horizontal scroll at 360 px with the record open.
- **SC-205**: All prior tests pass; no v1/v2 behavior changes outside the dossier panel.

## Assumptions

- "Popover" in the author's message is read as a modal dialog: the sheet is landscape and the
  rail is narrow; a dialog is the only way to show columns without covering the stage
  permanently. The constitution was amended (1.2.0) to allow exactly this overlay.
- The record reuses the v2 dossier data (`crawlerDossier`); no new event types.
- Tooltips/explanations are parked; the record's item structure is prepared for them.

## Out of Scope

- Tooltips, per-item explanations, sheet fields beyond v2, deep links to a record, printing.

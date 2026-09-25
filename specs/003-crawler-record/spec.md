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
official sheet in landscape - identity and vitals across the top, stats, then columns for
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
  badge is impossible while modal; if the panel closes for any other reason - episode change,
  data reload - the record closes too).
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

---

# Revision 2 (2026-09-15) - author feedback after the first build

Author, on the glance card: "We don't need the skills list in the sideboard (the PCs will have a
ton of skills very quickly). Similar for inventory - better to just show equipped items. Maybe
instead of achievements we show the most recent achievement? What are the two dashes in history?"
On the record: "We'll need room for full character art on the sheet. Make the hotlist look like an
actual MMO hotlist. Similar feedback for skills, inventory, achievements, etc. - maybe those can
be expanded into a different list view?"

The dashes were placeholder rows keeping the card's height fixed; they are removed (R2-FR-201).

## R2 User Story 1 - The glance card shows what matters right now (P1)

**Acceptance Scenarios**

1. **Given** a crawler frame is clicked, **Then** the card shows, in order: header (bust, name,
   handle · player, class · level), HP segments + numbers, rank current/best + sparkline (own
   row) or "Unranked", debuffs, **Equipped** (each worn slot as `slot · item`; "Nothing
   equipped." when none), **Latest achievement** (title, description, time; "No achievements
   yet." when none), **Recent moments** (up to three, no placeholders), and "Open full record".
2. **Given** any list length, **Then** the card's height is bounded (equipped shows at most the
   seven slot rows; other sections are single items) and never scrolls at ≥ 1024 px height.
3. Skills, inventory counts, and ledger rows no longer appear in the card.

## R2 User Story 2 - The record reads like a crawler sheet in an MMO (P2)

**Acceptance Scenarios**

1. **Given** the record opens, **Then** the left column is the crawler's full-figure art
   (`art` field; the bust when absent) at full dialog height, with identity, vitals, and stats
   beside it.
2. **Given** the Hotlist, **Then** it renders as a hotbar of ten square slots numbered 1–10,
   entries filling slots in order, empty slots drawn dim; on a phone the bar wraps to two rows of five.
3. **Given** gear, **Then** a Gear section lists the sheet's slots (Head, Torso, Arms, Hands,
   Legs, Feet, Accessories) with the equipped item or "-" per slot.
4. **Given** Skills, Inventory, Achievements, **Then** each is a tile grid (square-ish tiles with
   the name, and rank / time where relevant) showing at most eight tiles, with "View all (N)"
   when there are more; History shows its latest eight rows with "View all (N)".
5. **Given** "View all" is activated, **Then** the dialog body is replaced by a full list view for
   that category with a "Back to record" control and the same live updating; Escape in the list
   view returns to the sheet, a second Escape closes the record; focus moves to the list's
   heading on entry and back to the "View all" button on return.
6. **Given** the playhead moves while any view is open, **Then** the view updates within 500 ms.

## R2 Requirements

- **R2-FR-201**: Glance card content per US1 scenario 1; no placeholder rows; bounded height.
- **R2-FR-220**: New events, end to end (types, reducer, selectors, converter rows, schema,
  samples, fixtures): `equip { actor, slot, item }`, `unequip { actor, slot, item? }` with
  `slot ∈ head | torso | arms | hands | legs | feet | accessory` (accessory is a list, max 10,
  `unequip` by item name). Crawler optional `gear` starting state and optional `art` (path to a
  full-figure image). Feed labels "Equip" / "Unequip"; history includes them.
- **R2-FR-221**: `hotlist` keeps its list semantics but the record renders ten fixed slots; more
  than ten entries show the first ten and a "+N" marker.
- **R2-FR-222**: Record layout per US2 (art column, hotbar, gear, tile grids with "View all",
  history), stacking on ≤ 900 px with the art above the identity.
- **R2-FR-223**: List views are dialog-internal state (`view`), reset when the record closes;
  the dialog title gains the category name while a list view is open.
- **R2-FR-224**: Placeholder art: generated full-figure silhouettes per crawler under
  `public/img/crawlers/<id>-art.svg` (tall, ~2:5 aspect), listed as placeholders in README.

## R2 Success Criteria

- **R2-SC-201**: Card height equal for the fixture crawler with the most items and the one with
  the least; no dashes.
- **R2-SC-202**: Equipped and latest achievement follow the playhead in a scripted sweep.
- **R2-SC-203**: Hotbar shows 10 slots with entries in order; tile grids cap at 8 and "View all"
  opens the list view and returns focus correctly; Escape order holds.
- **R2-SC-204**: Lighthouse accessibility 100; no horizontal scroll at 360 px in any record view.

## Revision 2 - amendments carried by the UX review triage

Source: `specs/reviews/2026-09-15-ux-review-triage.md` (2026-09-15). Both items below change a
decision made in an earlier spec, so they are recorded here rather than left implicit.

### Revision 2 - party rank removed (author: DCC has individual rank only); supersedes v2 FR-141

The author confirmed on 2026-09-15 that DCC has no party rank: a crawler's standing is the only
rank the System keeps. **v2 FR-141** ("the feed header MUST show the party's current rank …") is
superseded and no longer implemented.

- `rank` events are `{ t, type: 'rank', actor, rank }`. There is no `scope` field, and `actor`
  is required; `rankSeries(events, t, actorId)` takes the crawler id directly.
- `initialState.partyRank` is gone from the types, the overlay state, and the episode schema
  (whose `initialState` keeps `additionalProperties: false`, so a file that still carries the
  field fails the contract).
- Legacy data still loads, because the runtime normalizer is deliberately more forgiving than
  the contract: `scope: 'crawler'` is accepted with the field dropped, `scope: 'party'` is
  demoted to `unknown` and ignored like any unrecognized event, and a stray
  `initialState.partyRank` is dropped with a `console.warn`.
- The CSV `rank` row is `timecode,rank,<actor>,<rank>`: field1 is the rank itself. The legacy
  form with `crawler` in field1 is converted with a WARN; `party` in field1 is an ERROR
  ("party rank is not a thing in DCC") and nothing is written.
- Copy removed: `feedText.rankParty`, `partyRankLine`. `EventFeed` no longer takes a
  `partyRank` prop and the feed header carries no party line.

### Revision 2 - the stage caption moved out of the stage; deviates from v1 §5

v1 §5 places the caption "Ep {n} · Floor {n} · {time}" inside the stage, bottom-left. In a real
YouTube embed the host's own control bar covers exactly that corner, so the caption was either
hidden or illegible, and the episode title was never shown anywhere visible (review 0.11/0.13).

The caption now sits in its own slim row between the stage and the timeline
(`data-testid="stage-caption-row"`): `Ep N · Floor N - {title}` on the left, `formatTime(t)` on
the right. The left half is the page's single `<h1>`, which retires the sr-only heading that
duplicated the title. `stageCaption(meta, t)` and `copy.feedText.stageCaption` are removed with
their last caller; `--stage-overlay-bottom` stays, because the minimap badge still needs to
clear the host's control bar.

### Revision 3 (2026-09-25) - HP is measured in HB slots, not hit points

The author: "Max HB is always ten." The Dungeon Crawler Carl health bar is a ten-slot strip -
the sheet's 10%..100% segments - and the rules count in slots ("heal 2 HB slots"). The hub's
`hp: { current, max }` had been filled from the sheets in the wrong unit: the numbers on the
sheet were hit points *per slot*, so Harry shipped as 20/20 and X.O. as 30/30.

Corrected everywhere:

- Every crawler in `ep{1,2,3}.json` and `scripts/samples/ep1.initial.json` opens on
  `hp: { current: 10, max: 10 }`. Every `hp` event (and the CSV sample rows) was scaled to the
  ten-slot bar and rounded half up - 4/20 → 2/10, 11/20 → 6/10, 19/20 → 10/10, 30/30 → 10/10 -
  with `max` now 10.
- `Hp.max` stays a plain `number` (no literal 10 in the type), so a longer bar remains
  expressible, but `validate.ts` emits a `console.warn` ("HB is ten slots") for any crawler or
  `hp` event whose `max` is not 10. It is a warning, never an error; the value is kept verbatim
  and the reducer clamps to it exactly as before. `src/engine/**` is otherwise unchanged.
- The ten-segment strip of FR-110 is untouched and now maps 1:1 to slots: `hpSegments` still
  scales `ceil(current / max * 10)` so an arbitrary `max` keeps working.
- Wording: the mono caps label is `HB` (T344's `copy.hpLabel`), the strip's accessible name is
  "Health bar N of 10 slots", and the feed reads "{actor} holding at 2/10 HB". `HB` is the term
  the author's own copy already used (status chips, the front-door live line in
  `specs/011-front-door/addendum.md` §Hero). The Studio's `hp` form is labelled `HB`, with
  "HB slots (of 10)" on the reading itself.
- `content/status/*.json` chips moved to slots (`4/20 HB` → `2/10 HB`, `5/20 HB` → `3/10 HB`).

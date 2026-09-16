# Feature Specification: Mobile pass (sticky mini-player, tabs, bottom sheets)

**Feature Branch**: `006-mobile-pass`  
**Created**: 2026-09-16  
**Status**: Draft  
**Input**: UX review triage Phase 2 (2.1–2.4), adopted by the author. Tested premise: phones are
likely the dominant watch-along form factor; v1 only asked for a stacked layout.

Applies at phone/tablet widths (≤ 900 px, the existing breakpoint). Desktop is unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep watching while reading (Priority: P1)

On a phone the viewer scrolls down to read the feed or the log. As the stage leaves the top of
the screen, the player docks as a compact mini-player pinned under the header (video still
playing, still the same player). Tapping the mini-player scrolls back to the full stage. The
space where the stage was does not collapse, so nothing jumps.

**Acceptance Scenarios**:

1. **Given** a 400 px wide page playing, **When** the viewer scrolls until the stage would leave
   the viewport, **Then** the player shrinks to a mini-player pinned below the header (about 45%
   of the width, 16:9), playback continues without restarting, and the stage's original slot keeps
   its height.
2. **Given** the mini-player is shown, **When** the viewer taps it (outside the host's own
   controls area) or its "Return to the stage" control, **Then** the page scrolls to the top and
   the player returns to full size.
3. **Given** the mini-player is shown, **When** an achievement fires, **Then** the toast still
   appears (as a compact banner beneath the mini-player or inside it) and the minimap badge is
   hidden; **When** the episode ends or a resume offer appears, **Then** the mini-player is
   dismissed so the card shows on the full stage.
4. **Given** the desktop layout (> 900 px), **Then** nothing about the stage changes.

---

### User Story 2 - The overlay is one tap away (Priority: P1)

Directly beneath the stage (and its caption row and timeline), a row of tabs — **Feed**, **Party**,
**Map**, **Log** — replaces the stacked page. Feed is selected by default and shows the ticker
(and sponsor slot). Party shows the crawler frames in a two-column grid. Map shows the floor map
inline with its controls. Log shows the broadcast log open (its own header and filters). Swiping
left/right on the pane area switches tabs; arrow keys work on the tab list. The selected tab
survives scrubbing and is remembered for the visit, not across reloads.

**Acceptance Scenarios**:

1. **Given** a 400 px page at load, **Then** the tab row and the Feed pane are visible without
   scrolling below the timeline (the first feed rows are above the fold on an 800 px tall screen).
2. **Given** the Party tab, **When** the viewer taps a frame, **Then** the glance card opens as a
   bottom sheet (US3), not a full-screen takeover.
3. **Given** the Map tab, **Then** the floor map renders inline with zoom/fit and drag-to-pan, and
   the minimap badge on the stage is hidden on phones (the badge would duplicate the tab).
4. **Given** any tab, **When** the playhead moves, **Then** only that pane's content updates
   visibly; switching tabs shows content correct for the current playhead.
5. **Given** the pane area, **When** the viewer swipes left, **Then** the next tab is selected;
   **When** they swipe right, the previous; vertical scrolling is unaffected.
6. **Given** focus on the tab list, **When** the viewer presses ArrowRight/ArrowLeft, **Then** the
   selection moves and the pane changes (WAI-ARIA tabs pattern).

---

### User Story 3 - Panels as bottom sheets (Priority: P2)

Opening a crawler glance on a phone slides a sheet up from the bottom to about 70% of the
viewport height, leaving the mini-player (or the top of the stage) visible. The sheet has a grab
handle and a close control; dragging it down past a threshold or tapping the dimmed area above
it closes it. The full record remains a full-screen modal.

**Acceptance Scenarios**:

1. **Given** the Party tab, **When** a frame is tapped, **Then** the glance sheet opens at ~70 vh
   with the video still visible above it; the page behind does not scroll.
2. **Given** the sheet, **When** the viewer drags the handle down more than a quarter of the
   sheet's height, or taps the dim area, or the close control, or presses Escape, **Then** it
   closes and focus returns to the frame.
3. **Given** the sheet, **When** the viewer activates "Open full record", **Then** the record
   opens full-screen as before; closing the record returns to the sheet.
4. **Given** the desktop layout, **Then** the rail panel behaves exactly as before.

---

### User Story 4 - No ragged party row (Priority: P3)

On phones the five crawler frames sit in a two-column grid inside the Party tab (the fifth spans
both columns or sits alone at left — consistently), replacing the horizontal strip.

### Edge Cases

- Landscape phone (e.g. 844×390): the mini-player still docks; the tabs remain; the sheet is 70 vh
  of a short viewport — allow it to reach 85 vh when the viewport is under 500 px tall.
- Tablet portrait (768 px): treated as phone (≤ 900).
- Reduced motion: no slide/scroll animations; states switch instantly.
- The record dialog open while the mini-player is docked: the dialog covers everything (as now).
- Rotating the device: mini-player state recomputed from the sentinel; tabs keep selection.

## Requirements *(mandatory)*

- **FR-500**: At ≤ 900 px, when the stage's normal position scrolls out of view, the same player
  element MUST be repositioned as a fixed mini-player under the header (no remount, no reload),
  and its original slot MUST retain its height.
- **FR-501**: The mini-player MUST offer a way back to the full stage (tap or explicit control);
  it MUST hide the minimap badge and MUST NOT show the resume or ended cards in mini form (those
  cancel mini mode).
- **FR-502**: Beneath the timeline on phones, a tab list (Feed, Party, Map, Log) MUST follow the
  WAI-ARIA tabs pattern (roles, `aria-selected`, roving focus, arrow keys) and MUST support
  horizontal swipe on the pane area without breaking vertical scroll.
- **FR-503**: Panes MUST show the existing components (feed, party rail as a 2-column grid, floor
  map inline, broadcast log) fed by the same playhead-derived data; the stage badge and the
  desktop rail panel are not rendered on phones.
- **FR-504**: The glance panel on phones MUST render as a bottom sheet (~70 vh, ≥ 85 vh on short
  viewports) with a handle, close control, dim backdrop, drag-to-dismiss, Escape and backdrop-tap
  close, focus return, and body scroll lock. The record dialog stays full-screen.
- **FR-505**: Desktop (> 900 px) behaviour and markup MUST be unchanged; all existing tests pass.
- **FR-506**: Reduced motion MUST disable slide and smooth-scroll animations.

### Key Entities

- **Mini-player state (viewer)**: `docked: boolean` from an IntersectionObserver on a sentinel.
- **Tab state (viewer)**: `'feed' | 'party' | 'map' | 'log'`, per visit.
- **Sheet gesture state (viewer)**: drag offset during a pull-down.

## Success Criteria *(mandatory)*

- **SC-501**: At 400×800, scrolling past the stage docks the mini-player within one frame of the
  sentinel leaving view; the player iframe node identity is unchanged; the stage slot height is
  unchanged (measured).
- **SC-502**: Feed rows are visible above the fold at 400×800 on load; tabs switch by tap, swipe,
  and arrow keys; each pane matches the playhead in a scripted sweep.
- **SC-503**: The glance sheet opens at ~70 vh, closes by drag/backdrop/close/Escape with focus
  return; the video remains visible above it.
- **SC-504**: Lighthouse accessibility 100 at phone width; no horizontal scroll at 360–430 px;
  desktop snapshots unchanged; all prior tests pass.

## Assumptions

- The YouTube iframe tolerates CSS repositioning/resizing without interruption (it does: only DOM
  re-parenting reloads it).
- Tabs are not deep-linked; a later feature may add `?tab=`.
- The desktop rail panel + full-width log stay as they are; the tabbed layout is phone-only.

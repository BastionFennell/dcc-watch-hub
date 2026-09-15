# Feature Specification: Deep links to moments + share

**Feature Branch**: `004-deep-links`  
**Created**: 2026-09-15  
**Status**: Draft  
**Input**: UX review triage item 1.9, adopted by the author: "Support `?t=<seconds>` on episode
routes, hydrating the full derived state on load. Add a 'Share this moment' action on the player,
timeline markers, and feed rows that copies the deep link. Clips shared in Discord come back to
the site pre-synced."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a shared moment (Priority: P1)

A viewer follows a link like `/ep/1?t=156`. The episode page opens, the broadcast starts at
2:36, and the party rail, feed, map, and timeline already reflect that moment. No resume card
appears for that visit. Refreshing keeps the same behaviour; navigating to another episode drops it.

**Acceptance Scenarios**:

1. **Given** `/ep/1?t=156`, **When** the page loads and the player is ready, **Then** playback
   is positioned at 2:36 (within 1 s) and the overlay shows the state at 2:36 within 500 ms of
   the seek.
2. **Given** a saved resume position for episode 1, **When** `/ep/1?t=156` opens, **Then** no
   rejoin card is shown; the deep link wins for this visit and saving resumes as normal afterwards.
3. **Given** `?t=` is negative, non-numeric, or beyond the episode duration, **When** the page
   opens, **Then** it behaves as if no `t` were given (no error, resume card still allowed).
4. **Given** the dev scrubber (`?fake=1&t=…`), **When** the page opens, **Then** behaviour is
   unchanged: the fake source starts at `t`.
5. **Given** a deep-linked page, **When** the viewer uses the header to open another episode,
   **Then** that episode starts at 0:00 (the link applies to one visit of one episode).

---

### User Story 2 - Share this moment (Priority: P2)

While watching, the viewer activates "Share this moment" in the caption row under the stage.
The site copies a link to the current second to the clipboard (or opens the device share sheet
on phones) and confirms in the System's voice. Each feed row also offers a share action for the
moment of that event. The link is absolute and works from the deployed site.

**Acceptance Scenarios**:

1. **Given** the playhead at 2:36, **When** the viewer activates the caption-row share, **Then**
   the clipboard receives `https://<host><base>/ep/1?t=156` and a brief confirmation appears
   ("Moment marked. The link is on your clipboard.") for about two seconds.
2. **Given** a feed row for an event at 2:34, **When** its share action is activated, **Then**
   the copied link carries `t=154` and the row's seek behaviour is not triggered.
3. **Given** a device that supports the native share sheet, **When** share is activated,
   **Then** the share sheet opens with the link and the episode title; cancelling it is silent.
4. **Given** the clipboard is unavailable (insecure context, permission denied), **When** share is
   activated, **Then** the link is shown in a small System notice with the text selected so it can
   be copied by hand; no error is thrown.
5. **Given** the share confirmation, **When** the viewer uses a screen reader, **Then** the
   confirmation is announced once (polite live region).

---

### Edge Cases

- `?t=` with decimals: floored to whole seconds.
- `?t=0`: valid; equivalent to no link except that it still suppresses the resume card.
- Link opened before the host player is ready: the seek is queued (existing adapter contract §6).
- Host refuses autoplay: the player positions at `t` paused; the overlay is at `t` regardless.
- Share while the record dialog is open: the caption row is inert behind the dialog; feed rows
  are in the rail (not covered on desktop) and still work.

## Requirements *(mandatory)*

- **FR-300**: Episode routes MUST accept `?t=<seconds>` in production builds and seek to it
  once per page visit after the source exists; invalid or out-of-range values are ignored.
- **FR-301**: A deep link MUST suppress the resume offer for that visit; normal saving continues.
- **FR-302**: The caption row MUST offer a "Share this moment" control that produces an absolute
  link to the current whole second and copies it (clipboard) or shares it (native share sheet
  when available), with a two-second System-voice confirmation in a polite live region.
- **FR-303**: Each feed row (and the pinned sponsor) MUST offer a share action for its event
  time that does not trigger the row's seek.
- **FR-304**: When neither clipboard nor share is available, the link MUST be shown in a
  selectable System notice; nothing may throw.
- **FR-305**: The share link MUST be built from the deployed origin and base path, the episode
  id, and `t`, and MUST NOT include the dev flags (`fake`, `panel`, `record`).
- **FR-306**: Sharing MUST NOT pause, seek, or otherwise touch playback.

### Key Entities

- **Deep link**: `{ episodeId, t }` parsed from the URL once per visit; consumed after the seek.
- **Share intent**: `{ t }` → absolute URL string; delivery result `copied | shared | shown`.

## Success Criteria *(mandatory)*

- **SC-301**: `/ep/1?t=156` lands within 1 s of 2:36 with the overlay correct, in a scripted
  test with the fake source and in a real browser with the embed.
- **SC-302**: Share from the caption row and from a feed row copies the exact expected URL in
  tests (clipboard stub) and shows the confirmation.
- **SC-303**: Resume is suppressed on deep-linked visits; ordinary visits still get the card.
- **SC-304**: No regression: all prior tests pass; Lighthouse accessibility stays 100.

## Assumptions

- Timeline markers do not get their own share control in this feature; a viewer can click a
  marker to seek and then share from the caption row. (Keeps the strip uncluttered.)
- The share confirmation is a transient viewer notice, not overlay state (a short timer is
  acceptable, as with the resume card's focus handling).
- Static hosting has no server-side previews; no Open Graph per-moment metadata.

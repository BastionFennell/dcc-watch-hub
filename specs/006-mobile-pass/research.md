# Research: Mobile pass

## R1. Docking without reloading the player
- **Decision**: never re-parent the iframe. The stage wrapper gets `data-mini` and CSS makes it
  `position: fixed; top: calc(var(--header-h) + 8px)` — **revised in T611** to
  `calc(var(--header-h-compact) + var(--tabstrip-h) + 8px)`, i.e. under the sticky tab strip
  (R2), and the width capped to 170 px under `(max-height: 500px)`; `right: 8px;
  width: min(45vw, 260px);
  aspect-ratio: 16/9; z-index: 15; box-shadow`. A sibling placeholder inside the slot keeps the
  slot's 16:9 height so the document does not jump. Toast renders compact inside the mini frame;
  badge hidden; caption row stays in flow.
- **Detection**: `IntersectionObserver` on a 1 px sentinel at the top of the slot with
  `rootMargin: -<header height>px 0 0 0`; `docked = !isIntersecting && boundingClientRect.top < 0`
  (only when scrolled past, not when below the fold). Guard when IO is missing (jsdom): never docks.
- **Exit**: tap on the mini frame's edge zone or the "Return to the stage" button → `scrollTo({ top: 0 })`.
  Since taps on the iframe itself go to YouTube, the mini frame gets a thin bottom bar with the
  return control (also the toast's home).
- **Cancel**: `mini` forced false while the resume offer or ended state is present (cards need the full stage).

## R2. Tabs
- **Revised in T611**: the strip is **sticky under the compact header**
  (`position: sticky; top: var(--header-h-compact); z-index: 16`, opaque `--canvas` background,
  hairline bottom border), not in the flow. In the flow it slid *under* the fixed mini-player:
  at 430 × 932 the document's scroll ends with the strip parked behind the frame, leaving the
  Map and Log tabs untappable. The frame now clears it by construction —
  `top: calc(var(--header-h-compact) + var(--tabstrip-h) + 8px)` — and `--tabstrip-h` (44 px,
  `tokens.css`) is the single number the strip's `min-height` and that offset both read, so the
  two cannot drift.
- WAI-ARIA tabs: `role="tablist"` with `aria-label`, `role="tab"` buttons (`aria-selected`,
  `aria-controls`, roving `tabIndex`), `role="tabpanel"` (`aria-labelledby`, `tabIndex=0`). Arrow
  keys move selection (automatic activation), Home/End. All four panels stay mounted (hidden via
  `hidden`) so the log's follow state and the map's zoom survive tab switches; content is derived
  each render anyway.
- **Swipe**: pointer events on the panel container: track `pointerdown`; on `pointermove` if
  `|dx| > 40 && |dx| > 2·|dy|` → switch tab once and release; `touch-action: pan-y` so vertical
  scroll is native. No swipe animation (keeps it simple and reduced-motion-safe).
- **Party pane**: `PartyRail` with `layout="grid"` → `grid-template-columns: repeat(2, 1fr)`; the
  fifth frame spans both columns (`:last-child:nth-child(odd) { grid-column: 1 / -1 }`).
- **Map pane**: `FloorMap` inline with a small heading (floor + count); the stage badge is hidden
  on phones (`useIsPhone`).
- **Log pane**: `EpisodeLog` with `initialOpen` forced true and its toggle hidden (`embedded` prop).

## R3. Bottom sheet
- `RailPanel presentation="sheet"`: portal to body; backdrop (dim, tap closes); sheet
  `position: fixed; inset: auto 0 0 0; height: 70vh` (`85vh` when `(max-height: 500px)`),
  `border-radius: 12px 12px 0 0`, grab handle (`role="presentation"`, 36×4 px), header with title +
  close, scrollable body, `padding-bottom: env(safe-area-inset-bottom)`. Drag: pointer down on the
  handle/header → translateY follows `dy ≥ 0`; release past 25% of height → close, else snap back
  (150 ms, none under reduced motion). Escape/backdrop/close → close; focus returns to the trigger
  (existing `usePanel`). Body scroll lock reuses `body.panel-open`.
- The record dialog stays as is (full-screen ≤ 900 px) and sits above the sheet (`z-index`).

## R4. Above-the-fold check
- At 400×800 with the header (48) + stage (225) + caption (22) + timeline (~44 incl. legend) +
  tabs (40) ≈ 380 px, the first feed rows start ≈ y 390 → 2–3 rows above the fold. Legend may
  collapse to a single line at ≤ 480 px to save height.

## R5. Tests
- `useIsPhone`, `useMiniPlayer` (IO stub: intersect/leave; missing IO → false; forced false with cards).
- `MobileTabs`: roles/aria, click, arrows, Home/End, swipe left/right, vertical drag ignored, panels stay mounted.
- `RailPanel` sheet: handle drag past threshold closes, short drag snaps back, backdrop tap closes, Escape closes, safe-area class.
- Page (phone via stubbed `matchMedia`): tabs render below the timeline; desktop rail/log not rendered; Party tab frame → sheet; glance inside sheet; record opens above; Map tab shows `floormap`; Log tab shows the open log without toggle; stage badge absent; docking toggles `data-mini` with an IO stub; mini cancelled when the resume card shows; desktop (matchMedia false) tree unchanged (existing tests).

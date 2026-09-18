# Research: Crawler Record

## R1. Why a modal dialog, not a popover

- **Decision**: `FullRecordDialog` is a centered modal (`role="dialog"`, `aria-modal="true"`),
  `width: min(1200px, 94vw)`, `max-height: 90vh`, internal scroll, dimmed backdrop; full-screen
  ≤ 900 px. A popover anchored to the rail would be as narrow as the rail and could not show the
  sheet's columns.
- **Alternatives**: side-by-side second panel (no room on laptops); replacing the stage (breaks
  the broadcast); native `<dialog>` (usable, but `showModal` focus and inert behaviour vary and
  jsdom lacks it - a small hook with explicit trap is more testable).

## R2. Focus trap and inertness (`useModalDialog`)

- **Decision**: On open: remember `document.activeElement` (or the provided trigger), set
  `inert` on the app root (`#root > *` siblings of the dialog - the dialog is portaled to
  `document.body`), add `body.dialog-open` (`overflow: hidden`), focus the close control. Tab/
  Shift+Tab wrap within the dialog's focusable elements (queried on each keydown). Escape is a
  capture-phase `document` listener (as `ResumeCard`) so it beats `usePanel`. Backdrop click
  (target === backdrop) closes. On close: remove inert/class, focus the trigger if connected.
- **Rationale**: FR-210; `inert` is supported in all current browsers; the trap handles older ones.
- **Portal**: `createPortal` to `document.body` so `z-index` and the inert root are trivial.

## R3. Glance ledger rules

- **Decision**: `crawlerGlance(dossier)`: for each of hotlist/skills/inventory the "newest" is
  the last element of the current list (the reducer appends in event order); achievements use the
  last elapsed achievement (title + `t`). Counts are list lengths. `recentHistory` = first three of
  `dossier.history` (already newest first). Empty → `{ count: 0 }` and the component shows the
  v2 `dossierEmpty.*` phrase.
- **Caveat**: "newest" for inventory after a `remove` is the last remaining item, which is the
  most recently added still-held item - matches the reducer's union order. Documented.

## R4. Fixed height

- **Decision**: The card's ledger and history rows are single-line with `text-overflow:
  ellipsis`; history shows exactly three rows (placeholders "-" when fewer). Header, HP, rank,
  debuffs (max two rows of chips, then "+N") are bounded. Target ≤ 640 px tall at the 1400 px
  type scale; verified by screenshot in polish.

## R5. Record layout

- **Decision**: CSS grid: `grid-template-areas: "top top top" "a b c"`; top band = header +
  vitals + stats in a 3-column row; columns: a = Hotlist, Skills; b = Inventory, Achievements;
  c = History. ≤ 900 px: single column in sheet order. Section bars reuse the v2 dossier styles.
- **FR-214**: each list item renders as `<li data-item="<kind>" data-name="…">` with the label in
  its own `<span>`, so a later tooltip feature can attach without restructuring.

## R6. Tests

- Selector: glance from fixture dossier at 200/110/20 (counts, newest, achievement time, empty).
- `useModalDialog`: focus moves to close on open, Tab wraps, Shift+Tab wraps, Escape closes and
  does not reach a bubble listener on document, backdrop click closes, inner click does not,
  focus returns to trigger, body class toggles, `inert` set on siblings.
- `CrawlerGlance`: renders ledger rows and counts; button calls `onOpenRecord`; fixed rows.
- Page: frame → glance (not the full list sections); "Open full record" → dialog with sections;
  Escape closes only the dialog (glance stays), focus on the button; backdrop closes; live update
  while open (seek changes Inventory in the dialog); episode change closes both; ≤ 900 px class.

## Revision 2

### R7. Equipped items need a data source
- **Decision**: `equip`/`unequip` events with the official sheet's gear slots, plus optional
  starting `gear`. The glance's "Equipped" reads the gear state; inventory stays the carried list.
- **Alternatives**: an `equipped: boolean` on inventory strings (the inventory is `string[]`, so
  this would change the whole model); inferring from names (unreliable).

### R8. Hotbar and tiles
- **Decision**: Hotbar = ten `<li>` squares in a CSS grid `repeat(10, 1fr)` (five per row ≤ 900
  px), each with a small slot number top-left and the entry name centered, empty slots at 40%
  opacity with a dashed hairline; `+N` marker after slot ten when overflowed. Tiles = CSS grid
  `repeat(auto-fill, minmax(120px, 1fr))` of square-ish panels (name, then rank / time as a
  mono caps footer); first eight only; "View all (N)" button after the grid when N > 8.
- **List view**: dialog-internal `view` state; the body swaps to a single scrolling list (the
  existing `DossierList` / `DossierAchievements` / `DossierHistory` sections render the full
  content) with a "Back to record" button at the top; Escape returns to the sheet before closing.
- **Alternatives**: nested accordions (crowded); a second dialog (focus management doubles).

### R9. Art column
- **Decision**: `art` renders in a left column `grid-template-columns: minmax(180px, 22%) 1fr`
  spanning the top band and the sections, `object-fit: contain`, `object-position: top`, on a
  `--panel-deep` backdrop; falls back to the bust centered in the same column. ≤ 900 px: the art
  becomes a 40 vh banner above the identity. Placeholder art: generated SVG silhouettes.

### R9a. Art aspect ratio varies
The author's samples: The Actress ≈ 1:2.7 (tall, narrow), The Stuntman ≈ 1:1.7 (wide stance).
The art column therefore uses `object-fit: contain; object-position: top center` inside a column
of `minmax(200px, 28%)` width, and the column's height follows the sheet; wide figures simply
use more of the column width, tall ones more height. Placeholder art ships one wide silhouette
(stuntman, 320×540) and tall ones (others, 200×540) so both cases are exercised.

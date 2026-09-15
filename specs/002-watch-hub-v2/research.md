# Research: DCC Watch Hub v2

## R1. Where panels live

- **Decision**: The right rail is a slot: `feed | dossier | map`. On desktop the slot keeps its
  column; the stage, timeline, and party rail never move. At ≤ 900 px the slot renders as a
  fixed full-viewport overlay (`position: fixed; inset: 0; z-index: 20`) with its own header and
  close control, and `body` gets `overflow: hidden` while open.
- **Rationale**: Constitution III (never cover the stage on desktop; opt-in; one panel). A modal
  over the stage would hide the video the viewer is watching along with.
- **Alternatives**: Modal dialog (covers stage); bottom drawer under the rail (pushes layout, on
  desktop it would push the feed off screen).

## R2. Panel state, keyboard, focus

- **Decision**: `usePanel()` in the page: `panel: { kind: 'none' } | { kind: 'dossier'; crawlerId } | { kind: 'map' }`,
  `open(next, triggerEl)`, `close()`, `toggle(next, triggerEl)`. Escape listener on `document`
  (keydown): if a header `<details open>` exists, close it and stop; else close the panel.
  On close, `triggerEl.focus()` (element captured at open). Panel resets on episode change
  (`useEffect` on `meta.id`). Re-activating the same trigger closes (toggle); a different
  trigger switches without closing.
- **Rationale**: FR-101, spec edge case on Escape ordering.
- **Alternatives**: URL state for panels (deep links to a dossier are not a v2 goal and would
  complicate the header links); a11y `dialog` element (mobile only benefits; a role="region"
  with `aria-labelledby` and a heading is enough since the panel is not modal on desktop).

## R3. Dossier layout follows the official sheet

- **Decision**: Section order and vocabulary from the official crawler sheet: header (Name,
  Race, Pronouns, Level, Crawler Number, Class, Floor, Portrait), HP as ten segments (10%…100%,
  colored red→green by fill, like the sheet's HP strip), Debuffs (statuses), Stats (STR INT CON
  DEX CHA) when present, HOTLIST, SKILLS (Name, Rank), INVENTORY (Item), then two sections the
  sheet does not have but the log does: ACHIEVEMENTS and HISTORY. Section headers are black
  bars with white mono caps (the sheet's style, in our palette: `--panel-deep` bar, `--text` caps).
- **Rationale**: The author supplied the sheet as the reference; fans will recognize the shape.
  We reuse its structure and terminology, not its artwork or logo (copyrighted).
- **Alternatives**: Free-form card (loses recognition); reproducing the sheet's full field set
  (most fields have no data source; stale fields are worse than absent ones — see R6).

## R4. Rank sparkline

- **Decision**: Inline SVG 120×32 (scales with container width via `viewBox`). Points from
  `rankSeries(events, t, scope)`; y inverted (lower rank number = higher on chart); x = index
  (evenly spaced), not time, so a burst of updates stays readable. Polyline in `--brand-2`,
  last point a filled circle, best point a ring. `role="img"` with `aria-label` summary; numbers
  rendered as text beside it. With one point: a dot and the number; with zero: omitted.
- **Rationale**: FR-140/141; dependency-light; deterministic.
- **Alternatives**: x = time (cramped when events cluster); a chart lib (forbidden by IV).

## R5. Floor map rendering, zoom, pan

- **Decision**: One `<svg viewBox="0 0 cols rows">` with `preserveAspectRatio="xMidYMid meet"`
  inside a clipping wrapper. Zoom and pan are a CSS transform on a `<g>`: `translate(panX,panY)
  scale(zoom)`, zoom ∈ {1, 1.5, 2.25, 3.4, 5} (×1.5 steps), pan clamped so the grid never fully
  leaves the view. Drag with Pointer Events (`setPointerCapture`), keyboard `+`/`-`/`0` (fit)
  while the map has focus, buttons for all three. Labels: `<text>` at the centroid of the union
  of cells sharing a label, `paint-order: stroke` halo for legibility, font size in SVG units so
  they scale with zoom. Recent reveals: `--brand-2` fill with a 5 s window from
  `recentlyRevealed` (existing selector). Unrevealed cells: `--panel-deep` with hairline stroke.
  sr-only list of labels for assistive tech; `role="img"` summary on the SVG.
- **Rationale**: FR-120/121; SVG text scales cleanly; transforms keep the DOM static per tick.
- **Alternatives**: Canvas (no DOM for labels/a11y); CSS grid of divs like the badge (labels and
  transforms get awkward beyond ~200 cells).

## R6. Sheet fields carried vs. excluded

- **Decision**: Carry: `race`, `pronouns`, `crawlerNumber`, `stats {str,int,con,dex,cha}`,
  `hotlist[]`, `skills[] {name, rank?}` as optional crawler fields in `initialState`, plus the
  three events. Exclude: evade, DR, move/step, AI favor, size, mana, attacks, gear slots,
  external buffs, popularity, trauma/loose ends/regrets, pet, mount, personal space, deity,
  clubs, abilities, sponsors (sheet-level).
- **Rationale**: Spec assumption: show only what an edit-pass log keeps current. Stats and
  identity are static per episode and cheap; everything excluded either changes constantly in
  play (DR, mana) or is narrative bookkeeping the editor will not log per timecode.
- **Alternatives**: Full sheet mirror (stale data presented as live is a spoiler-adjacent
  correctness problem); no sheet fields (dossier looks thin next to the real sheet).

## R7. Resume storage and timing

- **Decision**: `resume.ts`: key `dcc-watch-hub:resume:v1:<episodeId>`, value
  `{ episodeId, t, savedAt }` (ISO). `loadResume` validates shape and `0 <= t`. `useResume(meta,
  source, playhead)`: save at most every 5 s while `playing`, on pause, on `pagehide`, on
  `visibilitychange` → hidden, and on unmount (cleanup reads the latest `t` from a ref). Clear
  when `ended` or `t >= durationSec - 30`. `pending` is the loaded record when `30 <= t <
  durationSec - 30` and the page has not yet resolved it; `rejoin()` → `source.seek(t)` then
  clears pending; `startOver()` → `clearResume` + clears pending. All storage calls try/catch;
  a throwing `localStorage` (private mode) yields `pending = null` and silent saves.
- **Rationale**: FR-130..133; Principle I (playhead only).
- **Alternatives**: IndexedDB (overkill); saving on every tick (writes 4×/s for no benefit);
  cookies (sent to the host).

## R8. Seeking before the host player is ready

- **Decision**: `YouTubeTimeSource.seek(t)` stores `pendingSeek = t` when the player is not
  ready; `onReady` applies it with `seekTo(t, true)` then emits a tick. YouTube's documented
  behavior: `seekTo` on a cued (unstarted) player starts playback from `t`; on a paused player
  it stays paused. So "Rejoin" both positions and starts the broadcast — desirable. The fake
  source already accepts `seek` at any time.
- **Rationale**: The resume card can be answered before the iframe finishes loading.
- **Alternatives**: `playerVars.start` (needs the value at construction; the card has not been
  answered yet); delaying the card until ready (adds a visible wait for nothing).

## R9. Triggers that used to be inert

- **Decision**: `CrawlerFrame` becomes a `<button type="button">` wrapping the frame content
  (keeps its `data-*` test attributes) with `aria-expanded`, `aria-controls="rail-panel"`,
  `cursor: pointer`, hover/focus ring in `--brand-2`, and `aria-pressed`-free semantics.
  `MiniMapBadge` becomes a `<button>` with `aria-label` "Floor N — open the floor map" (visible text first: WCAG 2.5.3), pointer events
  restored, same affordances; its decorative grid stays `aria-hidden`.
- **Rationale**: FR-104, FR-122; constitution III now permits affordances because the triggers do
  something.
- **Alternatives**: `onClick` on a `div` (not keyboard reachable).

## R10. Event types and converter rows

- **Decision**: `skill` (field1 name, field2 rank, field3 desc), `class` (field1 class),
  `hotlist` (field1 add `;`, field2 remove `;`). Reducer: `skill` upserts by name (rank replaces
  when given); `class` sets `class`; `hotlist` applies remove then add (same `union` helper as
  inventory). Feed labels: "Skill", "Class", "Hotlist". Timeline: none of the three gets a marker.
- **Rationale**: FR-112; mirrors existing add/remove conventions.
- **Alternatives**: A generic `sheet` event with a field path (flexible, but the editor's CSV
  would need a mini-language).

## R11. Sample and fixture data

- **Decision**: All three episodes: add sheet fields to the five crawlers (race, pronouns,
  crawler number, stats, starting hotlist and skills), ≥ 2 `skill`, ≥ 2 `class`, ≥ 2 `hotlist`
  events, and ≥ 3 crawler-scoped `rank` events for at least two crawlers, plus a third labeled
  `map_reveal`. Raise the samples test's per-file event ceiling from 40 to 60. The page-test
  fixture gets the same shapes at known times (documented in data-model §5) so tests can assert
  exact dossier and map contents.
- **Rationale**: Every v2 story testable without real episodes.

## R12. Tests

- Reducer: skill upsert, class set, hotlist add/remove, unknown actor ignored.
- Selectors: `crawlerHistory` (newest first, actor-only, no cap), `crawlerDossier` (sections at
  t; backward seek removes), `rankSeries` (points, current, best; party scope), `mapLabels`
  (centroid, union of same label, none before t), `hpSegments` (10 segments, thresholds).
- Storage: round-trip, invalid JSON ignored, throwing storage ignored, clear.
- Page: open/close/switch dossier by click and keyboard, Escape order with the Episodes menu,
  focus return, content sweep at event boundaries for one crawler, map open/labels/zoom/fit/close,
  one-panel rule, resume card shown/hidden by thresholds, rejoin seeks the fake source and clears,
  start over clears, end clears storage, party rank line in the feed header, mobile overlay
  class at a stubbed 400 px `matchMedia`.

# Quickstart: DCC Watch Hub v2

Same toolchain and commands as v1 (`specs/001-watch-hub-v1/quickstart.md`): Node 20.9.0,
`npm install`, `npm run dev` (port 5180), `typecheck`, `lint`, `test`, `build`, `preview`.

## Try the v2 features (dev scrubber)

Times below are verified against `public/data/ep1.json` (episode 1, 635 s). The `?t=` value is
seconds, so `t=560` opens the scrubber at 9:20.

- Dossier: `http://localhost:5180/ep/1?fake=1&t=560` → click **Harry** → the sheet, with a
  three-point rank sparkline (#8890 at 4:20, #7215 at 6:50, #6402 at 8:40; best #6402), Hotlist
  "Bronze Box Runner" (swapped in at 9:10), Skills "Powerful Strike", Inventory "Torch" (traded
  for the Enchanted Crowbar at 7:41), Achievements "Gate Crasher" (2:34), and History.
  Drag the scrubber back to 5:00 (300 s) → the sparkline drops to one point (#8890, current and
  best), the Hotlist reads "The Hoarder" again and the Enchanted Crowbar is back in Inventory.
  Back below 4:50 → the Hotlist is empty; below 4:20 → the rank reads "Unranked" and no
  sparkline is drawn; below 4:00 → the class reads "Unclassed"; below 2:34 → Achievements shows
  its System empty state.
  Press **Escape** → the feed returns and focus is on Harry's frame.
  For a skill that *changes rank*, click **X.O.** instead: Signal Discipline is Rank 1 until
  3:30 and Rank 2 after, and Breach Charge appears at 8:25.
- Map: same page → click the **Floor 1** badge → the expanded map with two labels, "The Meat
  District" (revealed 2:03) and "The Rot Market" (7:20). Scrub past 9:40 for the third, "The
  Gutter Stair". Zoom with the buttons or `+`/`-`, drag to pan, `0` or **Fit** to reset.
  Clicking a crawler frame while the map is open swaps it for the dossier - one panel at a time.
- Resume: open `/ep/1` (no `?t=`, no `?fake=1`), play past 0:30, reload → "Rejoin at m:ss" card;
  choose **Rejoin** → video and overlay land at that time. Play to the end, reload → no card.
  Note: opening with `?t=` starts the fake source past the 5 s grace window, which answers the
  offer by itself - use a plain `/ep/1` to see the card.
- Party rank: feed header shows "Party rank #61" from 5:17 (the episode's only party rank
  event); before that the line is omitted.

## Manual acceptance (spec §Success Criteria)

1. SC-101 dossier open/switch/close by mouse and keyboard; content sweep via `?t=` at event
   boundaries for one crawler.
2. SC-102 map labels at t; zoom/pan/fit; close restores feed.
3. SC-103 resume thresholds (under 30 s → no card; last 30 s → no card; end clears); private
   window → no card, no errors in console.
4. SC-104 sparkline points and summary text (inspect with the accessibility tree).
5. SC-105 all v1 checks still pass; Lighthouse ≥ 90; 360 px with a panel open: no horizontal scroll.
6. SC-106 ambient view unchanged except trigger affordances and the party rank line.

## Authoring

New CSV rows: `skill`, `class`, `hotlist` (see `contracts/sheet-csv.md`). Optional crawler sheet
fields go in the `--initial-state` file.

---

## Results

Phase 7 (T131–T135), run on Node 20.9.0 against the current `002-watch-hub-v2` tree.
Numbers marked *measured* come from a real Chrome 152 headless run; anything that needed a
human or a second browser is marked **manual, not run**.

### Gates (T135)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **326 passed / 18 files**
(322 before Phase 7; +3 page tests and +1 `ResumeCard` test) · `npm run build` clean.

### Accessibility (T131)

- **Contrast**, WCAG 2.x relative luminance, computed with a node script.

  | What | Colour | On `--panel` #1d1d28 | Bar | Verdict |
  |------|--------|----------------------|-----|---------|
  | HP segments 1–10 | `--hp-seg-1` #E24B4A … `--hp-seg-10` #639922 | 4.24 – 7.67 (min is seg-1) | 3:1 graphic | pass, untouched |
  | Sparkline stroke + current dot *(before)* | `--brand-2` #534AB7 | **2.41** | 3:1 graphic | **fail** |
  | Sparkline stroke + current dot *(after)* | `--brand-line` #7871CA | **3.98** | 3:1 graphic | pass |
  | Sparkline best ring | `--marker-levelup` #5DCAA5 | 8.31 | 3:1 graphic | pass |
  | Section-bar mono caps | `--text` on `--panel-deep` | 16.74 | 4.5:1 text | pass |
  | Panel kicker mono caps | `--text-3` on `--panel-deep` | 5.36 | 4.5:1 text | pass |
  | Sheet row labels | `--text-3` on `--panel` | 4.63 | 4.5:1 text | pass |
  | `rank-current` / `rank-best` | `--label-rank` #9FE1CB | 11.21 | 4.5:1 text | pass |
  | Map control chips | `--text-2` on `--panel-deep` | 9.10 | 4.5:1 text | pass |

  Only one token changed. Spec §6 colours (`--brand-2` included) were **not** touched: the new
  `--brand-line` is the same hue lifted 30% toward `--brand-fg`, used only where a brand-purple
  line or border has to carry meaning. Disabled map controls (`--text-4` at 0.6 opacity) are
  exempt under WCAG 1.4.3's inactive-component exception.
- **Active trigger state.** With a panel open its trigger now says so visually as well as via
  `aria-expanded`: the crawler frame takes a `--brand-line` border and a `--brand-deep` wash
  (its `Lv N` / `HP` line steps up to `--text-2`, which keeps 6.79:1 over the wash), and the
  minimap badge takes the same border with a brighter header - no wash there, because the
  revealed cells are `--brand-deep` and would vanish into it. Both selectors key off
  `[aria-expanded='true']`, so the visual state cannot drift from the announced one.
- **Focus order.** The close control is the first focusable node in every panel; asserted in
  `EpisodePage.test.tsx` ("puts the close control first in every panel's focus order"), which
  also pins the map's order to close → Zoom in → Fit → viewport (Zoom out is disabled at the
  fit step and therefore out of the tab order).
- **Names.** Panel region is labelled by its title (`Harry - System record`, `Floor 1`); the
  focusable map viewport gained `role="group"` + `copy.mapViewportLabel`; the minimap badge's
  accessible name now opens with its visible text - **`Floor 1 - open the floor map`** instead
  of `Open the floor map` - because axe's `label-content-name-mismatch` (WCAG 2.5.3 Label in
  Name) flagged the old name. `contracts/panels.md`, `research.md` R9, `spec.md` FR-122 and
  `tasks.md` T101 still quote the bare string and need the author's amendment.
- **Reduced motion.** *Measured* with Chrome's `--force-prefers-reduced-motion=reduce`:
  computed `transition-duration` / `animation-duration` collapse from 0.2 s / 0.4 s / 0.15 s to
  1e-05 s on the crawler frame, the minimap badge, the HP fill, the rail panel (fade), the panel
  close button, the map scene transform and the map control chips. Component-level
  `prefers-reduced-motion` blocks back the global rule up in `PartyRail`, `MiniMapBadge`,
  `RailPanel`, `FloorMap` and `ResumeCard`; the dossier itself has no motion at all.
- **Escape ordering.** `usePanel` listens on `document` and closes an open `header details`
  first, the panel second (`EpisodePage.test.tsx` "lets the Episodes menu win the first
  Escape"). `ResumeCard` now calls `stopPropagation()` on the Escape it answers. Note for the
  author: because `document` bubbles *before* `window`, that call cannot actually pre-empt
  `usePanel` - if a viewer opens a dossier while the resume card is up, one Escape still does
  both. Making the card win needs a behavioural change (capture phase, or a guard in
  `usePanel`), so it was flagged rather than made.
- **Lighthouse accessibility 100** on `/ep/1` and `/`, with *no* audit scoring below 1 -
  including the zero-weight informational ones.

### Responsive (T132)

*Measured* in Chrome 152 headless. macOS clamps a headless window to 500 px, so the page was
loaded in a same-origin `<iframe>` at each width and `document.documentElement.scrollWidth`
compared with `clientWidth`, with a dossier and then the map open.

| Viewport | ambient | dossier open | map open |
|----------|---------|--------------|----------|
| 320 px | 320 / 320 | 320 / 320 | 320 / 320 |
| 360 px | 360 / 360 | 360 / 360 | 360 / 360 |
| 400 px | 400 / 400 | 400 / 400 | 400 / 400 |

No element's right edge exceeded the viewport at any width, in any of the three states.

- **Close reachable without scrolling**: the ≤ 900 px panel is `position: fixed; inset: 0` with a
  non-scrolling header, so the close button sits at `top: 8px`, `bottom: 36px` at every width -
  in view before any scrolling, on both the dossier and the map.
- **Scroll lock**: `body.panel-open` present and `overflow: hidden` computed at 320/360/400 px;
  absent at 1440 px, where the panel is a card in the rail rather than an overlay.
- **Dossier header grid**: the six definitions (Race, Pronouns, Crawler #, Level, Class, Floor)
  drop to a single column below 480 px - measured `grid-template-columns: 300px` at 320 px,
  `340px` at 360 px, `380px` at 400 px, six rows for six definitions.
- **Map controls**: one row at every width - 75 + 82 + 45 px, right edge 223 px, inside even a
  320 px viewport. `flex-wrap: wrap` was added so a longer translation wraps rather than
  overflows.
- **Desktop: the stage never moves.** *Measured* at 1440×900: the stage's
  `getBoundingClientRect` is `{x: 16, y: 60, width: 1072, height: 603}` both before and after
  opening Harry's dossier, and the rail column keeps its 320 px width (it grows 445 → 828 px
  tall, entirely within the viewport). The panel scrolls internally - body `scrollHeight` 963
  vs `clientHeight` 774, `overflow-y: auto` - so nothing in the stage column can reflow. The CSS
  reason: the rail is the grid's second track (`minmax(320px, 1fr)`) and the panel is capped at
  `calc(100vh - var(--header-h) - 2 * var(--space-6))` with `overflow: hidden` on the frame, so
  panel height can never feed back into the row. `EpisodePage.test.tsx` carries the structural
  half (jsdom has no layout): the stage node, its parent and the column's child order are
  identical across an open, and only the rail `<aside>`'s `data-panel` changes.

### Performance (T133)

`npm run build`, production build:

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `dist/assets/index-*.js` | 325.7 kB | **103.3 kB** |
| `dist/assets/index-*.css` | 30.7 kB | 6.4 kB |
| `dist/index.html` | 0.7 kB | 0.4 kB |

103.3 kB gzipped JS, against the ≤ 150 kB budget.

Lighthouse 11.7.1, desktop preset, `--headless`, against `npm run preview` (port 4173, stopped
afterwards):

| Route | Performance | Accessibility | FCP | LCP | TBT | CLS |
|-------|-------------|---------------|-----|-----|-----|-----|
| `/ep/1` | **100** | **100** | 0.4 s | 0.5 s | 0 ms | 0 |
| `/` | **100** | **100** | 0.4 s | 0.4 s | 0 ms | 0 |

Caveat, as in v1: localhost numbers on a fast machine. Lighthouse cannot open a panel - `?panel=`
is DEV-only - so these are the ambient page; the panels add no requests and no layout shift
above the fold (see the stage-rect measurement above).

### Copy (T134)

`grep -rniE "dashboard|\bhome\b|\bads?\b|advertisement" src/ index.html` → two hits, both code
comments quoting the constitution (`src/copy.ts:4`, `src/components/EventFeed/SponsorSlot.tsx:11`).
No user-facing string matches. Every v2 string lives in `src/copy.ts`; the new components contain
no hard-coded user-facing text. The System voice reads consistently across the dossier sections
and empty states ("No debuffs on record.", "Nothing carried.", "No moments logged."), the map
("SYSTEM CARTOGRAPHY", "6 of 96 sectors revealed, 2 neighborhoods named") and resume ("BROADCAST
BOOKMARK", "The System has your place marked."). One new string was added by T131:
`mapViewportLabel`, the focusable map viewport's name.

### Quickstart walk (T135)

*Measured* against the dev server with `?fake=1&t=…&panel=…`. Every claim in "Try the v2
features" above holds:

| Check | Result |
|-------|--------|
| `t=560` Harry | three-point sparkline, Current #6402 / Best #6402, Hotlist "Bronze Box Runner", Inventory Torch (+ Bent Pry Bar), Achievement "Gate Crasher" 2:34 |
| `t=300` | one point (#8890 current and best, no polyline), Hotlist "The Hoarder", Enchanted Crowbar back in Inventory |
| `t=289` (< 4:50) | Hotlist empty state |
| `t=259` (< 4:20) | "Unranked", no chart drawn |
| `t=239` (< 4:00) | "Unclassed" |
| `t=153` (< 2:34) | Achievements empty state |
| `t=560` X.O. | Signal Discipline Rank 2, Breach Charge Rank 1 |
| map `t=100 / 560 / 600` | 0 / 2 / 3 labels; summary "8 of 96 sectors revealed, 3 neighborhoods named" at 600 |
| party rank | present at `t=320` ("Party rank #61"), absent at `t=316` |

### Success criteria (T135)

- [x] **SC-101 - dossier open/switch/close by mouse and keyboard; content correct at event
      boundaries.** `EpisodePage.test.tsx`: open, switch without an intermediate close, toggle
      shut, close control, Escape with focus return to the frame, `aria-expanded` on every
      frame. Content swept at `t=560/300/289/259/239/153` in a real browser (table above).
      *Keyboard activation itself is the native `<button>` behaviour and was not separately
      driven with Enter/Space in a real browser - **manual, not run**.*
- [x] **SC-102 - the expanded map labels exactly the reveals ≤ t; zoom/pan/fit; close restores
      the feed.** `EpisodePage.test.tsx` labels at 100 / 180 / back to 100; `FloorMap.test.tsx`
      zoom steps, disabled limits, Fit reset, `+` / `0` keys; browser walk at 100 / 560 / 600.
      *Drag-to-pan is exercised only through synthetic pointer events in jsdom - a real
      mouse/touch drag is **manual, not run**.*
- [x] **SC-103 - a saved position ≥ 30 s produces the rejoin card; rejoin lands there; the last
      30 s and the end clear it.** `useResume.test.tsx` (22 tests: thresholds at 29 / 30 /
      duration−29, save cadence, `pagehide`, ended, retrying rejoin, throwing store) plus five
      page tests (rejoin seeks to 120 and the feed header reads 2:00, start-over clears, end
      clears, 10 s makes no offer, blocked storage is silent). *Private-window behaviour is
      covered by the blocked-storage test, not by an actual private window - **manual, not
      run**.*
- [x] **SC-104 - sparklines plot exactly the elapsed rank events and expose a text summary.**
      `EpisodePage.test.tsx`: three points and `copy.sparklineSummary(4188, 3550, 3, 3012)` at
      t=200, one point and no polyline at t=120, "Unranked" and no chart for a crawler with no
      rank events. Confirmed in the browser at t=560 / 300 / 259.
- [x] **SC-105 - no v1 regressions; Lighthouse ≥ 90; 360 px with a panel open has no horizontal
      scroll.** 326/326 tests (the v1 suite untouched); Lighthouse performance 100 /
      accessibility 100 on `/ep/1` and `/`; 360 px measured at 360/360 with a dossier and with
      the map open. *Firefox and Safari are **manual, not run** - this machine measured Chrome
      152 only.*
- [x] **SC-106 - the ambient view is unchanged except the new trigger affordances and the party
      rank line.** Every style added in Phase 7 is scoped to `[aria-expanded='true']`, so with
      no panel open the rail, badge and dossier styles compute exactly as before; the only
      always-on additions are the sparkline baseline (inside a panel) and the map viewport's
      accessible name. Checked against the 1440 px screenshots with and without a panel.
      *A pixel-diff against the v1 build was **not** run.*

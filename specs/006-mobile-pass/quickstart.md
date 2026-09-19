# Quickstart: Mobile pass

Run `npm run dev` (port 5180) for the dev URLs, or `npm run build && npm run preview` (port 4173)
for the production ones. Every URL below was opened and checked in Chrome 152 headless while
writing this file - the `4173` ones exactly as written, the dev ones on a second dev server at
`5199` so the author's own `5180` was left alone.

## Getting a phone viewport

Chrome DevTools **device mode** (⌥⌘I, then ⌥⌘M, or the phone icon in the toolbar):

1. Pick **Dimensions: Responsive** and type `400` × `800` - the size every "at 400 px" number in
   this document was measured at. `360 × 740`, `430 × 932` and `844 × 390` (landscape) are the
   other three checked here; the presets "iPhone SE", "Pixel 7" and "iPhone 14 Pro Max" land on
   the same layout.
2. Set the throttling menu to **No throttling** unless you are timing something, and leave
   **DPR** on auto.
3. Turn on **Show device frame** if you want the safe-area padding to look real, and use the
   rotate button to check landscape (the sheet grows to 85 vh and the mini frame shrinks).
4. Device mode emulates touch: the pointer becomes a touch pointer, so swipes between panes and
   the sheet's drag-to-dismiss work with a mouse drag. It does **not** emulate a real finger -
   the touch-accuracy items under **Manual acceptance** still need a phone.

On a real device: `npm run dev -- --host` and open the printed LAN address.

## The URLs

| URL | What to look at |
|-----|-----------------|
| `http://localhost:5180/ep/1?fake=1&t=580` | the whole phone layout mid-episode: stage, caption row, timeline, then the **Feed / Party / Map / Log** strip. Six feed rows are above the fold at 400 × 800 |
| `http://localhost:5180/ep/1?fake=1&t=580` → scroll ≈ 400 px | the stage docks as a mini-player top right, still playing, with **Return to the stage** across its bottom |
| `http://localhost:5180/ep/1?fake=1&t=580&panel=dossier:harry` | the glance opens straight as a bottom sheet (the `panel` flag is DEV-only) |
| `http://localhost:5180/ep/1?fake=1&t=580&panel=dossier:harry&record=1` | the full record, full-screen, above the sheet; closing it leaves you back on the sheet |
| `http://localhost:5180/ep/1?fake=1&t=120` / `&t=300` / `&t=620` | the panes at three playheads: 8 / 30 / 56 moments on the log, 0 / 3 / 8 sectors charted, Harry at Lv 1 / Lv 1 / Lv 2 |
| `http://localhost:4173/ep/1` | the production build with the real embed - what Lighthouse's mobile preset scores |
| `http://localhost:4173/ep/1` at 1440 × 900 | desktop, unchanged: no tab strip, the rail and the full-width log exactly as before |

## Walk it

1. `/ep/1?fake=1&t=580` at 400 × 800. The tab strip sits directly under the timeline and the
   **Feed** pane is open; the first feed row starts at y 451, six rows fit above the fold.
2. Swipe the pane area left: **Party** - five frames in two columns, the fifth spanning both.
   Swipe left again for **Map**, again for **Log**. Swipe right to come back. A swipe must be
   40 px and twice as horizontal as it is vertical, so scrolling the page never switches a pane.
3. Focus a tab and press ArrowRight / ArrowLeft (they wrap), Home and End. The pane changes with
   the focus - automatic activation, the WAI-ARIA tabs pattern.
4. **Map** tab: drag the floor map. It pans and the tab does **not** change - the pan viewport is
   marked `data-swipe-ignore`. Zoom in, fit, drag again, then switch tabs and come back: the zoom
   is where you left it, because the panes stay mounted.
5. **Log** tab: the broadcast log, already open, no toggle. Filters, row seek, share and
   **Follow the broadcast** all behave as they do on desktop.
6. Scroll down on the Feed or the Log tab until the stage leaves the top. The tab strip pins
   itself under the header - it is the way between panes, so it does not scroll away - and the
   player docks top right, just below it, still playing: same iframe, no reload. The space it
   came from does not collapse, so nothing below jumps. Tap **Return to the stage** to scroll
   back; the player grows back into its slot.
7. **Party** tab → tap a frame. The glance slides up as a sheet at 70 vh with the video still
   visible above it. Drag the handle down a little: it snaps back. Drag it past a quarter of its
   height: it closes, and focus is back on the frame. Backdrop tap, the × control and Escape do
   the same. **Open full record** opens the record full-screen above the sheet.
8. Rotate to landscape: the sheet grows to 85 vh, the mini frame shrinks to 170 px wide, the tabs
   and the selected pane survive the rotation.
9. Widen past 900 px: the desktop layout is back, unchanged.

## Manual acceptance

1. SC-501 dock/undock + slot height.
2. SC-502 fold + tabs (tap/swipe/arrows) + pane sweep.
3. SC-503 sheet open/close paths + video visible.
4. SC-504 Lighthouse a11y 100 at phone width, no horizontal scroll 360–430, desktop unchanged.

---

## Results

Phase 3 (T610–T612), Node 20.9.0, on the `006-mobile-pass` tree. *Measured* means a real Chrome
152 headless run driven over CDP (puppeteer-core 22.15: `Emulation.setDeviceMetricsOverride` via
`page.setViewport({ isMobile: true, hasTouch: true })`, `getBoundingClientRect`,
`getComputedStyle`, `elementFromPoint`, real mouse drags and key presses, scripted
`window.scrollTo`), Lighthouse 11.7.1 **mobile** preset against `npm run preview`, or axe-core
4.13.0 injected into the live page. Anything needing a human, a real finger, a real phone or a
second browser engine is marked **manual, not run**.

Headless Chrome 152 honours `setViewport` below 500 px on a page that declares
`width=device-width` - `innerWidth` reads 360 / 400 / 430 and `vh` units resolve against the
emulated height - so these runs drive the page directly at each size. The same-origin iframe
harness earlier waves used was not needed and no file was added to the repo.

### Gates (T612)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **663 passed / 37 files** ·
`npm run build` clean (`index.js` 369.24 kB / **116.30 kB gzipped**, `index.css` 59.23 kB /
10.59 kB, `index.html` 0.72 kB / 0.42 kB - 116 kB against a 150 kB budget). Waves 1–2 committed
662; wave 3 added one `MobileTabs` test for the `data-swipe-ignore` fix below. Against 005 the
mobile pass costs **+7.4 kB raw / +2.2 kB gzipped of JS** and **+4.7 kB / +0.8 kB of CSS**, and
adds no dependency.

### The swipe-ignore fix (T610)

Dragging the inline floor map on the **Map** tab moved the map *and* flicked the tab strip to the
next pane: both listen to pointer moves on the same surface. `MobileTabs` now drops any gesture
whose `pointerdown` target is inside an element marked `data-swipe-ignore`, and `FloorMap`'s pan
viewport carries the attribute. Measured in the browser at 400 × 800: a 180 px horizontal drag
across the map viewport changes the scene transform from `translate(0 0) scale(1)` to
`translate(-5.684 0) scale(1)` and leaves the selected tab on **Map**; the same drag on the
pane's own background still switches panes. Covered by
`MobileTabs.test.tsx` → *"leaves a gesture alone when it starts inside a `data-swipe-ignore`
pane"*, which also asserts the ordinary swipe still works. The timeline strip needed nothing: it
sits *above* the tab strip, outside the swipe surface, and a horizontal drag across it seeks
(measured: a 180 px drag moved the playhead from 9:40 to 6:08 and left the tab on **Feed**).
Neither did the log list, which scrolls vertically only.

### SC-501 - the mini-player docks without moving anything *(measured)*

Log tab, `window.scrollTo(0, 400)`, then back to 0. `stage-slot` is the wrapper, `video-stage`
the element that is repositioned, and the saved reference is the *same node object* compared
before and after - as is the fake player element inside it:

| Viewport | slot height before → docked → back | mini frame (x, y, w × h) | header | return bar |
|----------|-----------------------------------|--------------------------|--------|------------|
| 400 × 800 | **213.8 → 213.8 → 213.8** | `212, 88, 180 × 129.3` | 36 px | `178 × 28` at y 188.3 |
| 360 × 740 | **191.3 → 191.3 → 191.3** | `190, 88, 162 × 119.1` | 36 px | `160 × 28` at y 178.1 |
| 430 × 932 | **230.6 → 230.6 → 230.6** | `228.5, 88, 193.5 × 136.8` | 36 px | `191.5 × 28` at y 195.8 |
| 844 × 390 | **456.8 → 456.8 → 456.8** | `666, 88, 170 × 123.6` | 36 px | `168 × 28` at y 182.6 |

- `stage-slot[data-mini="true"]` at every size while scrolled, and the attribute is gone again
  after scrolling back to 0.
- **Node identity unchanged**: `document.querySelector('[data-testid="video-stage"]') === savedRef`
  is `true` docked and `true` again undocked, and so is the comparison for the player element
  inside it. (`outerHTML` is *not* a usable identity check here - the fake stage's clock readout
  ticks between the two reads.) The iframe is never re-parented, only repositioned by CSS.
- `stage-placeholder` is present throughout; the slot height is byte-identical to three decimal
  places before, during and after, so nothing below the stage moves.
- The mini frame's top is **88 px** at every size: `calc(var(--header-h-compact) + var(--tabstrip-h) + 8px)`
  = 36 + 44 + 8, i.e. clear of the compact header *and* of the sticky tab strip (below).
- **Return to the stage** is 28 px tall and `document.elementFromPoint` at its centre returns the
  button itself at all four sizes - nothing (not the iframe, not the toast) covers it.

**Landscape fix.** At 844 × 390 the frame was `260 × 174.3` - 45% of the screen's height, and it
reached down over the tab strip. `VideoStage.module.css` now caps `--mini-w` at 170 px under
`@media (max-height: 500px)`, which is the 170 × 123.6 in the table.

**The sticky strip, and the frame below it** *(author decision, implemented)*. Before this fix
the frame was at y 56 and the tab strip was in the flow, so the strip slid underneath it: it
covered the strip's right-hand half - the **Map** and **Log** tabs, 191.5 × 44 px of it - for a
stretch of scroll at every size, and at 430 × 932 permanently, because the Log pane's list
scrolls inside its own bounded area and the document's scroll ends with the strip parked behind
the frame. The strip is now `position: sticky; top: var(--header-h-compact); z-index: 16` with an
opaque `--canvas` background and its hairline border, and the frame is offset by exactly the
strip's height. `--tabstrip-h: 44px` in `tokens.css` is the one place that number is written:
`MobileTabs.module.css` uses it for the tab's `min-height`, `VideoStage.module.css` for the
frame's `top`, so the two cannot drift.

Measured on the Log tab (the longest pane) at `scrollTo(0, 400)` and again at the end of the
document - 430 × 932's end-of-document position is the case that used to fail:

| Viewport | strip when resting | mini frame top | gap strip → frame | Feed / Party / Map / Log hit test |
|----------|--------------------|----------------|-------------------|-----------------------------------|
| 400 × 800 | stuck at y **36**, 380 × 44 | 88 | **+8 px** | all four hit their own button |
| 360 × 740 | stuck at y **36**, 340 × 44 | 88 | **+8 px** | all four |
| 430 × 932 | y **46.6**, 410 × 44 | 88 | −2.6 px | all four |
| 844 × 390 (end) | stuck at y **36**, 812 × 44 | 88 | **+8 px** | all four |

Then swept: every 10 px of scroll over the whole document, on the Log tab, hit-testing all four
tab centres whenever the frame is docked - **0 samples blocked** at 400 × 800 (38 docked steps),
360 × 740 (42) and 430 × 932 (33). The 12 samples the sweep flags at 844 × 390 return `none`, not
the frame: the strip's centre is momentarily below the viewport's bottom edge on the way up. **No
tab is ever covered by the mini-player at any size or any scroll position.**

Two residues, both cosmetic and both recorded rather than chased:

- At **430 × 932** the document cannot scroll far enough for the strip to reach its sticky offset
  (max scroll 345 px leaves it at y 46.6), so the frame's top edge overlaps the strip's bottom
  **2.6 px** - the underline, not a label. All four tabs still hit-test to themselves. Making it
  exact would mean giving every pane a viewport-tall `min-height` so the strip always reaches the
  top, i.e. up to a screenful of dead space at the bottom of short panes, which is a worse trade
  than 2.6 px.
- While the strip *travels* up to its sticky position it necessarily crosses the fixed frame's
  band; at 844 × 390 the crossing leaves the strip's top edge covered by up to 10.3 px mid-scroll.
  The tab centres stay clear throughout (the sweep above), and the resting state is clean.

### SC-502 - the fold, and four ways to change pane *(measured)*

**Above the fold**, at load, `/ep/1?fake=1&t=580`, no scrolling:

| Viewport | tab strip | first feed row | rows fully visible |
|----------|-----------|----------------|--------------------|
| 400 × 800 | y 374.8, 44 px tall | **y 450.7** | **6** of 8 (7 started) |
| 360 × 740 | y 352.3 | y 428.2 | 5 of 8 (6 started) |
| 430 × 932 | y 391.6 | y 467.6 | 8 of 8 |
| 844 × 390 | y 601.3 | y 677.2 | 0 - see below |

Those are the strip's *flow* positions, at load with nothing scrolled - unchanged by the sticky
rule, which only takes effect once the strip reaches `top: var(--header-h-compact)`. Fold, sheet
heights and the no-horizontal-scroll checks were all re-measured after the change and are
identical to the numbers they were before it.

Two rows was the bar (research R4 predicted 2–3); six fit at 400 × 800, so the timeline legend
was **left alone** - it wraps to two 14.5 px lines under 430 px and costs 33 px, and collapsing
it would have bought height nothing needs. In landscape (844 × 390) the stage alone is 456.8 px
tall, so the strip and the panes are below the fold by construction; the spec's fold criterion is
the 400 × 800 portrait case.

**Switching panes**, driven with real input at 400 × 800:

| Input | Result |
|-------|--------|
| tap **Party** | Party selected |
| ArrowRight / ArrowLeft from Party | Map / Party - focus moves with the selection |
| End / Home | Log / Feed |
| mouse drag −240 px across the pane area | next pane (Feed → Party) |
| mouse drag +240 px | previous pane (Party → Feed) |
| 180 px drag inside the map's pan viewport | pane unchanged, map panned (see the fix above) |

**The panes follow the playhead** - same URL, four playheads, read straight off the live page:

| `?t=` | clock | first feed row | Map pane | Log pane |
|-------|-------|----------------|----------|----------|
| 120 | 2:00 | 1:58 Skill · X.O. logs Ledger Sense | 0 of 96 sectors, "No sectors charted yet." | 8 moments |
| 300 | 5:00 | 5:00 Skill · X.O. logs Swamp Step | 3 of 96 sectors | 30 moments |
| 580 | 9:40 | 9:40 Map · New neighborhood revealed: The Gutter | 8 of 96 sectors | 55 moments |
| 620 | 10:20 | 9:54 Note · Recap ends. Vitals logged. | 8 of 96 sectors | 56 moments |

Harry reads Lv 1 · 12/22 at 2:00 and Lv 2 · 18/22 at 9:40 on the Party tab. The page's own suite
(`EpisodePage.phone.test.tsx`, plus the boundary sweeps in `EpisodePage.test.tsx`) asserts the
same thing at every event boundary, forward and back.

**Party grid** (US4), frame rects at 400 × 800: four frames of 186 px in two columns at x 10 and
x 204, then the fifth at `10, 380 × 82` - spanning both columns. `grid-template-columns` computes
to `186px 186px` (166 / 201 / 402 px at 360 / 430 / 844). Five frames, three rows, two distinct
left edges at every size.

**Map pane**: the floor-map viewport is **253.3 / 226.7 / 273.3 / 273.0 px** tall at
400 / 360 / 430 / 844 - comfortably over the 200 px floor at 360. The zoom, fit and zoom-out
controls were **25.9 px** tall, under the 32 px this pass measured for; `FloorMap.module.css`
now gives `.control` `min-height: 32px` under `@media (max-width: 900px)`, and all three now
measure **32 px** at every phone size. Desktop is untouched by that rule.

**Log pane**: open with no toggle, 55 rows and the header count *"55 moments on the log"* at
every size; `log-toggle` is absent, as `embedded` intends.

**No horizontal scroll**: `documentElement.scrollWidth === clientWidth` on **every tab** at every
size - 400 = 400, 360 = 360, 430 = 430, 844 = 844 - and again with the sheet open.

### SC-503 - the glance as a bottom sheet *(measured; met in portrait, see the landscape note)*

| Viewport | sheet height | % of viewport | video visible above it |
|----------|--------------|---------------|------------------------|
| 400 × 800 | 560 px | **70.0 vh** | 182 px of the stage |
| 360 × 740 | 518 px | **70.0 vh** | 164 px |
| 430 × 932 | 652.4 px | **70.0 vh** | 221.6 px |
| 844 × 390 | 331.5 px | **85.0 vh** | **0 px** - by design, see below |

`data-presentation="sheet"`, the grab handle, the dim backdrop and the × control are present at
every size, and `body.panel-open` is set while it is open.

**Landscape covers the player, and that is the decision** *(author decision, recorded)*. The
spec's edge case asks for 85 vh on a viewport under 500 px tall, and 85% of 390 px leaves 58.5 px
- which the header and the docked frame's own top offset use up, so the sheet covers the player
at 844 × 390. **85 vh stays**: a glance card on a 390 px-tall screen needs the height to be
readable at all, and SC-503's "the video remains visible above it" is a portrait criterion (the
spec states the acceptance scenario at 400 × 800). SC-503 is met in portrait - 182 / 164 /
221.6 px of visible picture at 400 / 360 / 430 - and the landscape row is documented here and in
the README rather than treated as a defect. Nothing was changed for it.

**Every close path**, driven for real at 400 × 800 (sheet height 560 px, threshold 140 px):

| Path | Sheet | Focus afterwards | `body.panel-open` |
|------|-------|------------------|-------------------|
| drag the handle 56 px (10%) | **stays open** - snaps back | - | still set |
| drag the handle 224 px (40%) | closes | the crawler frame, `aria-expanded="false"` | cleared |
| tap the backdrop | closes | the crawler frame | cleared |
| the × control | closes | the crawler frame | cleared |
| Escape | closes | the crawler frame | cleared |

**Open full record** from inside the sheet opens the record at `0, 0, 400 × 800` - full-screen -
with the dialog layer at `z-index: 30` over the sheet's `20`; Escape closes the record, the sheet
is still there behind it, and focus lands back on **Open full record**.

### SC-504 - accessibility, no horizontal scroll, desktop unchanged *(measured)*

**Lighthouse 11.7.1, mobile preset** (412 × 823, DPR 1.75, simulated throttling), `npm run
preview`, real YouTube embed loading, `/ep/1`:

| Category | Score |
|----------|-------|
| **Accessibility** | **100** |
| Performance | **99** - FCP 1.5 s, LCP 2.0 s, TBT 0 ms, **CLS 0** |
| Best practices | 96 |
| SEO | 85 |

No accessibility audit fails, and none is left unscored by a missing element. CLS is **0** on
mobile, which is what the stage placeholder is for. Two non-accessibility notes, both
pre-existing and neither introduced by this feature:

- **Best practices 96** - one `inspector-issues` entry, a third-party cookie from the YouTube
  embed.
- **SEO 85** - `robots-txt` (the preview server answers `/robots.txt` with the SPA fallback, a
  local-serving artifact) and `font-size`, which flags the app's 10–11 px mono-caps type as
  below its 12 px "legible" line: the timeline tooltip and legend, the feed's standby line, the
  caption title, the episodes menu labels, the log's section bar and - new this feature - the
  tab labels, which follow the same house convention. It is an SEO heuristic, not a WCAG rule;
  accessibility scores 100 and axe finds no contrast or text fault on any of them.

**axe-core 4.13.0, every rule enabled**, over the live page at **400 × 800 and 844 × 390**, on
the preview build:

- **No violations** on the Feed, Party, Map or Log tab; **none** with the mini-player docked;
  **none** with the glance sheet open. Twelve runs, zero violations.
- Two *incomplete* (needs-review) items, both benign: `color-contrast` on the feed's aria-hidden
  " · " separators ("element content is too short to determine if it is actual text content"),
  and `aria-valid-attr-value` on **Open full record**, where axe cannot resolve
  `aria-controls="crawler-record"` because the dialog it points at is not mounted until the
  button is pressed - the documented limitation for `aria-haspopup="dialog"`.
- On the **dev** page (`?fake=1`) the one violation anywhere is `color-contrast` on
  `._fakeLabel_`, the dev scrubber's own label. It uses `--text-4`, the token documented in
  `tokens.css` as decorative/dev chrome, and it is compiled out of production builds - the same
  finding the 004 and 005 Results record.

**Desktop unchanged** *(measured)*. The pre-006 tree (`01fee17`, the 005 merge) was exported with
`git archive` and served beside the current one; both were shot at **1440 × 900** on
`/ep/1?fake=1&t=580` with the clock readouts hidden so the two are comparable:

- **0 differing pixels** of 1,296,000 (max channel delta 0). Identical again with the rail panel
  open (`&panel=dossier:harry`).
- The rects agree exactly: `video-stage` `16, 60, 1072 × 603`, caption row `16, 673, 1072 × 22`,
  party rail `16, 755, 1072 × 91`, log `16, 870, 1408 × 36`, the rail `<aside>`
  `1104, 60, 320 × 595`, document height 918 px.
- The one structural change wave 1 made - `stage-slot` wrapping `video-stage`, with an
  `aria-hidden` `stage-placeholder` holding the 16:9 box - measures `16, 60, 1072 × 603` on
  desktop, i.e. exactly the box the stage already occupied. It is invisible, which the pixel
  diff confirms.
- `mobile-tabs` is absent on desktop and the rail `<aside>` present, as FR-505 requires; the
  phone tree is the mirror image.

**Resizing across the breakpoint** *(measured)*: from 400 × 800, rotating to 800 × 400 and
widening to 880 px keeps the *same* `video-stage` node and the same selected tab (Map). Crossing
to 1000 px swaps to the desktop tree - a different node, so the embed reloads - and coming back
to 400 × 800 gives a third node with the tab selection reset to Feed. That is inherent to the two
trees being different React subtrees; it is recorded in the README so nobody reads it as a bug.

### Manual, not run

These need a human and are **not** claimed here:

- A **real touch** swipe between panes, and a real finger on the sheet's handle: device mode
  synthesizes a touch pointer from a mouse, which exercises the same code path but not the same
  ergonomics (flick velocity, palm contact, the 40 px threshold against a thumb's natural arc).
- **Real phone Safari and Chrome on Android**: everything here is one Chrome 152 engine.
  `env(safe-area-inset-*)`, `-webkit-fill-available`, iOS Safari's collapsing URL bar against
  `vh` units, and whether the YouTube embed survives repositioning on a real iOS device are all
  unverified on hardware.
- **Screen readers**: VoiceOver (iOS) and TalkBack (Android) reading the tab list, the docked
  mini-player's return bar and the sheet. The roles, names and states are asserted by axe and by
  the unit tests, but no screen reader has been driven over this page.
- **Playback continuity through a real dock**: the identity checks prove the element is never
  re-parented and the fake source keeps running, but nobody has watched a real YouTube stream
  dock and undock on a phone without a stutter.
- **A sticky bar against a real mobile browser's chrome.** `position: sticky` under a header that
  itself shrinks on scroll is measured here against Chrome's emulated viewport only; iOS Safari's
  URL bar collapsing and re-expanding mid-scroll is the case a phone would have to confirm.

Both items the previous pass left open have since been decided by the author and are no longer
open: the tab strip is sticky with the mini-player docked below it (SC-501), and the landscape
sheet keeps 85 vh and covers the player by design (SC-503).

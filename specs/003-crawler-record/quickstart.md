# Quickstart: Crawler Record

Same toolchain as before. Dev server: `npm run dev` (port 5180).

## Try it

Revision 2 re-verified every time below against `public/data/ep1.json` on 2026-09-15. **t=580**
(9:40) is the one moment that exercises both overflow cases at once: Harry's Hotlist reaches
eleven entries at 9:32, and X.O. has logged ten skills by 8:25.

- `http://localhost:5180/ep/1?fake=1&t=580&panel=dossier:harry` → Harry's glance card in the
  rail. Top to bottom it reads:

  | Row | Value at `t=580` |
  |-----|------------------|
  | Header | Harry · Harold the Unhoused · played by Marcus · Compensated Anarchist · Lv 2 |
  | HP | `HP` + nine of ten segments filled, 18/22 |
  | Rank | `RANK` **#6402** ↑ 813, Best **#6402**, sparkline over three points (8890 → 7215 → 6402) |
  | Debuffs | "No debuffs on record." |
  | Equipped | `Hands · Torch`, then `Legs · Work Trousers` |
  | Latest achievement | **Gate Crasher** 2:34 - "Killed 10 mobs with a door." |
  | Recent moments | 9:32 hotlist bulk add · 9:10 hotlist swap · 8:40 climbs to #6402 |

  Then the one control: **Open full record**. No ledger rows, and no "-" placeholders anywhere.

- `…&panel=dossier:actress` at the same time → the *thinnest* crawler: "Unranked" with the
  label kept and no sparkline drawn, two worn slots, one achievement, and only **two** recent
  moments (nothing padding the third). The card is exactly as tall as Harry's (R2-SC-201).
- `http://localhost:5180/ep/1?fake=1&t=580&panel=dossier:harry&record=1` → the record open on
  load (DEV only - `panel` and `record` are stripped from production builds). Harry's sheet is
  the full-art case: **ten hotbar keys filled in order** (Bronze Box Runner, The Hoarder, The
  Doorway, Quadrant C, The Rot Market, The Gutter Stair, Grull Industries, The Butcher, Signal
  Tower, The Quartermaster) with **+1** after key ten for Floor Two, a Gear sheet reading Hands ·
  Torch and Legs · Work Trousers with "-" in the other five slots, and **View all (17)** under
  History.
- `http://localhost:5180/ep/1?fake=1&t=580&panel=dossier:xo&record=1` → the bust-fallback case
  (X.O. carries no `art`) and the tile-overflow case: **SKILLS shows eight tiles and offers
  "View all (10)"**. Click it: the body becomes the full ten-row list, the title becomes
  "X.O. - SKILLS", focus lands on the SKILLS heading, and **Back to record** (or
  <kbd>Escape</kbd>) returns to the sheet with focus on the **View all** button. A second
  <kbd>Escape</kbd> closes the record and focus lands back on **Open full record**.
- Drag the scrubber while the record is open - in the sheet *or* in a list view. Back past 7:43
  Harry's Hands slot returns to the Enchanted Crowbar; back past 5:30 X.O.'s skills list gets
  shorter under you. The dialog neither closes nor moves.
- Resize to ≤ 900 px: the record fills the screen, the art becomes a banner above the identity,
  and the hotbar wraps to two rows of five with **+1** right-aligned beneath.

## Manual acceptance

1. R2-SC-201: glance card height equal for Harry (most items) and The Actress (fewest) at
   1440×900; no scroll; no "-" placeholder rows anywhere on the card.
2. R2-SC-202: sweep `?t=` across the gear and achievement boundaries in `ep1.json`
   (0, 40, 78, 100, 150, 200, 260, 300, 380, 440, 462, 463, 464, 465, 500, 528, 560, 580, 594),
   forward and backward; Equipped and Latest achievement match the log at every stop.
3. R2-SC-203: ten hotbar slots in hotlist order with "+N"; tile grids cap at eight; "View all"
   opens the list view, **Back to record** and <kbd>Escape</kbd> return to the sheet, a second
   <kbd>Escape</kbd> closes the record; focus goes heading → View all → Open full record.
4. R2-SC-204: Lighthouse accessibility 100 on the preview build and on the dev record URL; no
   horizontal scroll at 360 px in the sheet or in a list view.
5. R2-SC-205 (carried from revision 1): `npm test` green.

---

## Results (revision 1)

Phase 3 (T313–T315), run on Node 20.9.0 against the current `003-crawler-record` tree.
*Measured* means a real Chrome 152 headless run (CDP: `Emulation.setDeviceMetricsOverride`,
`getBoundingClientRect`, `Input.dispatchKeyEvent`) or Lighthouse 11.7.1; anything that needs a
human or a second browser engine is marked **manual, not run**.

### Gates (T315)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **370 passed / 21 files**
(368 before Phase 3; +1 `CrawlerGlance` test for the sparkline row, +1 `EpisodePage` test for
the banner landmark, and one extra assertion in `FullRecordDialog`) · `npm run build` clean.

### T313 polish - two fixes from the visual review

1. **The rank sparkline has its own row.** Beside the rank numbers the rail squeezed the
   120×32 chart to ~80×21. It now sits on a full-width row under `CURRENT … BEST …`, drawn at
   its natural 120×32 (*measured*). The row is reserved even when `RankSparkline` draws nothing,
   so "Unranked" keeps the card's height. (The chart cannot fill the row's full 298 px at 32 px
   tall: its 120×32 `viewBox` with the default `preserveAspectRatio` caps it, and
   `RankSparkline.tsx` is v2 code this phase did not touch. A wider chart would need either a
   ~72 px row or `preserveAspectRatio="none"` on the SVG - author's call.)
2. **No second banner landmark.** `FullRecordDialog`'s title bar was a `<header>` directly
   inside `role="dialog"`, which computes as a `banner` next to the site header's
   (axe `landmark-no-duplicate-banner` / `landmark-unique`). It is a `<div data-testid=
   "record-header">` now, with the same styles and the same `aria-labelledby` target; the
   identity cell that wraps `DossierHeader`'s blue band became a `<section>` so that band's
   `<header>` is scoped too. *Measured*: axe-core 4.10.2 over the open record reports **0
   violations** at 1440×900 and at 360 px (before: `landmark-no-duplicate-banner`).
3. **One more finding, fixed while there**: the record's scrolling body holds no controls, so a
   keyboard could not scroll it (axe `scrollable-region-focusable`, WCAG 2.1.1). `record-body`
   now carries `tabIndex={0}` and joins the dialog's focus cycle.

### SC-201 - the glance card is one height *(measured)*

At 1440×900, `?fake=1&t=560`, `getBoundingClientRect().height` of `[data-testid="crawler-glance"]`:

| Crawler | Card height | Panel body `scrollHeight` / `clientHeight` |
|---------|-------------|--------------------------------------------|
| `dossier:harry` (1 hotlist, 1 skill, 2 items, 1 achievement, 3 moments) | **473.77 px** | 494 / 494 - no scroll |
| `dossier:actress` (0 hotlist, unranked, 2 moments + placeholder) | **473.77 px** | 494 / 494 - no scroll |

Equal to the sub-pixel. Two rows had to be pinned to get there: the sparkline row (above) and
`.historyRow`'s `min-height: calc(var(--text-xs) * 1.5)` - the "-" placeholder's smaller mono
type left the card 3 px shorter before. Both are in rem/token units, so the type scale at
wider breakpoints cannot reopen the gap.

### SC-202 - every count and newest entry matches the log *(measured)*

A 34-point sweep (17 times forward, the same 17 backward) over Harry's event boundaries
(0, 20, 72, 105, 154, 179, 240, 260, 290, 297, 394, 410, 461, 520, 550, 560, 600) read the four
ledger rows out of the live page and compared them with a model built straight from
`public/data/ep1.json` (hotlist/inventory add-remove, loot, skill upsert, achievements) with no
app code involved: **0 mismatches**, in both directions. The unit suites
(`selectors.test.ts`, `CrawlerGlance.test.tsx`) cover the same invariant at t=0 and on
backward seeks.

### SC-203 - modality *(measured, Chrome only)*

- Opening from **Open full record** puts focus on `record-close`; seven real `Tab` /
  `Shift+Tab` key events cycle `record-close → record-body → record-close …` and never leave the
  dialog.
- Escape, a backdrop click, and the close control each close only the record, leave the glance
  card open, and return focus to **Open full record** (all three *measured*).
- Playback is untouched: pressing Play then opening the record leaves the button reading
  "Pause" and the playhead running (t 560 → 562 across 2.2 s with the dialog open).
- Live update: a seek back to t=400 with the record open swaps Inventory from
  `Bent Pry Bar, Torch` to `Bent Pry Bar, Enchanted Crowbar`; the dialog stays open and stays
  at x=120. *Note for the author*: the sheet is centred in the backdrop, so when a seek shrinks
  the content below the 90 vh cap the box does re-centre vertically (y 45 → 88 in that seek).
  It never closes, remounts, or loses scroll position, but "does not move" (US2 scenario 2) is
  only strictly true while the content exceeds 90 vh. Anchoring the dialog to a fixed top would
  fix it and is outside this phase's brief.
- **Manual, not run**: keyboard trapping in Firefox and Safari, and screen-reader announcement
  of the dialog.

### SC-204 - accessibility and small screens

- **Lighthouse 11.7.1, desktop preset, `npm run preview` (production build), `/ep/1`:
  performance 100, accessibility 100** (FCP 0.4 s, LCP 0.5 s, TBT 0 ms, CLS 0, SI 0.4 s), 23
  scored accessibility audits, none below 1.
- The DEV-only `?panel=` / `&record=1` flags do not exist in the production bundle, so the
  record was audited in a second run against the dev server
  (`/ep/1?fake=1&t=560&panel=dossier:harry&record=1`): **accessibility 100**, 23 scored audits,
  none below 1 (the run's own screenshot shows the record open). Dev-mode performance numbers
  from that run are meaningless and were not collected.
- axe-core 4.10.2 injected directly, all rules including best-practice: **record 0 violations**
  at 1440×900 and 360 px. The ambient and glance states report one violation, `color-contrast`
  on `._fakeLabel_` - the "SIMULATED BROADCAST - DEV SCRUBBER" caption, which is behind
  `import.meta.env.DEV` and absent from the build Lighthouse scored 100.
- Contrast of everything new *(measured, computed over the real composited backgrounds)*:
  ledger count chip `--text-2` on `--panel-deep` **9.10:1**, ledger newest `--text` on
  `--panel` 14.44:1, ledger label / empty phrase `--text-3` on `--panel` 4.63:1, **Open full
  record** `--brand-fg-2` on `--brand-2` **6.00:1**, rank values `--label-rank` 11.21:1,
  sparkline stroke and current dot `--brand-line` 3.98:1 (3:1 graphic bar), best ring
  `--marker-levelup` 8.31:1. 129 text and graphic nodes checked across the card and the record;
  the only sub-bar paint is the sparkline's decorative floor (`--hairline-2`, 1.71:1), which
  carries no data - the series is in the SVG's `aria-label` - and is v2's, unchanged.
- **360 px and 400 px with the record open** *(measured)*: `document.documentElement.scrollWidth
  === clientWidth` (360/360 and 400/400) and the same for the record's own body, so no
  horizontal scroll; the close control sits at y=10, 28×28, fully in view without scrolling; the
  sections stack in sheet order at one x - Hotlist 620.9 → Skills 691.3 → Inventory 762.3 →
  Achievements 862.7 → History 949.1. The only off-viewport node is the skip link at x=-9999.
- **Glance card at 360 px** inside the panel's full-screen overlay: 340×439.2, no horizontal
  scroll, sparkline row intact. At 500 px (the review's second width) the same overlay reads
  cleanly; the only nit is the `ACHIEVEMENTS` ledger label ellipsizing in its 6.5em column,
  which is v2 behaviour and unchanged.
- `body.panel-open` and `body.dialog-open` are both set with the record open; closing the record
  leaves `panel-open`, closing the panel leaves `class=""`. No leaked lock.

### SC-205 - nothing else moved

370 tests green across 21 files, including every v1/v2 suite. The only files this phase touched
are `CrawlerGlance` (tsx/css/test), `FullRecord` (tsx/test), `EpisodePage.test.tsx`, and docs -
no engine, data, script, or page-wiring change.

---

## Results (revision 2)

Wave R2-3 (T328–T331), run on Node 20.9.0 against the current `003-crawler-record` tree.
*Measured* means a real headless Chrome 152 run driven over CDP (`page.setViewport`,
`getBoundingClientRect`, `Range.getClientRects`, real `Input` key events), axe-core 4.10.2
injected into the live page, or Lighthouse 11.7.1; anything needing a human or a second browser
engine is marked **manual, not run**. The dev server ran on :5199 and the production preview on
:4173 so the author's own :5180 was left alone.

### Gates (T331)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **444 passed / 21 files**
(438 before this wave; +6 `EpisodePage` tests for T328 - hotbar, gear, the equip sweep, tile
caps and the list view, the Escape order, and the art/bust column) · `npm run build` clean
(`index.js` 350.01 kB / 110.11 kB gzipped, `index.css` 47.61 kB / 8.82 kB gzipped).

### T330 - the five fixes the visual review asked for, and two it turned up

1. **The identity grid no longer breaks values mid-word.** `.rowValue` was `overflow-wrap:
   anywhere`, so beside the art column the sheet printed "10,491,2 / 01", "Compensate / d
   Anarchist", "they/the / m". It is `overflow-wrap: normal; word-break: keep-all` now, the
   crawler number is `white-space: nowrap` with tabular figures, and the definition grid is
   `repeat(auto-fit, minmax(150px, 1fr))` so it drops to one column whenever its *cell* is too
   narrow for two tracks - no viewport media query can get that wrong. The record's top band is
   two columns (identity | vitals) with the **STATS** strip full width beneath, which both
   widens the identity cell and fills the dead space the five stat boxes used to leave.
   *Measured* at 1440×900: identity cell **406.6 px** wide, two 198 px tracks, and a
   `Range.getClientRects` pass over every value in the grid reports **0 words split across
   lines** (before: 4).
2. **Hotbar names wrap between words and truncate honestly.** `overflow-wrap: break-word` with
   `word-break: normal` and a two-line `-webkit-line-clamp`, one pixel smaller than the slot's
   own type: "The Quartermaster" now reads "The / Quarterma…" in a 76.8 px key instead of
   "The / Quartermast / er". Nothing is lost - the whole name is in the DOM and every key
   carries `aria-label="Slot 10, The Quartermaster"` (empty keys read "Slot 4, empty"), with no
   `title` attribute, which constitution III forbids on something that does nothing.
   **The `+N` marker moved.** As an eleventh item in a ten-column grid it wrapped under key one;
   the bar now grows an `auto` end track when it overflows. *Measured*: keys at x = 477.7 …
   1204.9 (76.8 px each, y = 483.2), **"+1" at x = 1285.7, same y** - after key ten, right
   aligned. At ≤ 900 px the bar is 5 × 2 and the marker takes a right-aligned row beneath it.
3. **The "·" separator carries its own spacing.** The glance card's rows are flex containers,
   which trim the literal spaces around a glyph, so Equipped read "HANDS·Torch". The dot is now
   bare text with `margin: 0 0.35em`, in the glance card, the dossier header and the party
   frame alike. *Measured*: 4.55 px either side, and the accessible name is still
   "Hands, Torch" (the dot is `aria-hidden`, an sr-only comma sits beside it).
4. **The sparkline stops clipping its dots.** An SVG root clips to its viewBox, and the
   current/best markers sit one pad-width from the edge with radii that outgrow that pad once
   the glance row stretches the box. *Measured* at t=580: the best-rank ring's right edge landed
   exactly on the viewBox edge (overflow +0.00 px) and the baseline 0.5 px below it. `overflow:
   visible` on the `<svg>` (CSS and the presentation attribute) lets them paint whole; the
   record's unstretched chart is unchanged.
5. **The bust fallback hung a thousand pixels down** (found while re-shooting X.O.). The art
   column spans the whole sheet - 1377 px for X.O. - and the bust was `align-self: center`, so
   it sat below the fold with an empty column above it. It is `flex-start` now, 17 px from the
   top of the column, where the full-figure art hangs. *Measured* from the screenshots.
6. **Empty hotbar keys failed contrast** (found by axe). The slot was the lit key at
   `opacity: 0.4`, which dropped its slot number to ~1.6:1. The dim state is carried by the
   dashed hairline and the deep fill instead, and the number keeps `--text-3` at full strength
   (4.63:1). axe on X.O.'s record - one key filled, nine empty - went from one serious
   `color-contrast` violation to **0**.
7. **The page scrolled 535 px sideways at 360 px** (found while measuring R2-SC-204). The party
   rail's phone scroll strip (T339) leaked its overflow to the root box even though every
   painted node sat inside the viewport: `document.documentElement.scrollWidth` read **895** at
   a 360 px viewport and `window.scrollTo(600, 0)` really moved the page onto blank canvas.
   `contain: paint` on the strip is the only declaration that stops it - `overflow-x: clip`,
   clipping an ancestor and `body { overflow-x: hidden }` all leave the root scrollable. After:
   **360 / 360**, and the same at 400 and 500 px. Nothing about the strip looks different.

### R2-SC-201 - the glance card is one height *(measured)*

At 1440×900, `?fake=1&t=580`, `getBoundingClientRect().height` of `[data-testid="crawler-glance"]`:

| Crawler | What they have at 9:40 | Card height | Panel `scrollHeight` / `clientHeight` |
|---------|------------------------|-------------|----------------------------------------|
| `dossier:harry` | ranked (3 points, ↑ 813), 2 worn slots, 1 achievement, 3 moments | **510.27 px** | 583 / 583 - no scroll |
| `dossier:actress` | **unranked** (no chart drawn), 2 worn slots, 1 achievement, **2** moments | **510.27 px** | 583 / 583 - no scroll |

Equal to the sub-pixel, and the second card is a row short in two different sections. A DOM
sweep for a text node reading exactly "-" over both cards returns **0 nodes**: the placeholder
rows the author asked about are gone and the height is held in CSS (`min-height` on the
equipped and moments blocks, a reserved 32 px sparkline row).

### R2-SC-202 - equipped and latest achievement follow the playhead *(measured)*

A 76-reading sweep - 19 times forward and the same 19 backward, for Harry and for X.O.
(0, 40, 78, 100, 150, 200, 260, 300, 380, 440, 462, 463, 464, 465, 500, 528, 560, 580, 594),
chosen to land on both sides of every `equip` / `unequip` / `achievement` in `ep1.json` - read
the live card's equipped rows and latest-achievement line and compared them against a model
built straight from the JSON with no app code in the loop: **0 mismatches**, in both
directions. The same boundaries are pinned in `EpisodePage.test.tsx` against the fixtures
(t = 0, 140, 160, 168, 169) and in `selectors.test.ts`.

### R2-SC-203 - hotbar, tiles, list views, focus *(measured, Chrome only)*

Driven with real clicks and real `Escape` / `Tab` key events on X.O.'s record at t=580:

| Step | Result |
|------|--------|
| Open | `view="sheet"`, focus on `record-close`, glance card and rail panel still behind it |
| Hotbar | **10** slots, 1 filled, order matches the hotlist; Harry at the same time: 10 filled + "+1" |
| Tiles | SKILLS renders **8** tiles and a **View all (10)** button |
| View all | `view="skills"`, title **"X.O. - SKILLS"**, **10** list rows, focus on the `SKILLS` heading, the art column gone |
| Escape #1 | back to `view="sheet"`, title back to "X.O. - full record", focus on `view-all-skills`, record still open, `body.dialog-open` still set |
| Escape #2 | record closed, glance card and rail panel intact, focus on `open-record` |
| Back to record | same as Escape #1 (focus returns to `view-all-skills`) |
| Tab ×8 | cycles `view-all-history → record-close → record-body → view-all-skills → …`, every stop inside the dialog |

Live updating inside a list view is covered by `EpisodePage.test.tsx` (seek 200 → 100 takes
X.O.'s open SKILLS list from 9 rows to 3) and by the scrubber walk above.
**Manual, not run**: Firefox and Safari focus trapping, and screen-reader announcement.

### R2-SC-204 - accessibility and small screens

- **Lighthouse 11.7.1, desktop preset - accessibility 100 on all three runs**, 23 scored audits,
  none below 1:
  - `npm run preview` (production build) `/ep/1`: **performance 100, accessibility 100**
    (FCP 0.4 s, LCP 0.6 s, TBT 0 ms, CLS 0, SI 0.4 s).
  - dev `/ep/1?fake=1&t=580&panel=dossier:harry&record=1` (the record open - the flags do not
    exist in a production bundle): **accessibility 100**.
  - dev `…&panel=dossier:xo&record=1` (bust fallback, nine empty hotbar keys, the tile
    overflow): **accessibility 100**.
- **axe-core 4.10.2**, all rules including best-practice, injected into the live page:
  **0 violations** on the record at 1440×900, on the record at 360 px, on X.O.'s record, and in
  the SKILLS list view. The ambient and glance states report the one known dev-only violation,
  `color-contrast` on `._fakeLabel_` - the "SIMULATED BROADCAST - DEV SCRUBBER" caption, behind
  `import.meta.env.DEV` and absent from the build Lighthouse scored 100.
- **No horizontal scroll at 360 / 400 / 500 px**, in the sheet *and* in a list view:
  `document.documentElement.scrollWidth === clientWidth` (360/360, 400/400, 500/500) and the
  record body the same. The close control sits at (320, 10) 28×28 fully in view at 360 px, and
  **Back to record** is in view in the list view. The art is a banner above the identity
  (art y=67, identity y=481), the identity grid is one column at 360 and 400 px and three at
  500 px, and the hotbar is **5 × 2** at every one of the three widths with "+1" right-aligned
  beneath it.
- **Contrast** *(measured, computed over the real composited backgrounds and the opacity chain)*.
  Everything new clears 4.5:1 for text and 3:1 for graphics:

  | Element | Ratio | Bar |
  |---------|-------|-----|
  | Hotbar slot number (filled **and** empty) | 4.63:1 | 4.5 |
  | Hotbar slot name | 14.44:1 | 4.5 |
  | Hotbar "+N" marker | 7.85:1 | 4.5 |
  | Tile name / tile footer (`RANK 1`, times) | 16.74:1 / 5.36:1 | 4.5 |
  | Gear label / worn value / "-" | 4.63:1 / 14.44:1 / 4.63:1 | 4.5 |
  | Identity label / value | 4.63:1 / 14.44:1 | 4.5 |
  | "View all (N)" and "Back to record" | 7.85:1 | 4.5 |
  | Rank delta ↑ (record / glance) | 8.31:1 / 11.21:1 | 4.5 |
  | Feed row time, glance moment time, history time | 4.63:1 | 4.5 |
  | Timeline legend text (all five) | 5.10:1 | 4.5 |
  | Timeline legend swatches (story / boss / loot / achievement / level-up) | 5.10 / 4.68 / 8.46 / 5.12 / 9.16:1 | 3 |
  | Timeline playhead marker | 15.92:1 | 3 |
  | Caption row title / time | 8.66:1 / 5.10:1 | 4.5 |

- **Reduced motion** *(measured with `Emulation.setEmulatedMedia`)*: under
  `prefers-reduced-motion: reduce` the record's `recordIn` fade/lift resolves to
  `animation-name: none` and every transition on the dialog, its close control, the "View all"
  buttons, **Open full record** and the party frames collapses to ~0 s; under `no-preference`
  the same nodes report `recordIn 0.15s` and their 0.15–0.2 s transitions. The backdrop never
  animates in either mode (T337).

### Screenshots taken *(1440×900 and 360×780, headless Chrome 152)*

- **Harry's record at 1440** - art column full height on the left with the silhouette hung from
  the top; identity and vitals side by side, values whole ("Compensated Anarchist",
  "10,491,201", "he/him"); the STATS strip spanning both columns; the ten-key hotbar with "+1"
  on the end of the row; the gear sheet in two columns; SKILLS and INVENTORY tile grids.
- **X.O.'s record at 1440** - the bust fallback at the top of the art column, one lit hotbar key
  and nine dashed unlit ones, eight skill tiles with mono `RANK n` footers.
- **The SKILLS list view at 1440** - title "X.O. - SKILLS", **Back to record** above the black
  section bar, ten full-width rows with their ranks; the dialog shrinks to the list and stays
  anchored to its top offset.
- **The record at 360** - art banner, then the System-blue identity band, then the one-column
  definition grid, then vitals; close control top right; no sideways scroll.
- **The hotbar at 360** - two rows of five keys with "+1" right-aligned underneath.

### R2-SC-205 - nothing else moved

444 tests green across 21 files, including every v1/v2 suite. This wave touched
`CrawlerDossier.module.css`, `sections.tsx` (the `data-field` hook, the hotbar's `data-overflow`
and `aria-label`), `RankSparkline.tsx` (`overflow="visible"`), `FullRecordDialog`
(tsx/css - the stats cell and the bust), `CrawlerGlance` (tsx/css/test - the separator),
`CrawlerFrame.tsx` + `PartyRail.module.css` (the same separator, and `contain: paint`),
`copy.ts` (two appended keys), `EpisodePage.test.tsx`, and docs. No engine, data, script, or
page-wiring change.

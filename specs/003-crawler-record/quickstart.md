# Quickstart: Crawler Record

Same toolchain as before. Dev server: `npm run dev` (port 5180).

## Try it

- `http://localhost:5180/ep/1?fake=1&t=560&panel=dossier:harry` → Harry's glance card in the
  rail. At 9:20 into `public/data/ep1.json` it reads, top to bottom:

  | Row | Value at `t=560` |
  |-----|------------------|
  | Header | Harry · Harold the Unhoused · Marcus · Compensated Anarchist · Lv 2 |
  | HP | 18/22 — nine of ten segments filled |
  | Rank | Current **#6402**, Best **#6402**, sparkline over three points (8890 → 7215 → 6402) |
  | Debuffs | "No debuffs on record." |
  | Hotlist | 1 · Bronze Box Runner |
  | Skills | 1 · Powerful Strike · Rank 1 |
  | Inventory | 2 · Torch |
  | Achievements | 1 · Gate Crasher · 2:34 |
  | Moments | 9:10 hotlist swap · 8:40 climbs to #6402 · 7:41 stows Torch |

  Then the one control: **Open full record**.

- `…&panel=dossier:actress` at the same time → the fixture's *thinnest* crawler: Hotlist 0 with
  the System's empty phrase, "Unranked" and no sparkline, two moments and one "—" placeholder.
  The card is the same height as Harry's (SC-201).
- Click **Open full record** → the modal record in the sheet's landscape layout. Drag the
  scrubber while it is open: past 7:41 backwards, Inventory swaps Torch back for the Enchanted
  Crowbar and History follows; the dialog neither closes nor moves. <kbd>Escape</kbd> closes only
  the record and focus lands back on **Open full record**.
- `http://localhost:5180/ep/1?fake=1&t=560&panel=dossier:harry&record=1` → the same, with the
  record already open on load (DEV only — the flag is stripped from production builds).
- Resize to ≤ 900 px: the record fills the screen and stacks.

## Manual acceptance

1. SC-201: glance card height equal for Harry (most items) and The Actress (fewest) at 1440×900; no scroll.
2. SC-202: sweep `?t=` across Harry's event times (72, 105, 154, 179, 240, 260, 290, 297, 394,
   410, 461, 520, 550); ledger counts/newest match the feed.
3. SC-203: open/close by Escape, backdrop, close button; Tab stays inside; playback unaffected.
4. SC-204: Lighthouse a11y 100; 360 px with the record open: no horizontal scroll.
5. SC-205: `npm test` green.

---

## Results

Phase 3 (T313–T315), run on Node 20.9.0 against the current `003-crawler-record` tree.
*Measured* means a real Chrome 152 headless run (CDP: `Emulation.setDeviceMetricsOverride`,
`getBoundingClientRect`, `Input.dispatchKeyEvent`) or Lighthouse 11.7.1; anything that needs a
human or a second browser engine is marked **manual, not run**.

### Gates (T315)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **370 passed / 21 files**
(368 before Phase 3; +1 `CrawlerGlance` test for the sparkline row, +1 `EpisodePage` test for
the banner landmark, and one extra assertion in `FullRecordDialog`) · `npm run build` clean.

### T313 polish — two fixes from the visual review

1. **The rank sparkline has its own row.** Beside the rank numbers the rail squeezed the
   120×32 chart to ~80×21. It now sits on a full-width row under `CURRENT … BEST …`, drawn at
   its natural 120×32 (*measured*). The row is reserved even when `RankSparkline` draws nothing,
   so "Unranked" keeps the card's height. (The chart cannot fill the row's full 298 px at 32 px
   tall: its 120×32 `viewBox` with the default `preserveAspectRatio` caps it, and
   `RankSparkline.tsx` is v2 code this phase did not touch. A wider chart would need either a
   ~72 px row or `preserveAspectRatio="none"` on the SVG — author's call.)
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

### SC-201 — the glance card is one height *(measured)*

At 1440×900, `?fake=1&t=560`, `getBoundingClientRect().height` of `[data-testid="crawler-glance"]`:

| Crawler | Card height | Panel body `scrollHeight` / `clientHeight` |
|---------|-------------|--------------------------------------------|
| `dossier:harry` (1 hotlist, 1 skill, 2 items, 1 achievement, 3 moments) | **473.77 px** | 494 / 494 — no scroll |
| `dossier:actress` (0 hotlist, unranked, 2 moments + placeholder) | **473.77 px** | 494 / 494 — no scroll |

Equal to the sub-pixel. Two rows had to be pinned to get there: the sparkline row (above) and
`.historyRow`'s `min-height: calc(var(--text-xs) * 1.5)` — the "—" placeholder's smaller mono
type left the card 3 px shorter before. Both are in rem/token units, so the type scale at
wider breakpoints cannot reopen the gap.

### SC-202 — every count and newest entry matches the log *(measured)*

A 34-point sweep (17 times forward, the same 17 backward) over Harry's event boundaries
(0, 20, 72, 105, 154, 179, 240, 260, 290, 297, 394, 410, 461, 520, 550, 560, 600) read the four
ledger rows out of the live page and compared them with a model built straight from
`public/data/ep1.json` (hotlist/inventory add-remove, loot, skill upsert, achievements) with no
app code involved: **0 mismatches**, in both directions. The unit suites
(`selectors.test.ts`, `CrawlerGlance.test.tsx`) cover the same invariant at t=0 and on
backward seeks.

### SC-203 — modality *(measured, Chrome only)*

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

### SC-204 — accessibility and small screens

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
  on `._fakeLabel_` — the "SIMULATED BROADCAST — DEV SCRUBBER" caption, which is behind
  `import.meta.env.DEV` and absent from the build Lighthouse scored 100.
- Contrast of everything new *(measured, computed over the real composited backgrounds)*:
  ledger count chip `--text-2` on `--panel-deep` **9.10:1**, ledger newest `--text` on
  `--panel` 14.44:1, ledger label / empty phrase `--text-3` on `--panel` 4.63:1, **Open full
  record** `--brand-fg-2` on `--brand-2` **6.00:1**, rank values `--label-rank` 11.21:1,
  sparkline stroke and current dot `--brand-line` 3.98:1 (3:1 graphic bar), best ring
  `--marker-levelup` 8.31:1. 129 text and graphic nodes checked across the card and the record;
  the only sub-bar paint is the sparkline's decorative floor (`--hairline-2`, 1.71:1), which
  carries no data — the series is in the SVG's `aria-label` — and is v2's, unchanged.
- **360 px and 400 px with the record open** *(measured)*: `document.documentElement.scrollWidth
  === clientWidth` (360/360 and 400/400) and the same for the record's own body, so no
  horizontal scroll; the close control sits at y=10, 28×28, fully in view without scrolling; the
  sections stack in sheet order at one x — Hotlist 620.9 → Skills 691.3 → Inventory 762.3 →
  Achievements 862.7 → History 949.1. The only off-viewport node is the skip link at x=-9999.
- **Glance card at 360 px** inside the panel's full-screen overlay: 340×439.2, no horizontal
  scroll, sparkline row intact. At 500 px (the review's second width) the same overlay reads
  cleanly; the only nit is the `ACHIEVEMENTS` ledger label ellipsizing in its 6.5em column,
  which is v2 behaviour and unchanged.
- `body.panel-open` and `body.dialog-open` are both set with the record open; closing the record
  leaves `panel-open`, closing the panel leaves `class=""`. No leaked lock.

### SC-205 — nothing else moved

370 tests green across 21 files, including every v1/v2 suite. The only files this phase touched
are `CrawlerGlance` (tsx/css/test), `FullRecord` (tsx/test), `EpisodePage.test.tsx`, and docs —
no engine, data, script, or page-wiring change.

# Quickstart: Broadcast log

Run `npm run dev` (port 5180) for the dev URLs, or `npm run build && npm run preview` (port 4173)
for the production ones. Every URL below was opened and checked in Chrome 152 headless while
writing this file - the `4173` ones exactly as written, the dev ones on a second dev server at
`5199` so the author's own `5180` was left alone.

## The log

| URL | What is on the log |
|-----|--------------------|
| `http://localhost:5180/ep/1?fake=1&t=580` | **55 moments**; open it and the chips read 17 types and 5 crawlers (`skill 10`, `rank 7`, `achievement 4`, `system_message / map_reveal / chapter / hotlist / equip 3`, the rest 2, and `Harry 17 · X.O. 17 · The Stuntman 4 · The Psychic 2 · The Actress 2`) |
| `http://localhost:5180/ep/1?fake=1&t=200` | **18 moments**, 14 type chips and 4 crawler chips - `class`, `hotlist`, `unequip` and **The Actress** have nothing elapsed at 3:20, so they have no chip yet |
| `http://localhost:5180/ep/1?fake=1&t=0` | the open log is the standby line alone: *"Standing by. The System reports when the broadcast begins."* - and no filters, because there is nothing to filter |
| `http://localhost:4173/ep/1?t=580` | the same 55 moments on the production build with the real embed (the log is a pure function of the playhead, so a deep link arrives with it already filled) |

Counts verified against `public/data/ep1.json`: **57 rows in the file**, one of them a
`future_type` row the log never shows; **55 known events elapsed at 9:40** (the 9:54 note is
still ahead), **4 achievements** (2:34 Harry, 2:36 The Stuntman, 2:39 X.O., 8:58 The Actress)
and **17 of Harry's own moments**. At 3:20 it is 18 rows, **3 achievements** and **5 of
Harry's**.

## Walk it

1. `/ep/1?fake=1&t=580` → scroll below the party rail: a black bar, `BROADCAST LOG`,
   **Open the log**, `55 moments on the log`. Nothing above it moves when you open it.
2. Read from the top (oldest first). Click the `2:34` achievement row: the broadcast seeks to
   2:34 and the overlay follows. Use that row's share icon instead: the link carries `t=154` and
   nothing seeks.
3. Press **Achievement**: `4 of 55 moments`, four rows. Add **Harry**: one row (Gate Crasher).
   Press **Clear**: the whole log is back.
4. Drag the scrubber back to 3:20: rows after it vanish, the count reads 18, and the chips for
   what has not happened yet (`Class`, `Hotlist`, `Unequip`, `The Actress`) are gone. A filter
   standing on one of them goes with it rather than emptying the log.
5. Press play with the log open: the list stays pinned to the newest row. Scroll up and it lets
   go and offers **Follow the broadcast**; press it and the list returns to the end.
6. Reload: the log opens by itself (`dcc-watch-hub:prefs:v1:log-open`), the filters do not -
   they are per visit.

## Manual acceptance
1. SC-401 sweep at event boundaries (fake scrubber) - rows equal elapsed events.
2. SC-402 filters at t=200 (fixture) / t=580 (sample) give expected subsets and counts.
3. SC-403 row seek + share; opening the log leaves stage/rail rects unchanged.
4. SC-404 Lighthouse a11y 100 with the log open; 360 px no horizontal scroll.

---

## Results

Phase 3 (T507–T509), Node 20.9.0, on the `005-episode-log` tree. *Measured* means a real Chrome
152 headless run driven over CDP (puppeteer-core: `Emulation.setDeviceMetricsOverride`,
`getBoundingClientRect`, `getComputedStyle`, real clicks, scripted `scrollTop`), Lighthouse
11.7.1 desktop preset against `npm run preview`, or axe-core 4.13.0 injected into the live page.
Anything needing a human, a phone, or a second browser engine is marked **manual, not run**.

### Gates (T509)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **590 passed / 30 files** ·
`npm run build` clean (`index.js` 361.82 kB / **114.06 kB gzipped**, `index.css` 54.38 kB /
9.80 kB, `index.html` 0.72 kB / 0.42 kB - 114 kB against a 150 kB budget). Wave 1 committed 588;
wave 2 added two component tests with the hidden-chip change below.

### SC-401 - the log is the elapsed log, never a frame ahead *(measured + tested)*

`EpisodePage.test.tsx` sweeps **every event boundary** of the fixture forward and back
("never puts a future moment on the log") and asserts the row set equals
`logItems(events, t, party)` at each one; `selectors.test.ts` does the same against the selector
itself, uncapped and in file order for ties. In the browser, `/ep/1?fake=1&t=580` opens with
**55 rows** and `data-t="580"`; dragging the scrubber back to 200 leaves **18 rows** and
`data-t="200"`; dragging forward again restores 55. The file agrees: of the 57 rows in
`public/data/ep1.json`, 55 are known and elapsed at 580 (the 594 s note is still ahead, and the
`future_type` row never appears at all), and 18 at 200.

### SC-402 - filters produce exactly the expected subsets *(measured + tested)*

Chip inventory read out of the live page, against the file:

| Playhead | Type chips | Crawler chips | Rows |
|----------|------------|---------------|------|
| 0:00 / 0:12 | none (no filters at all) | none | 0 - standby line |
| 3:20 | 14 (`system_message 1, achievement 3, loot 1, hp 1, level_up 1, rank 1, map_reveal 1, sponsor 1, chapter 1, status 1, inventory 1, note 1, skill 3, equip 1`) | 4 (`stuntman 2, psychic 1, harry 5, xo 5`) | 18 |
| 9:40 | 17 (`system_message 3, achievement 4, loot 2, hp 3, level_up 2, rank 7, map_reveal 3, sponsor 2, chapter 3, status 2, inventory 2, note 2, skill 10, class 2, hotlist 3, equip 3, unequip 2`) | 5 (`stuntman 4, psychic 2, harry 17, xo 17, actress 2`) | 55 |

Pressing **Achievement** at 9:40 gives `4 of 55 moments` and four rows; adding **Harry** leaves
one (Gate Crasher). At 3:20, **The System** + **Harry** - a type no crawler owns - gives
`0 of 18 moments` and *"Nothing on the log matches."*, with the log itself intact behind it.
Counts are computed on the unfiltered elapsed log, so a chip always says what it would find.

**Zero-count chips are not drawn** (author decision taken during this phase; research R3 and
US2 now say so, replacing the original "shown but dimmed at 0"). Measured: at 9:40 every chip
has a count ≥ 2, at 3:20 the four kinds with nothing elapsed have no chip, and at 0:00 the
filter block is absent entirely. A selection whose chip retires goes with it: **Class** pressed
at 9:40 (`2 of 55 moments`), then a scrub back to 3:20, leaves the chip gone, **18 rows** (the
whole elapsed log, not an empty list) and **Clear** disabled again; scrubbing forward does not
bring the retired selection back. Covered by two new
tests in `EpisodeLog.test.tsx` (`draws no chip for a kind with nothing elapsed`, `retires a
chip, and the selection on it, when a backward seek empties it`) plus a third for the
no-filters-before-the-first-moment state.

### SC-403 - seek, share, and a log that moves nothing *(measured)*

Row click → `onSeek(rowT)`; the row's share icon → `onShare(rowT)` with no seek, the same
sibling-button arrangement as the feed (`EpisodeLog.test.tsx`, and in `EpisodePage.test.tsx`
against the real page: a log row at 0:30 shared from a playhead of 3:20 copies
`http://localhost:3000/ep/1?t=30` and leaves the source at 200).

Stage, caption row, timeline and party rail rects read immediately before the toggle click and
again after the log is open with all 55 rows:

| Width | `fake-stage` | caption row | timeline | party rail |
|-------|--------------|-------------|----------|------------|
| 1440×900 | `{16, 60, 1072×603}` → identical | `{16, 673, 1072×22}` → identical | `{16, 705, 1072×20}` → identical | `{16, 754.94, 1072×91}` → identical |
| 500×900 | `{16, 60, 468×263.25}` → identical | `{16, 331.25, 468×22}` → identical | `{16, 361.25, 468×20}` → identical | `{16, 407.75, 468×154}` → identical |
| 360×900 | `{10, 58, 340×191.25}` → identical | `{10, 257.25, 340×22}` → identical | `{10, 287.25, 340×20}` → identical | `{10, 352.25, 340×78}` → identical |

Sub-pixel identical at every width, which is what being a sibling of the grid rather than a
child of it buys (FR-405). The same four rects are unchanged again when the follow control
appears and disappears.

### SC-404 - accessibility and 360 px *(measured)*

**Lighthouse 11.7.1**, desktop preset, `npm run preview`, real embed loading, two runs per row,
the log's open state seeded through its own preference key:

| URL | Log | Accessibility | Performance | FCP | LCP | TBT | CLS |
|-----|-----|---------------|-------------|-----|-----|-----|-----|
| `/ep/1` | collapsed | **100** | **100** | 0.2 s | 0.3–0.4 s | 0 ms | 0–0.005 |
| `/ep/1` | **open** (pref) | **100** | **100** | 0.2 s | 0.3 s | 0 ms | 0 |
| `/ep/1?t=580` | collapsed | **100** | 85 / 88 | 0.2 s | 0.4–0.5 s | 0 ms | 0.24–0.29 |
| `/ep/1?t=580` | **open**, 55 rows | **100** | 88 / 88 | 0.2 s | 0.4–0.5 s | 0 ms | 0.24 |

Accessibility is 100 with the log open on both, including the deep-linked page where the open
log is carrying all 55 rows, 22 chips and the Clear button. The deep-linked page's performance
is the known 004 finding and **not the log's**: it scores the same with the log collapsed, and
the trace splits the CLS as `cumulativeLayoutShiftMainFrame: 0.013` against a total of 0.256 -
the rest is the YouTube player's own iframe painting and un-painting its poster layer as the
seek starts playback, which no CSS of ours can reserve space for.

One zero-weight (unscored) audit is worth recording rather than hiding:
**`label-content-name-mismatch`** on seek buttons - feed and log alike. The accessible name
*does* carry the category
(`"8:25 - Skill · X.O. logs Breach Charge at rank 1"`); the visible text is the same words
without the em dash separator (`"8:25" + "Skill · X.O. logs…"`), so the rule cannot find the
visible string inside the name. The honest fix is dropping the `-` from `copy.feedSeek`, an
existing-copy change this phase was not allowed to make, and it is the same 003/004 surface the
004 Results already record - the log simply shows 55 of those buttons at once. Nothing is hidden
from a screen reader.

**axe-core 4.13.0**, default ruleset (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice), over the
live page at **1440×900 and 360×900**, on: the preview build with the log open (55 rows) and
collapsed, the dev page with the log open, and the dev page with a filter that matches nothing:

- **No violation on any 005 surface** at either width - not the bar, the toggle, the chips, the
  counts, the rows, the empty states or the follow control. `aria-controls` on a collapsed
  toggle is accepted because `aria-expanded="false"` (checked explicitly in the collapsed runs).
- The only violation anywhere is `color-contrast` on `._fakeLabel_`, the **dev scrubber's own**
  label, a DEV-only surface compiled out of production builds. It is the same finding the 004
  Results record. The 004 `target-size` finding on the timeline markers no longer appears - the
  004 T410 fix holds.

**No horizontal scroll** with the log open and 22 chips wrapping: `document.scrollWidth ===
clientWidth` at 360 (360 = 360), 500 (500 = 500) and 1440 (1440 = 1440), before and after
opening. Chips wrap to **7 lines at 360 px, 4 at 500, 2 at 1440**.

### T508 - the visual and accessibility pass *(measured)*

**Chip hit sizes.** Every chip is exactly **32 px tall** at every width (`min-height: 32px`, the
spec's phone floor), narrowest **54.63 px** wide at 360/500 and 58.88 px at 1440; **Clear** is
32 px tall too. Nothing on the log is smaller than the spec's thumb target.

**Contrast**, computed from `getComputedStyle` over the real composited backgrounds:

| Element | Colour on | Ratio | Wants |
|---------|-----------|-------|-------|
| chip label, at rest | `#eeedfe` on `#1d1d28` | **14.44:1** | 4.5 |
| chip count, at rest | `#888780` on `#1d1d28` | **4.63:1** | 4.5 |
| chip label, pressed | `#eeedfe` on `#26215c` | **12.50:1** | 4.5 |
| chip count, pressed | `#cecbf6` on `#26215c` | **9.28:1** | 4.5 |
| **Clear**, disabled / enabled | `#888780` / `#b4b2a9` on `#131320` | 5.10:1 / **8.66:1** | 4.5 |
| bar count (`55 moments on the log`) | `#888780` on `#131320` | **5.10:1** | 4.5 |
| empty states (standby, no match) | `#888780` on `#131320` | **5.10:1** | 4.5 |
| **Follow the broadcast** | `#b5d4f4` on `#131320` | **11.99:1** | 4.5 |
| latest-row accent (2 px left border) | `#7871ca` on `#131320` | **4.39:1** | 3.0 |

The chip count is the thinnest margin at 4.63:1 and still clears AA; it is `--text-3`, the same
token the feed's timestamps use. Since zero-count chips are no longer drawn there is no dimmed
chip state left to measure - the rule that produced it (`.chip[data-empty]`) was deleted with
the change, and axe found no contrast fault on any chip at either width.

**The follow control.** Driven at 1440 and 360 with the dev scrubber **playing** from 9:45 so
real rows arrive:

| Step | 1440×900 | 360×900 |
|------|----------|---------|
| open, paused | 55 rows, list at `scrollTop 0`, no follow control | same, `scrollTop 0` |
| playing past the 9:54 note | 56 rows, `scrollTop 1741 + 540 = 2281 = scrollHeight` - pinned to the newest row, no control | `2064 + 450 = 2514 = scrollHeight` - pinned, no control |
| `scrollTop = 0` (the viewer reads back) | **Follow the broadcast** appears, 152.28×32 | appears, 135.44×32 |
| 1.5 s more of playback | list held at `scrollTop 0`; the control stays | same |
| activate it | control gone, list back to `scrollTop 1741` (at end) | gone, `scrollTop 2064` (at end) |

Stage, caption and rail rects are identical across the control appearing and going again at both
widths. One honest note: opening the log **while paused** leaves the list at the top of the
transcript rather than at the newest row (the auto-follow effect is gated on `playing`), and no
follow control is offered in that state because the list still counts as "following". It reads
correctly for a transcript and it is what the wave-1 tests describe, but the code comment at
`toggleOpen` ("opening lands the viewer at the newest moment") overstates what happens when
nothing is playing. Recorded, not changed: it is a behaviour change, not a CSS or aria fix.

**Screenshots** (kept out of the repo): the open log at 1440 and 360 with the filters wrapping;
the same at 3:20 with the four retired chips absent; the end of the list with the latest-row
accent; the follow control above the fold at 1440; a focused chip showing the focus ring.

**Manual, not run**: a real phone or tablet (360 and 500 px were emulated viewports, and a
coarse pointer was never in play), VoiceOver/NVDA on the count's polite live region and on the
chips' `aria-pressed` states, Firefox and Safari, `prefers-reduced-motion` on real assistive
hardware (the code path is unit-tested and the CSS is in place), and the deployed GitHub Pages
build with its `/dcc-watch-hub/` base.

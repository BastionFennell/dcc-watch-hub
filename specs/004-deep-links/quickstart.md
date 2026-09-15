# Quickstart: Deep links + share

Run `npm run dev` (port 5180) for the dev URLs, or `npm run build && npm run preview`
(port 4173) for the production ones. Every URL below was opened and checked in Chrome 152
headless while writing this file — the `4173` ones exactly as written, the dev ones on a second
dev server at `5199` so the author's own `5180` was left alone.

## Deep links

| URL | What happens |
|-----|--------------|
| `http://localhost:4173/ep/1?t=156` | the real embed seeks to **2:36** and plays on from there; the overlay is already at 2:36 when the first frame lands; no rejoin card even with a saved position |
| `http://localhost:5180/ep/1?fake=1&t=156` | the dev scrubber starts at 2:36 with the overlay synced, no network |
| `http://localhost:4173/ep/1?t=156.9` | floors to 2:36 |
| `http://localhost:4173/ep/1?t=-5`, `?t=abc`, `?t=99999` | ignored — the page opens at 0:00 and a saved position is still offered |
| `http://localhost:4173/ep/1?t=0` | opens at 0:00 **and** suppresses the rejoin card |
| from a deep-linked page, the header's **Ep 2** | `/ep/2` at 0:00 — the link is one visit of one episode |

## Share

- **Caption row** → "Share this moment" (right of the playhead, under the stage). On a desktop
  it copies `http://<host>/ep/1?t=<now>` and the System confirms: *"Moment marked. The link is
  on your clipboard."* for about two seconds.
- **Feed rows** → the share icon at the right of each row copies that row's moment
  (`8:58` → `?t=538`) and does **not** seek: the playhead stays where it was.
- **The shared URL never carries the dev flags.** Share from `/ep/1?fake=1&t=580` and the
  clipboard gets `http://<host>/ep/1?t=580` — no `fake`, no `panel`, no `record`. The link is
  built from origin + base + episode + `t`, never copied out of the address bar.
- **Phone** → with a coarse pointer or a viewport ≤ 900 px the OS share sheet opens instead,
  titled `{episode title} — {time}`. Dismissing it is silent: no notice at all.
- **Fallback notice** → when neither the share sheet nor the clipboard works (an insecure
  context, a denied permission, an unfocused document), the System notice instead reads
  *"Moment marked. Copy the link below."* and carries the link in a read-only field that is
  **focused and selected on arrival**, so one keystroke copies it, beside a **Dismiss** control.
  It does not time out — it is holding the only copy of the link the viewer has. To see it,
  open devtools and run
  `Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject()}})`
  (and `navigator.share = undefined`) before pressing share.
- The confirmation is a `role="status"` polite live region that is always in the document and
  weightless while empty, so it announces once and the stage above it never moves.

## Manual acceptance
1. SC-301 deep link lands within 1 s with correct overlay (fake + real embed).
2. SC-302 caption and feed-row share copy the exact URL; notice appears ~2 s; screen reader
   announces once.
3. SC-303 resume suppressed only on deep-linked visits.
4. SC-304 tests green; Lighthouse a11y 100.

---

## Results

Phase 3 (T409–T411), Node 20.9.0, on the `004-deep-links` tree. *Measured* means a real
Chrome 152 headless run (puppeteer-core over CDP: `Emulation.setDeviceMetricsOverride`,
`getBoundingClientRect`, real clicks, `PerformanceObserver`), Lighthouse 11.7.1 desktop preset
against `npm run preview`, or axe-core 4.13.0 injected into the live page. Anything needing a
human, a phone, or a second browser engine is marked **manual, not run**.

### Gates (T411)

`npm run typecheck` clean · `npm run lint` clean · `npm test` **526 passed / 27 files** ·
`npm run build` clean (`index.js` 355.37 kB / **111.95 kB gzipped**, `index.css` 50.06 kB /
9.18 kB, `index.html` 0.72 kB / 0.43 kB — 112 kB against a 150 kB budget).

### SC-301 — `/ep/1?t=156` lands at 2:36 *(measured, real embed)*

Preview build, real YouTube embed, caption time sampled every 250 ms from navigation:

| Sample | 125 ms | 1.9 s | 3.2 s | 5.2 s | 6.0 s |
|--------|--------|-------|-------|-------|-------|
| `stage-caption-time` | **2:36** | 2:36 | 2:38 | 2:40 | 2:40 |

The first sample the page could give — 125 ms after `domcontentloaded`, the first paint of the
caption row — already reads 2:36, so the 1 s budget is met with room to spare, and the overlay
below it is derived from the same `t` in the same render. The playhead then runs on, i.e. the
host **started playing from the seek**, as research R2 predicted. That was measured in a headless
Chrome launched with `--autoplay-policy=no-user-gesture-required`; a viewer's own browser may
instead hold the player at 2:36 paused, which the spec accepts (US1 edge case) — the overlay is
at 2:36 either way. **Manual, not run**: the same URL on the deployed GitHub Pages site, and on
a phone.

Invalid values, same harness, with a resume record seeded at 300 s so the "ignored" branch is
visible:

| URL | Caption after load | Rejoin card |
|-----|--------------------|-------------|
| `?t=156` | 2:36 | no |
| `?t=156.9` | 2:36 (floored) | no |
| (none) | 0:00 | **yes** |
| `?t=-5` | 0:00 | **yes** |
| `?t=abc` | 0:00 | **yes** |
| `?t=99999` (> 635 s duration) | 0:00 | **yes** |

Clicking the header's **Ep 2** from `/ep/1?t=156` lands on `/ep/2` at **0:00** with no `t` in
the URL (*measured*). The fake-source path (`?fake=1&t=156` → feed header 2:36, no card) is
covered by `EpisodePage.test.tsx`, and the parse table by `deepLink.test.ts` (24 cases).

### SC-302 — share copies the exact URL *(measured)*

Chrome with `navigator.share` undefined and `navigator.clipboard.writeText` stubbed, page at
`/ep/1?fake=1&t=580`:

| Action | Clipboard received | Playhead | Notice |
|--------|--------------------|----------|--------|
| caption row **Share this moment** | `http://localhost:5199/ep/1?t=580` | 9:40 → 9:40 | `copied`, *"Moment marked. The link is on your clipboard."*, back to `idle` 2.2 s later |
| feed row **8:58** share icon | `http://localhost:5199/ep/1?t=538` | 9:40 → 9:40 | same |

`8:58` is 538 s, so the row shared its own moment and not the playhead's, and the playhead did
not move — the share icon's click never reaches the seek button it sits beside (FR-303/306).
Neither URL carries `fake=1`, although the page that produced them did (FR-305).

With `writeText` stubbed to **reject**, the same click produces `status="shown"`: the notice
reads *"Moment marked. Copy the link below."*, the read-only field holds the same URL, and it is
`document.activeElement` with `selectionStart 0 / selectionEnd 32` — the whole link selected on
arrival (*measured*). It does not clear itself; **Dismiss** closes it.

**Manual, not run**: the native share sheet and its silent cancel (no headless surface for
`navigator.share`; `share.test.ts` covers the ladder and the `AbortError` → `'cancelled'` path),
and the screen-reader announcement of the live region.

### SC-303 — resume suppressed only on deep-linked visits *(measured)*

Preview build, `localStorage` seeded with `{"episodeId":1,"t":300}` before each visit:

| Visit | Rejoin card | The stored record afterwards |
|-------|-------------|------------------------------|
| `/ep/1?t=156` | **no** | overwritten to `t: 156.04` — saving carries on as normal |
| `/ep/1` | **yes** | untouched at `t: 300` until answered |

So the link wins for that visit only, and it suppresses the *offer*, not the store (FR-301).
The unit side is `resume.test.ts` (`suppressOffer`) and the page tests.

### SC-304 — no regression; Lighthouse accessibility 100 *(measured)*

Lighthouse 11.7.1, desktop preset, `npm run preview`, real embed loading. Three runs of the
deep-linked URL, all identical:

| URL | Accessibility | Performance | FCP | LCP | TBT | CLS |
|-----|---------------|-------------|-----|-----|-----|-----|
| `/ep/1` | **100** | **100** | 0.4 s | 0.5 s | 0 ms | 0 |
| `/ep/1?t=156` | **100** | 79 | 0.4 s | 0.6 s | 0 ms | 0.482 |

**The CLS on the deep-linked page is not ours.** The trace carries exactly two `LayoutShift`
events, 664 ms and 885 ms in, both `is_main_frame: false`, both a single node going
`[0,0,0,0] → [0,0,984,553] → [0,0,0,0]` inside the frame whose document is
`https://www.youtube.com/embed/…` — the player's own poster/spinner layer appearing and going
again as the seek starts playback. A `PerformanceObserver` for `layout-shift` inside *our*
document over the same load reports **CLS 0.0032** on `/ep/1?t=156` and **0** on `/ep/1`, and
the 0.0032 is one feed row arriving as an event elapses, which any watch does. Nothing in our
CSS can reserve space inside a third-party iframe, so this is recorded, not fixed.

Everything else held: **526 tests pass** (the same 526 wave 1 committed; wave 2 changed no
behaviour), typecheck and lint clean.

### T410 — the visual and accessibility pass *(measured)*

**Caption row.** The share control is the last thing in the row, flush with its right edge, and
it is centred on the same 22 px line as the time:

| Width | Row | Playhead (right edge) | Share button | Gap |
|-------|-----|----------------------|--------------|-----|
| 1440×900 | 1072×22 at x 16 | x 1060 | 22×22 at x 1066 → right edge 1088 = the row's | 6 px |
| 500×900 | 468×22 at x 16 | x 456 | 22×22 at x 462 → right edge 484 = the row's | 6 px |

**Feed rows.** The share icon is the seek button's *sibling* (`share.closest('button')` is the
share button itself — nothing nested), and the seek button keeps the row minus the icon and its
gap, exactly:

| Width | Row | Seek button | Gap | Share icon | Sum |
|-------|-----|-------------|-----|------------|-----|
| 1440×900 | 320 | 298 | 4 | 18 | **320** ✓ |
| 500×900 | 468 | 446 | 4 | 18 | **468** ✓ |

Every row's icon carries its own moment in its name (`aria-label="Share the moment at 9:40"`);
the caption row's reads `"Share this moment"`.

**States and contrast.** Both share controls sit on `--canvas` (`#131320`) — the icon is outside
the feed row's `--panel` box, not in it — and are `--text-3` (`#888780`) at rest:

| State | Colour | Contrast | Ring |
|-------|--------|----------|------|
| rest | `#888780` | **5.10:1** on `--canvas`, 4.63:1 on `--panel` | — |
| hover | `#eeedfe` | 15.92:1 | — |
| focus-visible | `#eeedfe` | 15.92:1 | 2 px `--brand-line` `#7871ca` (4.39:1 on `--canvas`) plus a `--brand-2` border |

WCAG 1.4.11 wants 3:1 for a meaningful graphic; the resting state clears it on either surface.
(The two contrast figures in `ShareButton.module.css`'s header comment were low — 4.32/4.77 —
and were corrected to the measured 4.63/5.10. That is the only source change this phase made.)

**The notice does not move the stage.** Stage and caption-row rects read before the click and
again once `share-notice` leaves `idle`:

| Width | `video-stage` before → after | caption row before → after | what did move |
|-------|------------------------------|----------------------------|---------------|
| 1440 | `{16, 60, 1072×603}` → identical | `{16, 673, 1072×22}` → identical | the timeline below, y 705 → 741.84 |
| 500 | `{16, 60, 468×263.25}` → identical | `{16, 331.25, 468×22}` → identical | the timeline below, y 361.25 → 395.19 |
| 400 | `{…, 58, 213.8 tall}` → identical | `{…, y 279.8, 22 tall}` → identical | as above |
| 360 | `{…, 58, 191.3 tall}` → identical | `{…, y 257.3, 22 tall}` → identical | as above |

The notice only ever grows downward, into the gap above the timeline: sub-pixel identical stage
and caption row at every width, which is what the always-mounted, weightless live region buys.
No horizontal scroll at 360, 400 or 500 px (`scrollWidth === clientWidth` at all three), with
the fallback notice open and its URL field in place.

**axe-core 4.13.0** over the live page (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) at
1440×900 and 500×900, on `/ep/1`, `/ep/1?t=156`, and the dev page with the confirmation notice
open and with the fallback notice open: **no violation on any 004 surface** — not the share
buttons, not the notice, not the fallback field or its Dismiss control. Three findings that are
not 004's, recorded rather than quietly patched:

1. `target-size` (WCAG 2.2 AA, serious) — the **timeline markers**, 6×11 px and overlapping
   each other, from 002. The share buttons pass this rule at 22 px and 18 px because they clear
   the spacing exception; the markers do not clear either. Fixing it means a taller hit area on
   `EventTimeline`'s markers, which is a 002 surface and an author call.
2. `label-content-name-mismatch` (WCAG 2.5.3, the zero-weight audit Lighthouse also reports) —
   every **feed seek button**, from 003: the row shows "2:36 · Achievement · The Stuntman
   earns …" while its accessible name is `2:36 — The Stuntman earns …`, so the visible word
   "Achievement" is not in the name. A deep link is simply the first thing that puts a populated
   feed on screen at first paint, which is why it shows up here and not in the 003 results. The
   honest fix is to put the category into the name — `copy.feedSeek(time, text)` would gain the
   label — and that is an API and copy change this phase was not allowed to make. Silencing it
   with `aria-hidden` on the visible category was rejected: it would hide real information from
   a screen reader to please a checker.
3. `color-contrast` on `._fakeLabel_` — the dev scrubber's own label. DEV-only chrome, compiled
   out of production builds, never reaches a viewer.

**Screenshots** (1440×900 and 500×900 unless noted), kept out of the repo:
caption row with the share control at both widths; the feed rail with a share icon on every row
(including the pinned sponsor) at both widths; a feed row with the icon hovered and with it
focused (the ring is clearly visible against the row); the confirmation notice under the caption
row at both widths; the fallback notice with its selected URL field and Dismiss at 1440, 500,
400 and 360 px; the real embed at `/ep/1?t=156`.

**Manual, not run** for this phase: any phone or tablet (the share sheet, a coarse pointer, and
the ≤ 900 px branch of `prefersShareSheet` were reasoned about and unit-tested, never held in a
hand), VoiceOver/NVDA on the live region, Firefox and Safari, and the deployed Pages build with
its `/dcc-watch-hub/` base.

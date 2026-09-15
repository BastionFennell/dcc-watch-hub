# Dungeon Crawl Cast — System Feed

> The System's broadcast feed: every recap episode plays with a live crawler status overlay —
> party vitals, event ticker, achievements and sponsors — synced to the playhead, and never a
> frame ahead of it.

A static watch-along site for the Dungeon Crawl Cast actual play show. One page per recap
episode, one archive page, no backend, no accounts, no database.

- **Stack**: Vite 6 + React 19 + TypeScript (strict) + react-router 7 + CSS Modules + Vitest 3.
- **Runtime deps**: `react`, `react-dom`, `react-router`. Nothing else ships to the browser.
- **Node**: 20.9.0 (pinned in `.tool-versions`; `asdf install` if you do not have it).

---

## Quickstart

```sh
npm install
npm run dev            # http://localhost:5180/
npm run dev -- --open  # opens the archive
```

- Archive: <http://localhost:5180/>
- Episode with the real embed: <http://localhost:5180/ep/1>
- Episode with the dev scrubber, no network: <http://localhost:5180/ep/1?fake=1>
- The v2 panels mid-episode: <http://localhost:5180/ep/1?fake=1&t=560> (click a crawler, then
  the floor-map badge)

### Verify

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # vitest run  (322 tests)
npm run build          # vite build + copies dist/index.html → dist/404.html
npm run preview        # serves dist/ at http://localhost:4173/
```

All four gates are green on `main`; CI (`.github/workflows/ci.yml`) runs the same four on every
push and pull request.

---

## How it works

The whole overlay is one pure function of the playhead:

```
state(t) = reduce(episode.initialState, episode.events.filter(e => e.t <= t))
```

`src/engine/reducer.ts` folds the event log; `src/engine/selectors.ts` derives the view models
(party frames, feed items, the active toast and sponsor, timeline markers, map cells). Both are
pure — no clocks, no DOM, no randomness — so a seek in **either** direction recomputes from
`initialState` and lands on exactly the right state. Nothing renders from an event whose `t` is
past the playhead, which is what keeps the page spoiler-free. There is no memoization and no
incremental patching: event logs are small, and drift is worse than a few extra renders.

Time reaches the components through one seam, `TimeSource` (`src/playback/TimeSource.ts`):

- `YouTubeTimeSource` wraps the IFrame Player API, polling `getCurrentTime()` at 250 ms while
  playing. It and `loadYouTubeApi.ts` are the **only** two files allowed to mention YouTube —
  ESLint's `no-restricted-globals` enforces that for `YT` and `onYouTubeIframeAPIReady`.
- `FakeTimeSource` is a deterministic stand-in used by the tests and by the dev scrubber.

Add `?fake=1` to an episode URL **in dev** and the stage is replaced by a black box with a
range input and a play/pause button driving `FakeTimeSource`. It is the fastest way to scrub
through an event log without the network, and it is compiled out of production builds
(`import.meta.env.DEV` guard), so it can never reach a viewer.
Add `&t=<seconds>` to open the scrubber mid-episode, e.g. `/ep/1?fake=1&t=157` lands on the first
achievement toast with a populated feed.

### Layout of the source

| Path | What lives there |
|------|------------------|
| `src/engine/` | reducer, selectors, time formatting — pure, framework-free |
| `src/data/` | schema types, guards/normalization, fetching, show ordering |
| `src/playback/` | `TimeSource` interface, YouTube adapter, fake, `usePlayhead`, resume store + `useResume` |
| `src/hooks/` | `usePanel` — the right rail's one-panel state machine; `useModalDialog` — the full record's focus trap |
| `src/components/` | stage, party rail, event feed, timeline, toast, minimap, header, rail panel, glance card, full record, dossier sections, floor map, resume card |
| `src/pages/` | `EpisodePage`, `HubPage`, `NotFoundPage` |
| `src/copy.ts` | **every** user-facing string, in the System's voice |
| `src/styles/tokens.css` | the colour/spacing/type tokens from spec §6 |
| `public/data/` | `show.json` + `ep{N}.json` (static, fetched at load) |
| `scripts/sheet-to-json.ts` | editor CSV → `ep{N}.json` converter |

---

## Lean-forward (v2)

The ambient view is unchanged: video, party rail, ticker. Everything below is **opt-in** — it
opens on an explicit click or keypress and closes on an explicit action, and the right rail
hosts exactly one of the feed (default), a crawler glance card, or the map. Exactly one thing
may cover the stage, and only when asked for from the glance card: the full record. Panel and
record content are still a pure function of the playhead, so scrubbing in either direction
updates them and never leaks an event whose `t` is ahead of the playhead.

### Crawler glance card

Click (or focus and press Enter/Space) a crawler frame in the party rail. The rail swaps the
feed for that crawler's glance card — how they are doing *right now*, in a couple of seconds:

1. **Header** — portrait, name, handle · player, class (or "Unclassed") · level.
2. **Vitals** — a ten-segment HP bar with current/max, current and best rank with an inline
   sparkline of every elapsed `rank` event (better rank drawn higher, a text summary for
   assistive tech) or "Unranked", and debuff chips — two rows, then "+N".
3. **Ledger** — one line per list (Hotlist, Skills, Inventory, Achievements) with its count and
   its newest entry on a single ellipsized line; achievement rows carry the time as well. An
   empty list reads 0 and the System's empty-state phrase. The rows are text, not controls.
4. **Moments** — the last three entries of that crawler's history, with "—" placeholders when
   they have fewer.
5. **Open full record** — the card's only control.

The card's height is fixed: every row is single-line and the lists never expand into it, so a
crawler with forty achievements and a ten-entry hotlist renders exactly as tall as one with
none, and it does not scroll on a laptop. Close with the panel's × control, <kbd>Escape</kbd>,
or by clicking the same frame again; focus returns to the frame. Clicking a different frame
switches cards without closing. At ≤ 900 px the panel is a full-viewport overlay and the page
behind it does not scroll.

### Full record

**Open full record** opens the whole System sheet as a modal dialog over the page — the one
overlay allowed to cover the stage. Desktop lays it out the way the official sheet does in
landscape: a top band of identity (portrait, name, handle, player, race, pronouns, crawler
number, level, class, floor), vitals and stats (STR / INT / CON / DEX / CHA, when the episode
data carries them), then three columns — **Hotlist** + **Skills** | **Inventory** +
**Achievements** | **History**, each list in full, each section under the sheet's black bar.
Sections with nothing in them yet render a one-line System empty state rather than vanishing.

- **Size**: `min(1200px, 94vw)` wide, at most 90 vh tall, scrolling inside itself over a dimmed
  backdrop. At ≤ 900 px it fills the viewport and stacks the same sections in the same order.
- **Modal**: focus moves to the close control on open and is trapped inside — <kbd>Tab</kbd> and
  <kbd>Shift</kbd>+<kbd>Tab</kbd> wrap — and the page behind it is inert and does not scroll.
- **Closing**: <kbd>Escape</kbd>, the dimmed backdrop, or the × control. Escape closes only the
  record: the glance card stays open in the rail and focus returns to **Open full record**.
- **Live**: it keeps updating with the playhead. Scrub while it is open and Inventory,
  Achievements and History follow, without the dialog closing or moving. Opening it never
  pauses playback and never touches the `TimeSource`.
- It closes with the card that opened it: switching crawlers, closing the panel, or changing
  episode all dismiss it.

### Floor map

The minimap badge is now the map's trigger (a real button, with `aria-expanded`). Click it and
the rail shows the expanded floor map: the whole grid, sectors revealed as of the playhead
tinted, sectors revealed in the last 5 s highlighted, and one label per named neighborhood at
the centroid of its cells. Nothing unrevealed at the playhead is drawn or labeled.

| Control | Buttons | Keys |
|---------|---------|------|
| Zoom in / out | **Zoom in** / **Zoom out** (×1.5 steps toward the center, disabled at the limits); scroll wheel or trackpad pinch zooms toward the pointer; double-click zooms in at the pointer | <kbd>+</kbd> / <kbd>-</kbd> |
| Reset to fit | **Fit** | <kbd>0</kbd> |
| Pan | drag the map at any zoom (it stops once half the view would be empty) | arrow keys |

Zoom and pan are viewer state, not overlay state: they reset when the panel closes.
<kbd>Escape</kbd> or the × closes it and returns focus to the badge.

### Resume where you left off

Per episode, on this device only — no accounts, no server.

- **Key**: `dcc-watch-hub:resume:v1:<episodeId>` in `localStorage`.
- **Value**: `{ "episodeId": number, "t": number, "savedAt": ISO-8601 }` — the playhead and
  nothing else. Overlay state is never stored; on rejoin it is recomputed from the playhead
  like any other seek.
- **Saved** at most once every 5 s while playing, plus immediately on pause, on `pagehide`, when
  the tab is hidden, on an episode change and on unmount.
- **Offered** on open when the saved position is at least **30 s** in and outside the **last
  30 s** — a System card over the stage with "Rejoin the broadcast" and "Start from the
  beginning". Rejoining seeks there; starting over discards the position. An unanswered offer
  expires on its own once the broadcast has run past 5 s.
- **Cleared** when playback ends, when the playhead reaches the last 30 s, and on "start over".
- **Blocked storage** (private windows, disabled site data, a full quota) is silent: no card,
  no error, playback unaffected.

Opening the dev scrubber at `?t=` starts the fake source past that 5 s grace window, so the
offer is answered by the playhead itself and no card appears. That is expected.

### Party rank

Once a party-scoped `rank` event has elapsed, the feed header carries a "Party rank #…" line.
Before that it is omitted.

---

## Authoring episode data

The editor logs events in a Google Sheet during the edit pass and exports CSV. Header row
required; columns are `timecode,type,actor,field1,field2,field3`
(full contract: `specs/001-watch-hub-v1/contracts/sheet-csv.md`).

- `timecode` — `hh:mm:ss`, `h:mm:ss`, `mm:ss`, or plain seconds. Unparseable → **ERROR**.
- `type` — one of the rows below. Unknown → **WARN**, and the row is passed through verbatim.
- `actor` — a crawler `id` from `initialState.party[].id`. Unknown or missing → **WARN**.
- `field1..field3` — per type, below. Lists use `;`; map cells use `r,c;r,c`.

| type | field1 | field2 | field3 |
|------|--------|--------|--------|
| `system_message` | text | – | – |
| `achievement` | title | desc | – |
| `loot` | item | source | – |
| `hp` | current | max | – |
| `level_up` | level | – | – |
| `rank` | scope (`party`/`crawler`) | rank | – |
| `map_reveal` | cells `r,c;r,c` | label | – |
| `sponsor` | text | durationSec | – |
| `chapter` | label | kind (`boss`/`loot`/`achievement`/`levelup`/`story`) | – |
| `status` | add (`;`) | remove (`;`) | – |
| `inventory` | add (`;`) | remove (`;`) | – |
| `skill` | name | rank (number, optional) | desc (optional) |
| `class` | class | – | – |
| `hotlist` | add (`;`) | remove (`;`) | – |
| `note` | text | – | – |

Convert:

```sh
npm run sheet-to-json -- path/to/ep4.csv \
  --episode 4 --duration 5400 \
  --initial-state scripts/samples/ep1.initial.json \
  --out public/data/ep4.json
```

`--initial-state` is a JSON file holding the episode's `initialState` (party, `partyRank`, map).
Each crawler there may carry the optional sheet fields the dossier renders — `race`, `pronouns`,
`crawlerNumber`, `stats` (`{ str, int, con, dex, cha }`), `hotlist[]` and `skills[]`
(`{ name, rank? }`). They need no new CSV columns, and v1 files without them keep working: the
dossier simply omits what it does not know.
The converter sorts events by `t`, normalizes them, and prints a summary such as
`wrote public/data/ep4.json (42 events, 2 warnings)`. **Warnings still produce output** (unknown
actor, impossible HP, timecode past `--duration`, unknown type, bad `chapter.kind`); **errors
write nothing and exit 1** (unparseable timecode, missing header column, non-numeric numeric
field, empty required field).

Try it against the samples:

```sh
npm run sheet-to-json -- scripts/samples/ep1.csv        --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/ep1.json          # clean
npm run sheet-to-json -- scripts/samples/ep1-broken.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/ep1-broken.json   # WARN lines, exit 0
npm run sheet-to-json -- scripts/samples/ep1-error.csv  --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/never.json        # ERROR, exit 1
```

After adding an episode, add its entry to `public/data/show.json` (`id`, `title`, `youtubeId`,
`floor`, `durationSec`, `dataUrl`) and list its id under the right floor. No code changes.

---

## Placeholders to replace before launch

Everything below is sample data so the site is runnable today. None of it is real.

**`public/data/show.json`**

| What | Current placeholder | Replace with |
|------|--------------------|--------------|
| `episodes[0].youtubeId` (Episode 1) | `"aqz-KE-bpKQ"` (Big Buck Bunny, Blender Foundation) | the real YouTube video id |
| `episodes[1].youtubeId` (Episode 2) | `"eRsGyueVLvQ"` (Sintel, Blender Foundation) | the real YouTube video id |
| `episodes[2].youtubeId` (Episode 3) | `"R6MlUcmOul8"` (Tears of Steel, Blender Foundation) | the real YouTube video id |
| `episodes[*].durationSec` | `635` / `888` / `734` (the open movies' real lengths) | the real runtime of each final edit, in seconds |
| `episodes[0].title` | `"Episode 1 — The World Dungeon"` | the real episode title |
| `episodes[1].title` | `"Episode 2 — The Meat District"` | the real episode title |
| `episodes[2].title` | `"Episode 3 — Descent"` | the real episode title |
| `links.discord` | `"https://discord.gg/REPLACE_ME"` | the real invite |
| `links.youtube` | `"https://www.youtube.com/@DungeonCrawlCast"` | confirm this is the real channel URL |

The three sample videos are the Blender Foundation's open movies: public, embeddable, and each a
different video so switching episodes is visibly a fresh broadcast. Each `durationSec` is that
video's real length and the sample events are spread across it. Change ids and durations together.

**Crawler portraits** — all five are generated monochrome SVG busts, not art:

- `public/img/crawlers/stuntman.svg` (The Stuntman)
- `public/img/crawlers/psychic.svg` (The Psychic)
- `public/img/crawlers/harry.svg` (Harry)
- `public/img/crawlers/xo.svg` (X.O.)
- `public/img/crawlers/actress.svg` (The Actress)

Keep the filenames, or update each crawler's `portrait` path in every `ep{N}.json`. The rail
renders them at 40 px (32 px on a phone), so square art crops best.

**Also placeholder**: `public/img/dcc-mark.svg` and `public/favicon.svg` (the circular "DC" mark),
and the event logs in `public/data/ep1.json`, `ep2.json`, `ep3.json` — 43 invented events each,
written to exercise every event type. Regenerate them from real sheets with `sheet-to-json`.

---

## Deploy

### GitHub Pages (the default)

One-time: repo **Settings → Pages → Source: "GitHub Actions"**.

Then every push to `main` runs `.github/workflows/deploy.yml`, which builds with
`VITE_BASE=/dcc-watch-hub/`, uploads `dist/`, and deploys it. Site:
<https://bastionfennell.github.io/dcc-watch-hub/>

### Netlify / Cloudflare Pages

Build command `npm run build`, publish directory `dist`, and **no** `VITE_BASE` (the base
defaults to `/`). `public/_redirects` (`/* /index.html 200`) handles deep links; `dist/404.html`
(written by `scripts/postbuild.mjs`) does the same job on Pages.

Any static host works — the build is HTML, one JS bundle, one CSS file, JSON and SVG.

---

## Performance

Measured on the production build (`npm run build`, Node 20.9.0):

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `dist/assets/index-*.js` | 325.7 kB | **103.3 kB** |
| `dist/assets/index-*.css` | 30.7 kB | 6.4 kB |
| `dist/index.html` | 0.7 kB | 0.4 kB |

That is React 19 + react-router 7 + the whole app — v1 plus the v2 panels, dossier, floor map
and resume — comfortably under the 150 kB gzipped budget.

Lighthouse 11.7.1, desktop preset, against `npm run preview` with the real YouTube embed loading:
**performance 100, accessibility 100** on both `/ep/1` and `/` (FCP 0.4 s, LCP 0.5 s, TBT 0 ms,
CLS 0), with no accessibility audit below 1 — including the zero-weight informational ones.
Details in `specs/002-watch-hub-v2/quickstart.md` → Results.

The budget holds because of three rules: no webfonts (`system-ui` stack only, nothing blocks
first render), no render-blocking scripts (the bundle is a `type="module"` script, deferred by
default), and the YouTube IFrame API is injected at runtime by `YouTubeTimeSource` — so the
archive page requests zero third-party bytes.

---

## Specs and rules

Read in this order:

1. `.specify/memory/constitution.md` — the six non-negotiable principles. Time-truth, the
   host-agnostic playback seam, ambient/diegetic UI, static dependency-light delivery, scope
   discipline, and the author-friendly data pipeline.
2. `dcc-watch-hub-spec.md` — the author's handoff spec: concept, schemas, components, the visual
   language (§6) and the v1 acceptance checklist (§7).
3. `specs/001-watch-hub-v1/` — `spec.md` (requirements and success criteria), `plan.md`,
   `research.md` (the decisions and what was rejected), `data-model.md`, `contracts/`,
   `quickstart.md` (run + manual acceptance walkthrough + results), `tasks.md`.
4. `specs/002-watch-hub-v2/` — dossiers, the expanded map, resume and rank sparklines. Same
   layout, plus `contracts/panels.md` and `contracts/resume-storage.md`.
5. `specs/003-crawler-record/` — the active feature: the rail's glance card and the modal full
   record. Same layout, plus `contracts/dialog.md`.

Three rules bite most often while editing:

- **Every user-facing string lives in `src/copy.ts`**, in the System's voice. "Dashboard",
  "Home", "Ads" and friends are defects — the archive is a *broadcast archive*, ads are
  *sponsors*, episodes are *recap episodes*.
- **Nothing may reference the YouTube API outside `src/playback/YouTubeTimeSource.ts` and
  `src/playback/loadYouTubeApi.ts`.** Lint fails the build if it does.
- **No new runtime dependencies, no webfonts, no audio.**

---

## Scope fence — v1 + v2 is exactly what is here

Parked, from the handoff spec §8 and constitution 1.1.0. Do not build, stub, or partially wire
these — not even "for later". In particular, do not *tease* them: no hover affordances, pointer
cursors, or tooltips on elements that do nothing. The only interactive triggers are the ones v2
ships: crawler frames (dossier), the minimap badge (floor map), the timeline, and the resume
card's two buttons.

**Shipped in v2** (the four items below left the fence; see "Lean-forward (v2)" above)

- Click-open character sheets (inventory / skills / hot list history)
- Interactive minimap with pan and labels
- `localStorage` resume
- Per-crawler fame/rank sparklines

**Still parked**

- Stinger sounds (opt-in) — needs real audio
- Roster page with commissioned art — needs real art

**v3**

- Self-hosted or alternate video sources (new `TimeSource` implementations)
- Live premiere sync
- Sponsor slot management
- Accounts

v1 and v2 also explicitly exclude comments and any server-side anything. The `TimeSource` seam exists
so v3 costs one new adapter and a factory change — that is the only forward accommodation the
codebase makes.

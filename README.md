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
- A shared moment (the real embed, seeks to 2:36): <http://localhost:5180/ep/1?t=156>
- Episode with the dev scrubber, no network: <http://localhost:5180/ep/1?fake=1>
- The panels mid-episode: <http://localhost:5180/ep/1?fake=1&t=580> (click a crawler, then
  the floor-map badge)
- The broadcast log mid-episode: <http://localhost:5180/ep/1?fake=1&t=580> → scroll below the
  party rail and open it (55 moments, 17 type chips and 5 crawler chips)
- Straight to a full record: <http://localhost:5180/ep/1?fake=1&t=580&panel=dossier:harry&record=1>
  (Harry's hotbar overflows at 9:32) and `…&panel=dossier:xo&record=1` (X.O.'s skills fill the
  eight-tile grid and offer "View all (10)"). The `panel` / `record` flags are DEV-only.

### Verify

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # vitest run  (526 tests)
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
`?t=<seconds>` is no longer a dev-only convenience: since 004 it is a real deep link that works in
production on its own, and it is what the share controls hand out (see **Share a moment** below).
The dev scrubber still honours it, so `/ep/1?fake=1&t=157` lands on the first achievement toast
with a populated feed and no network.

### Layout of the source

| Path | What lives there |
|------|------------------|
| `src/engine/` | reducer, selectors, time formatting — pure, framework-free |
| `src/data/` | schema types, guards/normalization, fetching, show ordering |
| `src/playback/` | `TimeSource` interface, YouTube adapter, fake, `usePlayhead`, resume store + `useResume`, `?t=` deep links (`deepLink`, `useDeepLink`) |
| `src/share/` | the moment URL, the share-sheet → clipboard → shown ladder, `useShare` |
| `src/hooks/` | `usePanel` — the right rail's one-panel state machine; `useModalDialog` — the full record's focus trap; `useThrottledValue` — the log count's once-a-second cadence |
| `src/prefs/` | viewer preferences that are not playback: `logOpen` (the broadcast log's open state) |
| `src/components/` | stage, party rail, event feed, timeline, toast, minimap, header, rail panel, glance card, full record, dossier sections, floor map, resume card, share button + notice, broadcast log |
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

1. **Header** — portrait, name, handle · played by {player}, class (or "Unclassed") · level. The
   "·" is decorative and hidden; a comma beside it is what a screen reader hears.
2. **Vitals** — an `HP` label, the sheet's ten-segment strip and current/max.
3. **Rank** — a `RANK` label, the current rank, a ↑/↓ delta against the previous elapsed `rank`
   event (↑ means the number fell, which is a climb), then `BEST`; a full-width sparkline of
   every elapsed rank point sits on its own row under them, with a text summary for assistive
   tech. An unranked crawler keeps the label and reads "Unranked".
4. **Debuffs** — chips, two rows, then "+N".
5. **Equipped** — one line per worn slot, `Slot · Item`, in the sheet's order (head, torso,
   arms, hands, legs, feet, then each accessory). "Nothing equipped." when the crawler is bare.
6. **Latest achievement** — the newest award only: title, time, and its description.
7. **Recent moments** — up to three entries of that crawler's history, each with its time.

Then **Open full record**, the card's only control.

Revision 2 removed the four ledger rows (count + newest per list) and the "—" placeholder rows
under Moments: a crawler's skill and inventory lists grow without limit, and the author only
ever wanted what they are *wearing* and the *last* thing they were awarded. The card's height is
still fixed — every row is single-line, Equipped is bounded by the sheet's seven slots, and the
sparkline row and the three-moment block reserve their height in CSS — so a crawler with forty
achievements renders exactly as tall as one with none and the card does not scroll on a laptop.

Close with the panel's × control, <kbd>Escape</kbd>, or by clicking the same frame again; focus
returns to the frame. Clicking a different frame switches cards without closing. At ≤ 900 px the
panel is a full-viewport overlay and the page behind it does not scroll.

### Full record

**Open full record** opens the whole System sheet as a modal dialog over the page — the one
overlay allowed to cover the stage. Revision 2 lays it out as a character sheet in an MMO:

- **Art column** — the crawler's full-figure art (`art` in the episode data) down the left at
  the sheet's height, contained rather than cropped, hung from the top so a tall figure uses the
  height and a wide stance the width. A crawler with no `art` gets their bust in the same
  column instead. At ≤ 900 px the art becomes a banner above the identity.
- **Top band** — identity (portrait, name, handle, played by, race, pronouns, crawler number,
  level, class, floor) and vitals side by side, with the **STATS** strip (STR / INT / CON / DEX
  / CHA, when the data carries them) full width beneath them.
- **Hotbar** — the Hotlist as ten numbered square keys filled in order, empty keys dashed and
  unlit, and a `+N` marker after key ten when the crawler is tracking more than ten. Each key
  names itself for assistive tech ("Slot 3, The Rot Market" / "Slot 4, empty"). On a phone the
  bar wraps to two rows of five with the marker right-aligned beneath.
- **Gear** — every slot on the official sheet (Head, Torso, Arms, Hands, Legs, Feet,
  Accessories) with what is worn in it or "—". Accessories share one row.
- **Tile grids** — Skills, Inventory and Achievements as bag-style tiles (name, then rank or
  time in a mono footer), at most **eight**, with a **View all (N)** control when there are
  more. History shows its latest eight rows the same way.
- **List views** — **View all** replaces the dialog body with that category in full, under a
  **Back to record** control, and the dialog's title becomes `{name} — {CATEGORY}`. Focus moves
  to the list's heading on entry and back to the **View all** button on return. The list view is
  dialog-internal state: it resets to the sheet whenever the record closes.

Sections with nothing in them yet render a one-line System empty state rather than vanishing.

- **Size**: `min(1200px, 94vw)` wide, at most 90 vh tall, anchored to a fixed top offset so a
  seek that shortens it cannot re-centre it, scrolling inside itself over a backdrop that is
  opaque from the first painted frame. At ≤ 900 px it fills the viewport and stacks.
- **Modal**: focus moves to the close control on open and is trapped inside — <kbd>Tab</kbd> and
  <kbd>Shift</kbd>+<kbd>Tab</kbd> wrap — and the page behind it is inert and does not scroll.
- **Keys**: <kbd>Escape</kbd> steps back before it closes — in a list view it returns to the
  sheet, and only a second press closes the record. Closing leaves the glance card open in the
  rail and returns focus to **Open full record**. The dimmed backdrop and the × control close it
  outright.
- **Live**: it keeps updating with the playhead, in the sheet *and* in a list view. Scrub while
  it is open and gear, tiles, hotbar and history follow, without the dialog closing or moving.
  Opening it never pauses playback and never touches the `TimeSource`.
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

### Under the stage

Between the player and the timeline sits a slim caption row: `Ep 1 · Floor 1 — <title>` on the
left (the page's one `<h1>`, so the episode title is finally visible) and the playhead on the
right. It used to sit *inside* the stage, where the host's own control bar covered it; that is a
deliberate deviation from v1 §5, recorded in `specs/003-crawler-record/spec.md`.

The timeline below it carries a colour legend, a playhead tick distinct from the elapsed fill,
and its own tooltip per marker — instant, touch-friendly, and still spoiler-safe: a marker the
playhead has not reached names only its kind and time.

Every feed row is a seek control: it shows the moment it happened and clicking it moves the
broadcast there (the pinned sponsor too). Before the first event has elapsed the feed reads
"Standing by. The System reports when the broadcast begins."

The party rail wraps to 3 + 2 between 900 and 1100 px, where five frames next to the feed
column started truncating names, and becomes a horizontal snap strip at 480 px and below. Every
frame reserves its debuff-pip row whether or not it has one, so a seek never changes the rail's
height.

### Rank

DCC has **individual rank only** — there is no party rank. A `rank` event names one crawler and
their new standing; the glance card and the record show the current value, the best reached so
far, and a sparkline of every elapsed point. A crawler nobody has ranked yet reads "Unranked".

Legacy data is read, not rejected: a pre-revision-2 row with `scope: "crawler"` loads with the
field dropped, a row with `scope: "party"` is ignored like any unknown event, and an
`initialState.partyRank` is dropped with a console warning.

---

## Share a moment

A link can name a second of an episode, and the page can hand one out. Both halves are 004
(`specs/004-deep-links/`).

### The link

```
https://<host><base>ep/<id>?t=<seconds>
```

`t` is whole seconds into the final edit — `…/ep/1?t=156` is 2:36. That is the only parameter
the feature owns, and it is the only thing a shared link ever carries: the dev flags (`fake`,
`panel`, `record`) are never emitted, because the URL is built from parts (origin, base, episode
id, `t`) rather than copied out of the address bar. On GitHub Pages the base is
`/dcc-watch-hub/`, so the same share reads `https://bastionfennell.github.io/dcc-watch-hub/ep/1?t=156`.

**On load**, `useDeepLink` parses `t` once per visit — one visit being one `(episode, ?search)`
pair, so a re-render is not a new one — and seeks the `TimeSource` to it exactly once, as soon as
a source exists. The YouTube adapter queues a seek issued before the player is ready (time-source
contract §6), so the link works even if it is followed cold. The overlay is not special-cased at
all: it recomputes from `initialState` at the new time like it does after any other seek, so the
party rail, feed, map and timeline are already at 2:36 when the frame lands. Seeking a cued
YouTube player also starts it, so a shared clip plays; if the host refuses autoplay the player
sits at `t` paused, and the overlay is correct either way.

**Invalid values are ignored, never an error**: negative, non-numeric, empty, or past the
episode's `durationSec` all behave as if no `t` were given. Decimals floor, so `?t=156.9` is the
second the viewer was watching, 2:36. `?t=0` is valid.

**Resume steps aside for that visit.** A deep link is a more specific request than a saved
position, so no "Rejoin the broadcast" card is offered when one is in play (the record itself is
left untouched, and saving resumes as normal the moment the viewer keeps watching). An ordinary
visit still gets the card. Opening another episode from the header starts it at 0:00 — the link
applies to one visit of one episode.

### The controls

- **Caption row** — "Share this moment" sits at the right of the slim row under the stage,
  beside the playhead it is about. It shares the current whole second.
- **Feed rows** — every row (and the pinned sponsor) carries its own share icon for the moment
  that row names, as the seek button's *sibling*, never nested inside it: sharing a row does not
  seek to it. The label says which moment, e.g. "Share the moment at 2:34".
- Sharing never pauses, seeks, or otherwise touches playback. It reads the playhead.
- Timeline markers deliberately have no share control of their own — click one to seek, then
  share from the caption row. It keeps the strip uncluttered.

### Where the link goes

One ladder, in `src/share/share.ts`, and the last rung cannot fail:

| Rung | When | What the viewer gets |
|------|------|----------------------|
| `navigator.share` | the browser has it **and** the device wants it — a coarse pointer or a viewport ≤ 900 px, i.e. phones and tablets | the OS share sheet, with the link and `{episode title} — {time}` as its title. Dismissing it is **silent**: no notice at all |
| `navigator.clipboard.writeText` | a mouse and a wide window, or the share sheet was unavailable | the link on the clipboard, confirmed by "Moment marked. The link is on your clipboard." |
| shown | neither worked — an insecure context, a denied permission, an unfocused document | "Moment marked. Copy the link below." with the link in a read-only field, selected on arrival so one keystroke copies it, and a **Dismiss** control |

The confirmation is a System notice directly under the caption row, inside a `role="status"`
polite live region that is **always mounted and weightless** — so it announces once, and the
stage above it never moves when it appears. A copy or a native share clears itself after two
seconds; the fallback stands until it is dismissed, because it is holding the only copy of the
link the viewer has.

---

## Broadcast log

The feed is a rolling eight-item ticker: by 9:00 the cold open has scrolled away. The log is the
whole reel. It is 005 (`specs/005-episode-log/`).

**Where it sits.** A full-width section *below* the party rail on desktop — the dead space under
the frames — and last in the stacked phone layout, after the feed. It is a sibling of the
two-column grid, never inside it, so opening it grows the page downward and the stage, caption
row, timeline and rail do not move by a pixel (measured at 1440, 500 and 360 px; see the 005
Results).

**Collapsed by default**, like everything ambient here: a slim black bar reading
`BROADCAST LOG · Open the log · 55 moments on the log`. The count is a polite live region
throttled to one change a second, so a screen reader is not read a queue of numbers while the
broadcast runs. Open and closed is a **viewer preference**, remembered on this device:

- **Key**: `dcc-watch-hub:prefs:v1:log-open` in `localStorage`, value `"1"` or absent. Nothing
  else — no rows, no filters, no playhead. Blocked storage is silent: the log opens closed.

**The rows** are every known elapsed event, **oldest first** — the feed reads newest-first
because it is a ticker; the log reads top-down because it is a transcript. Each row is the feed's
own row: time, category, text, System boxes and purple sponsor slots included. Clicking a row
seeks the broadcast to that moment; each row's share icon copies that moment's link without
seeking, exactly as in the feed. The newest row carries a thin left accent. The list scrolls
inside a bounded area (60 vh desktop, 50 vh phone); nothing is virtualized at this scale.

Nothing on the log is ahead of the playhead: the rows are `logItems(events, t, party)`, recomputed
every render, so scrubbing back removes rows and the count follows.

**Filters** sit above the list in two groups, **Types** and **Crawlers**, each chip a toggle
button with its elapsed count. A chip exists only while something of its kind has elapsed — the
chips are a reading of the log so far, not a catalogue of what an episode might contain, so they
arrive as the broadcast produces them (17 types and 5 crawlers by 9:40 of Ep 1; 14 and 4 at 3:20).
A backward seek that empties a chip takes the chip away *and* the selection standing on it, so a
filter can never leave the log blank for a reason the viewer cannot see. Selections combine as
**any selected type AND any selected crawler**; a crawler filter drops rows that belong to nobody
(System, sponsor, chapter, map, note). The bar then reads "N of M moments", and **Clear** resets.
Filters are per visit — they are not remembered across reloads.

**Following the broadcast.** While the episode plays, the list stays pinned to the newest row.
Scroll up to read something and it lets go and offers **Follow the broadcast**; activating it
returns to the end and re-arms. `prefers-reduced-motion` turns the scroll from smooth to instant.

**Two quiet states**: before the first event the open log reads "Standing by. The System reports
when the broadcast begins." (and shows no filters at all, because there is nothing to filter);
a filter that matches nothing reads "Nothing on the log matches." while the log itself stays
whole.

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
| `rank` | rank | – | – |
| `map_reveal` | cells `r,c;r,c` | label | – |
| `sponsor` | text | durationSec | – |
| `chapter` | label | kind (`boss`/`loot`/`achievement`/`levelup`/`story`) | – |
| `status` | add (`;`) | remove (`;`) | – |
| `inventory` | add (`;`) | remove (`;`) | – |
| `skill` | name | rank (number, optional) | desc (optional) |
| `class` | class | – | – |
| `hotlist` | add (`;`) | remove (`;`) | – |
| `equip` | slot (`head`/`torso`/`arms`/`hands`/`legs`/`feet`/`accessory`) | item | – |
| `unequip` | slot (as above) | item (accessory only; optional) | – |
| `note` | text | – | – |

Convert:

```sh
npm run sheet-to-json -- path/to/ep4.csv \
  --episode 4 --duration 5400 \
  --initial-state scripts/samples/ep1.initial.json \
  --out public/data/ep4.json
```

`--initial-state` is a JSON file holding the episode's `initialState` (`party` and `map`).
Each crawler there may carry the optional sheet fields the dossier renders — `race`, `pronouns`,
`crawlerNumber`, `stats` (`{ str, int, con, dex, cha }`), `hotlist[]`, `skills[]`
(`{ name, rank? }`), `gear` (`{ head?, torso?, arms?, hands?, legs?, feet?, accessories[]? }`)
and `art` (a full-figure image path; the record falls back to the bust without it). They need no new CSV columns, and v1 files without them keep working: the
dossier simply omits what it does not know.
The converter sorts events by `t`, normalizes them, and prints a summary such as
`wrote public/data/ep4.json (42 events, 2 warnings)`. **Warnings still produce output** (unknown
actor, impossible HP, timecode past `--duration`, unknown type, bad `chapter.kind`, an
accessory `unequip` with no item — the last one worn comes off, a legacy `rank` row with
`crawler` in field1 — the rank is read out of field2); **errors write nothing and
exit 1** (unparseable timecode, missing header column, non-numeric numeric field, empty required
field, an `equip`/`unequip` slot that is not one of the seven, a `rank` row with `party` in
field1 — DCC has no party rank).

### Carrying the map across episodes

Each episode file is self-contained: the overlay never reads another episode's log. So when two
episodes share a floor, **the later one's `initialState.map.revealed` must already list every
cell the earlier ones revealed on that floor** — that is what `initialState` is for. `ep2.json`
seeds the eight cells `ep1.json` ends with; a viewer who starts at ep2 sees the floor as the
party left it, and a viewer who skipped ahead learns nothing they should not.

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

**Crawler full-figure art** — the record's art column; also generated monochrome silhouettes:

- `public/img/crawlers/stuntman-art.svg` (The Stuntman — 320×540, the wide-stance case)
- `public/img/crawlers/psychic-art.svg` (The Psychic — 200×540)
- `public/img/crawlers/harry-art.svg` (Harry — 200×540)
- `public/img/crawlers/xo-art.svg` (X.O. — 200×540)
- `public/img/crawlers/actress-art.svg` (The Actress — 200×540)

A crawler's `art` field names one of these; the sample data gives art to two crawlers per
episode so the bust fallback stays visible. Real art may be any aspect ratio — the column
contains it rather than cropping it.

**Also placeholder**: `public/img/dcc-mark.svg` and `public/favicon.svg` (the circular "DC" mark),
and the event logs in `public/data/ep1.json`, `ep2.json`, `ep3.json` — 57 / 47 / 47 invented
events, written to exercise every event type. Regenerate them from real sheets with `sheet-to-json`.

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
| `dist/assets/index-*.js` | 361.8 kB | **114.1 kB** |
| `dist/assets/index-*.css` | 54.4 kB | 9.8 kB |
| `dist/index.html` | 0.7 kB | 0.4 kB |

That is React 19 + react-router 7 + the whole app — v1 plus the v2 panels, dossier, floor map
and resume, plus the glance card, full record, deep links, share and the broadcast log —
comfortably under the 150 kB gzipped budget. Deep links and share cost ~1.9 kB gzipped of JS;
the broadcast log cost 2.1 kB gzipped of JS and 0.6 kB of CSS, and adds no dependency.

Lighthouse 11.7.1, desktop preset, against `npm run preview` with the real YouTube embed loading:
**performance 100, accessibility 100** on `/ep/1` and `/` (FCP 0.4 s, LCP 0.5 s, TBT 0 ms,
CLS 0). Details in `specs/002-watch-hub-v2/quickstart.md` → Results, re-measured for the crawler
record in `specs/003-crawler-record/quickstart.md` → Results, again for deep links in
`specs/004-deep-links/quickstart.md` → Results, and again with the broadcast log open in
`specs/005-episode-log/quickstart.md` → Results (**100 / 100** either side of the log's toggle,
and the log adds no scored audit of its own).

A deep-linked page is the one exception worth knowing about. `/ep/1?t=156` audits
**accessibility 100, performance 79**: the seek starts the embed, and the YouTube player's own
iframe paints and un-paints a 984×553 layer while it does, which Chrome bills to us as
CLS 0.482. It is entirely sub-frame — our own document measures CLS 0 there (`is_main_frame:
false` in the trace; see the 004 Results) — and there is no CSS on our side that can reserve
space inside someone else's iframe. Two zero-weight accessibility audits are also worth
recording rather than hiding: `label-content-name-mismatch` on the feed's seek buttons
(a 003 surface a deep link is simply the first thing to show at first paint — the visible
category word, "Achievement", is not part of the row's accessible name), and axe's WCAG 2.2
`target-size` on the 6×11 px timeline markers (a 002 surface). Neither is scored by Lighthouse;
both are listed in `specs/004-deep-links/quickstart.md` → Results with the fix each would need.

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
5. `specs/003-crawler-record/` — the rail's glance card and the modal full record. Same layout,
   plus `contracts/dialog.md`.
6. `specs/004-deep-links/` — `?t=` deep links and "Share this moment". Same layout, plus
   `contracts/deep-link.md`.
7. `specs/005-episode-log/` — the active feature: the broadcast log under the rail, its filters,
   follow control and open-state preference. Same layout, plus `contracts/log.md`.

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
cursors, or tooltips on elements that do nothing. The interactive triggers are exactly: crawler
frames (dossier), the minimap badge (floor map), the timeline, the resume card's two buttons,
every feed row (seek, 003), the share controls in the caption row and on each feed row (004), and
the broadcast log's own bar, filter chips, Clear, rows and follow control (005).

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

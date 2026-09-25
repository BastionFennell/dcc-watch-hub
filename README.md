# Dungeon Crawl Cast - System Feed

> The System's broadcast feed: every recap episode plays with a live crawler status overlay -
> party vitals, event ticker, achievements and sponsors - synced to the playhead, and never a
> frame ahead of it.

A static watch-along site for the Dungeon Crawl Cast actual play show. A prerendered marketing
front door (home, archive, roster, crawler pages, links), one page per recap episode, one Dungeon
Codex of everyone the party has met, no backend, no accounts, no database.

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

- The front door: <http://localhost:5180/> (see **The front door** below)
- Archive: <http://localhost:5180/watch>
- Roster: <http://localhost:5180/crawlers>, one crawler: <http://localhost:5180/crawlers/mimi>
- Links page: <http://localhost:5180/community>
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
- The phone layout: the same <http://localhost:5180/ep/1?fake=1&t=580> in Chrome DevTools device
  mode at 400 × 800 - tabs under the timeline, scroll down for the mini-player, tap a crawler on
  the Party tab for the bottom sheet (see **On a phone** below).
- Entities mid-episode: <http://localhost:5180/ep/1?fake=1&t=560> - the **Encountered** strip
  under the party rail has three entities, the first struck through and tagged `DEFEATED`.
- Straight to an entity record: <http://localhost:5180/ep/1?fake=1&t=560&panel=npc:the-hoarder>
  (one fact released so far; `panel=npc:<id>` is DEV-only, like `panel=dossier:<id>`).
- The Registry beside the broadcast:
  <http://localhost:5180/ep/1?fake=1&t=560&panel=registry> - the rail panel, scoped to this
  episode; <http://localhost:5180/ep/1?fake=1&t=560&panel=registry:the-hoarder> opens it on one
  entity (`panel=registry` and `panel=registry:<id>` are DEV-only, like `panel=npc:<id>`).
- The Registry panel following the playhead: <http://localhost:5180/ep/1?fake=1&t=129&panel=registry>
  holds nobody, <http://localhost:5180/ep/1?fake=1&t=130&panel=registry> holds The Hoarder alone,
  and <http://localhost:5180/ep/1?fake=1&t=540&panel=registry:the-hoarder> has its fact and its
  "Defeated in episode 1." Drag the scrubber back and the panel gives them up again.
- The Dungeon Codex page: <http://localhost:5180/registry>, deep into one entry:
  <http://localhost:5180/registry#the-hoarder>, and scoped to an episode:
  <http://localhost:5180/registry?scope=ep-2> (see **Entities and the Codex** below).

### Verify

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # vitest run  (1556 tests)
npm run build          # client build + SSR build + scripts/postbuild.mjs (see "Build pipeline")
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
pure - no clocks, no DOM, no randomness - so a seek in **either** direction recomputes from
`initialState` and lands on exactly the right state. Nothing renders from an event whose `t` is
past the playhead, which is what keeps the page spoiler-free. There is no memoization and no
incremental patching: event logs are small, and drift is worse than a few extra renders.

Time reaches the components through one seam, `TimeSource` (`src/playback/TimeSource.ts`):

- `YouTubeTimeSource` wraps the IFrame Player API, polling `getCurrentTime()` at 250 ms while
  playing. It and `loadYouTubeApi.ts` are the **only** two files allowed to mention YouTube -
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
| `src/engine/` | reducer, selectors, time formatting, the cross-episode registry index - pure, framework-free |
| `src/data/` | schema types, guards/normalization, fetching, show ordering |
| `src/playback/` | `TimeSource` interface, YouTube adapter, fake, `usePlayhead`, resume store + `useResume`, `?t=` deep links (`deepLink`, `useDeepLink`) |
| `src/share/` | the moment URL, the share-sheet → clipboard → shown ladder, `useShare` |
| `src/hooks/` | `usePanel` - the right rail's one-panel state machine; `useModalDialog` - the full record's focus trap; `useThrottledValue` - the log count's once-a-second cadence; `useIsPhone` + `useMiniPlayer` - the ≤ 900 px layout and the docked stage |
| `src/prefs/` | viewer preferences that are not playback: `logOpen` (the broadcast log's open state) |
| `src/components/` | stage, party rail, event feed, timeline, toast, minimap, header, rail panel, glance card, full record, dossier sections, floor map, resume card, share button + notice, broadcast log, phone tab strip, Encountered strip, entity record, registry entry |
| `src/pages/` | `EpisodePage`, `RegistryPage`, `NotFoundPage` (the hub's own routes) |
| `src/site/` | the front door (011): the five marketing pages, `RosterCard` / `GatedCta` / `SystemBox` / `EpisodeRow` / `EntryAchievement`, `gate.ts` (the `hubLiveAt` rule), `seo.tsx`, `jsonLd.ts`, `analytics.ts`, `meta.ts`, and the `/_og/**` frames - every page a lazy chunk |
| `src/entry-server.tsx` | the prerenderer's half of the app; built separately and deleted from `dist/` at the end of the build |
| `src/copy.ts` | **every** user-facing string, in the System's voice |
| `src/styles/tokens.css` | the colour/spacing/type tokens from spec §6, plus the four the front door added in 011 revision 2: `--site-measure` (992 px, the one width the marketing shell and the footer share), `--text-display` (the crawler name: 28 px, 34 px from 721 px up), and `--ink-muted` / `--ink-body` (the cooler greys the marketing type is set in, both AA on `--canvas`) |
| `public/data/` | `show.json` + `ep{N}.json` + `npcs.json` + `spells.json` (static, fetched at load) |
| `scripts/sheet-to-json.ts` | editor CSV → `ep{N}.json` converter |

---

## The front door

`/` is no longer the episode list. Since feature 011 the site opens with a marketing front door -
five static, prerendered routes whose job is to convert a stranger in ten seconds - and the hub
(`/ep/:id`, `/codex`, `/studio/**`) is what they lead into. Same header, same tokens, same
`show.json`: a visitor should not be able to tell where "site" ends and "viewer" begins
(constitution VIII).

| Route | What it shows |
|---|---|
| `/` | Hero (tagline, pitch, the gated CTA pair, a click-to-play trailer), the five roster cards, a "New to Dungeon Crawler Carl?" System box, the Discord strip with the cadence, the footer |
| `/watch` | Every episode grouped by floor, oldest first (floors ascending, episodes ascending inside a floor - 011 revision 3), each row with its still, runtime, spoiler-safe summary and gated CTA. A "Jump to latest" button under the heading scrolls to the newest row (`id="ep-{id}"`, marked `LATEST`) and focuses its link; a "Back to top" link closes the list. **This is the old `/` archive.** |
| `/crawlers` | The roster grid (2 columns at 375 px, 5 across on a laptop). Status filter chips appear only when more than one status exists |
| `/crawlers/:id` | One crawler (redesigned in 011 revision 2): a portrait / text hero with the archetype, the name, the handle, the "Played by" credit and one "Start at Episode 1" CTA, then whichever of concept, pockets and the entry achievement have anything in them (the achievement carries no section label of its own), then the prev/next bar. No floor, no level, no "alive" pill - and no placeholders |
| `/community` | The single link every social bio points at: Discord first, the platform row, the cadence, and one paragraph on how to help |

All five are prerendered to real HTML at build time (`dist/watch/index.html`, and so on), so a
scraper that runs no JavaScript still gets the page, its `<title>`, its description and its
OpenGraph card. Hub routes stay client-rendered and are not in the sitemap.

The marketing pages live in `src/site/` and every one of them is a lazy chunk: open `/ep/3` from a
shared link and not a byte of the front door is downloaded. The prerenderer resolves those chunks
before it renders (`src/site/pages/lazy.tsx` explains the two-state wrapper), because
`renderToString` writes a Suspense fallback and never comes back.

### The data behind it

**`public/data/show.json`** - the hub's file, with the front door's fields added:

| Field | Used by | What it is |
|---|---|---|
| `tagline` | `/` H1 | One line. The promise. |
| `pitch` | `/` lead, every default description | Two or three sentences. |
| `cadence` | `/`, `/community` | "New crawls every week." |
| `trailerYoutubeId` | `/` hero embed | Optional. Without it the hero embeds the newest episode instead, and the "Latest episode" card is hidden so the same video is not on the page twice |
| `links.{youtube,discord,tiktok,bluesky,instagram}` | social row, footer, `/community` | Only the ones present are rendered - no greyed-out icons |
| `episodes[].premiereAt` | JSON-LD `uploadDate` | ISO. When the video went up |
| `episodes[].hubLiveAt` | the gate (below) | ISO. When the System feed opens |
| `episodes[].summary` | `/watch` rows, episode `<meta description>` | One spoiler-safe sentence |
| `episodes[].ogImage` | share card, row thumbnail | Optional. Defaults to the generated `/og/ep{N}.png` |

**`public/data/crawlers.json`** (new) - the roster. One entry per crawler, `id` equal to the hub's
crawler id (`harry`, `mimi`, `ronald`, `xo`, `veil`) so the live status line can join on it:

| Field | What it is |
|---|---|
| `id` | The hub id. This is the join key; changing it silently unlinks the live status |
| `name` | The archetype ("The Stuntman") |
| `characterName` | The character ("Ronald Hudson") |
| `handle` | "Dungeon Crawler Ronald" |
| `player` | `{ name, pronouns?, bio?, bust?, links? }` - the real person, kept short |
| `concept` | One or two lines from the character doc |
| `pockets` | A list: what was in their pockets when the world ended |
| `entryAchievement` | `{ title, text, box?, item? }` - the System's words, verbatim. This is the page's centrepiece |
| `art` | `{ bust, full? }` - `bust` is the 192 px roster square, `full` the crawler page hero |
| `og` | Optional. Defaults to the generated `/og/crawler-{id}.png` |
| `status` | `alive \| dead \| fused \| unknown`, **authored by hand**. Death is never inferred from an event log |

**`dist/data/status.json`** (generated, never committed) - `{ generatedAt, episodeId, crawlers, appearances }`.
`scripts/build-status.ts` runs the hub reducer to the end of the newest episode past its
`hubLiveAt` and emits each crawler's `{ level, hp, floor, lastEpisodeId }`, plus an `appearances`
map (crawler id to the ids of every published episode whose data names them). The crawler page
no longer renders an "Appears in" list (dropped 2026-09-25); the map stays for other readers.

### How `hubLiveAt` gates the CTA

One rule, in `src/site/gate.ts`, and every episode surface obeys it:

- **Before `hubLiveAt`** the button reads **Watch on YouTube** and links out, and the row carries a
  "Augmented Viewer unlocks in 2d 4h" chip. The hub page still exists - nothing links to it.
- **At or after `hubLiveAt`** the button becomes **Watch in the Augmented Viewer** and links to `/ep/:id`.
- **No `hubLiveAt`** means live now, which is what keeps every pre-011 `show.json` working.

The comparison is a plain `Date.now()` in the browser; there is no server. A prerendered page is
built with the build's clock and re-evaluates against the real one a moment after it mounts
(`useNow`), so the HTML and the first client render always agree and the chip never flickers.

The same timestamp is the spoiler rule for the live status line: `status.json` only ever reflects
episodes a visitor was allowed to have seen.

### Checking a share preview

The share images are generated at build time by screenshotting the app's own `/_og/**` routes, so
a card and the page it links to are the same object:

```sh
npm run build          # writes dist/og/site.png, crawler-{id}.png x5, ep{N}.png
npm run preview        # http://localhost:4173/
open http://localhost:4173/_og/crawler/mimi   # the frame the screenshot is taken of
```

To check what a link will actually preview as, read the tags out of the built HTML - these are what
Discord, Bluesky, Slack and Twitter fetch, and none of them runs JavaScript:

```sh
grep -E 'og:(title|description|image|type|url)|<title>' dist/crawlers/mimi/index.html
```

Every route sets `og:title`, `og:description`, `og:image`, `og:type`, `og:url`, `og:site_name` and
`twitter:card`, plus a canonical link. The images are 1200x630 PNG. A real preview in Discord or
Bluesky needs a public URL, so it can only be confirmed once the site is deployed; locally the tag
inspection above is the check.

`VITE_SITE_URL` is what those absolute URLs are built from, so set it (or the `SITE_URL` repository
variable) before a deploy anyone is meant to share.

### Analytics

Plausible, cookieless, and absent unless asked for. Set `VITE_PLAUSIBLE_DOMAIN` (the deploy
workflow reads the `PLAUSIBLE_DOMAIN` repository variable); with it unset no script is loaded, no
global is defined and no request is made, which is what `npm run dev` and every test get. There is
no cookie banner because there is nothing to consent to.

Three custom events, all from `src/site/analytics.ts`:

| Event | Props | Fired when |
|---|---|---|
| `hub_open` | `{ episode }` | A gated CTA pointing at `/ep/:id` is clicked |
| `outbound` | `{ to, episode? }` | A link leaves the site: YouTube, Discord, TikTok, Bluesky, Instagram |
| `crawler_view` | `{ crawler }` | A crawler page mounts |

### Author to fill

`public/data/crawlers.json` carries its own list in a top-level `"todo"` array, reproduced here:

1. Confirm the handles - they are all "Dungeon Crawler {first name}" placeholders today.
2. `concept`: one or two lines per crawler from the character docs (only Ronald's is written).
3. `pockets`: what was in their pockets when the world ended, one line per item (none written yet).
4. `player.pronouns`, `player.bio` (two sentences) and `player.links` for all five.
5. `player.bust`: a photo of the real person, if they want one on the page.
6. `show.json`: `trailerYoutubeId`, the real `premiereAt` / `hubLiveAt` dates, and
   `links.tiktok` / `links.bluesky` / `links.instagram`.

And outside the data files:

7. The domain. `VITE_SITE_URL` defaults to `https://dungeoncrawlcast.com`; registering it is not
   something this repo can do.
8. The Plausible site, if analytics is wanted (`VITE_PLAUSIBLE_DOMAIN`).
9. Point every social bio at `/community`, which is the URL that page exists for.

`entryAchievement` is done: all five are transcribed verbatim from the author's notes, with the
`box`, the `item` and the `reward` paragraph the System read out.

**Unwritten means empty, never "coming soon"** (011 revision 2). A field the author has not filled
in is `""` or `[]` in the JSON and the crawler page renders *nothing* where it would have gone - no
heading, no placeholder, no greyed-out box. One filled section beats five empty ones, and a
screenshot taken today is not embarrassing because there is nothing in it to be embarrassed by.

### Parked (v2 - deliberately not built)

From the addendum's own list, so the next person does not have to guess what was left out on
purpose: `/world` (neighbourhood pages, NPC pages, a newcomer glossary), `/press` (a one-pager with
a logo pack, cast, audience stats and contact), newsletter signup, guest / Table B roster UI, merch,
and comments.

---

## Lean-forward (v2)

The ambient view is unchanged: video, party rail, ticker. Everything below is **opt-in** - it
opens on an explicit click or keypress and closes on an explicit action, and the right rail
hosts exactly one of the feed (default), a crawler glance card, or the map. Exactly one thing
may cover the stage, and only when asked for from the glance card: the full record. Panel and
record content are still a pure function of the playhead, so scrubbing in either direction
updates them and never leaks an event whose `t` is ahead of the playhead.

### Crawler glance card

Click (or focus and press Enter/Space) a crawler frame in the party rail. The rail swaps the
feed for that crawler's glance card - how they are doing *right now*, in a couple of seconds:

1. **Header** - portrait, name, handle · played by {player}, class (or "Unclassed") · level. The
   "·" is decorative and hidden; a comma beside it is what a screen reader hears.
2. **Vitals** - an `HP` label, the sheet's ten-segment strip and current/max, then a `MANA`
   row directly beneath it: one System-blue segment per point of the pool, filled to the current
   value, and current/max. A crawler with no pool (`max` 0) has no mana row at all.
3. **Rank** - a `RANK` label, the current rank, a ↑/↓ delta against the previous elapsed `rank`
   event (↑ means the number fell, which is a climb), then `BEST`; a full-width sparkline of
   every elapsed rank point sits on its own row under them, with a text summary for assistive
   tech. An unranked crawler keeps the label and reads "Unranked".
4. **Debuffs** - chips, two rows, then "+N".
5. **Equipped** - one line per worn slot, `Slot · Item`, in the sheet's order (head, torso,
   arms, hands, legs, feet, then each accessory). "Nothing equipped." when the crawler is bare.
6. **Latest achievement** - the newest award only: title, time, and its description.
7. **Recent moments** - up to three entries of that crawler's history, each with its time.

Then **Open full record**, the card's only control.

Revision 2 removed the four ledger rows (count + newest per list) and the "-" placeholder rows
under Moments: a crawler's skill and inventory lists grow without limit, and the author only
ever wanted what they are *wearing* and the *last* thing they were awarded. The card's height is
still fixed - every row is single-line, Equipped is bounded by the sheet's seven slots, and the
sparkline row and the three-moment block reserve their height in CSS - so a crawler with forty
achievements renders exactly as tall as one with none and the card does not scroll on a laptop.

Close with the panel's × control, <kbd>Escape</kbd>, or by clicking the same frame again; focus
returns to the frame. Clicking a different frame switches cards without closing. At ≤ 900 px the
panel is a full-viewport overlay and the page behind it does not scroll.

### Full record

**Open full record** opens the whole System sheet as a modal dialog over the page - the one
overlay allowed to cover the stage. Revision 2 lays it out as a character sheet in an MMO:

- **Art column** - the crawler's full-figure art (`art` in the episode data) down the left,
  contained rather than cropped and hung from the top. The column hugs its image: full column
  width, height from the image, capped at the sheet's height, so a render with empty margins
  leaves no blank band beneath it. A crawler with no `art` gets their bust in the same column
  instead. At ≤ 900 px the art becomes a banner above the identity.
- **Top band** - identity (portrait, name, handle, played by, race, pronouns, crawler number,
  level, class, floor) and vitals side by side, with the **STATS** strip (STR / INT / CON / DEX
  / CHA, when the data carries them) full width beneath them. **VITALS** is the HP strip, then
  the **MANA** row under it (one segment per point, System blue, current/max), then rank.
- **Hotbar** - the Hotlist as ten numbered square keys filled in order, empty keys dashed and
  unlit, and a `+N` marker after key ten when the crawler is tracking more than ten. A key shows
  the entry's short name; when the entry carries a quantity above one, an `x5` box sits in the
  key's top-right corner the way an MMO bag draws a stack. Each key names itself for assistive
  tech ("Slot 3, The Rot Market" / "Slot 2, Standard Mana Potion, x5" / "Slot 4, empty"). On a
  phone the bar wraps to two rows of five with the marker right-aligned beneath.
- **Gear** - every slot on the official sheet (Head, Torso, Arms, Hands, Legs, Feet,
  Accessories) with what is worn in it or "-". Accessories share one row.
- **Tile grids** - Skills, Spells, Inventory and Achievements as bag-style tiles (name, then
  rank, cost or time in a mono footer), at most **eight**, with a **View all (N)** control when
  there are more. History shows its latest eight rows the same way. **SPELLS** sits between
  SKILLS and INVENTORY, as on the sheet, and its footer reads `Rank 1 · 2 mana`.
- **Tooltips** - a Hotlist key, skill tile, spell tile or inventory tile whose entry carries a
  description becomes a button that shows the sheet's full text on hover, on keyboard focus and
  on click (click toggles). <kbd>Escape</kbd> hides it and leaves the record open; a click
  outside hides it too. The tooltip is a `role="tooltip"` the trigger points at with
  `aria-describedby`, sits above the trigger and flips below it when there is no headroom.
  An entry with nothing to explain gets no button and no affordance at all.
- **List views** - **View all** replaces the dialog body with that category in full, under a
  **Back to record** control, and the dialog's title becomes `{name} - {CATEGORY}`. Focus moves
  to the list's heading on entry and back to the **View all** button on return. The list view is
  dialog-internal state: it resets to the sheet whenever the record closes.

Sections with nothing in them yet render a one-line System empty state rather than vanishing.

- **Size**: `min(1200px, 94vw)` wide, at most 90 vh tall, anchored to a fixed top offset so a
  seek that shortens it cannot re-centre it, scrolling inside itself over a backdrop that is
  opaque from the first painted frame. At ≤ 900 px it fills the viewport and stacks.
- **Modal**: focus moves to the close control on open and is trapped inside - <kbd>Tab</kbd> and
  <kbd>Shift</kbd>+<kbd>Tab</kbd> wrap - and the page behind it is inert and does not scroll.
- **Keys**: <kbd>Escape</kbd> steps back before it closes - in a list view it returns to the
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

Per episode, on this device only - no accounts, no server.

- **Key**: `dcc-watch-hub:resume:v1:<episodeId>` in `localStorage`.
- **Value**: `{ "episodeId": number, "t": number, "savedAt": ISO-8601 }` - the playhead and
  nothing else. Overlay state is never stored; on rejoin it is recomputed from the playhead
  like any other seek.
- **Saved** at most once every 5 s while playing, plus immediately on pause, on `pagehide`, when
  the tab is hidden, on an episode change and on unmount.
- **Offered** on open when the saved position is at least **30 s** in and outside the **last
  30 s** - a System card over the stage with "Rejoin the broadcast" and "Start from the
  beginning". Rejoining seeks there; starting over discards the position. An unanswered offer
  expires on its own once the broadcast has run past 5 s.
- **Cleared** when playback ends, when the playhead reaches the last 30 s, and on "start over".
- **Blocked storage** (private windows, disabled site data, a full quota) is silent: no card,
  no error, playback unaffected.

Opening the dev scrubber at `?t=` starts the fake source past that 5 s grace window, so the
offer is answered by the playhead itself and no card appears. That is expected.

### Under the stage

Between the player and the timeline sits a slim caption row: `Ep 1 · Floor 1 - <title>` on the
left (the page's one `<h1>`, so the episode title is finally visible) and the playhead on the
right. It used to sit *inside* the stage, where the host's own control bar covered it; that is a
deliberate deviation from v1 §5, recorded in `specs/003-crawler-record/spec.md`.

The timeline below it carries a colour legend, a playhead tick distinct from the elapsed fill,
and its own tooltip per marker - instant, touch-friendly, and still spoiler-safe: a marker the
playhead has not reached names only its kind and time.

Every feed row is a seek control: it shows the moment it happened and clicking it moves the
broadcast there (the pinned sponsor too). Before the first event has elapsed the feed reads
"Standing by. The System reports when the broadcast begins."

The party rail wraps to 3 + 2 between 900 and 1100 px, where five frames next to the feed
column started truncating names, and becomes a horizontal snap strip at 480 px and below. Every
frame reserves its debuff-pip row whether or not it has one, so a seek never changes the rail's
height.

### Rank

DCC has **individual rank only** - there is no party rank. A `rank` event names one crawler and
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

`t` is whole seconds into the final edit - `…/ep/1?t=156` is 2:36. That is the only parameter
the feature owns, and it is the only thing a shared link ever carries: the dev flags (`fake`,
`panel`, `record`) are never emitted, because the URL is built from parts (origin, base, episode
id, `t`) rather than copied out of the address bar. On GitHub Pages the base is
`/dcc-watch-hub/`, so the same share reads `https://bastionfennell.github.io/dcc-watch-hub/ep/1?t=156`.

**On load**, `useDeepLink` parses `t` once per visit - one visit being one `(episode, ?search)`
pair, so a re-render is not a new one - and seeks the `TimeSource` to it exactly once, as soon as
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
visit still gets the card. Opening another episode from the header starts it at 0:00 - the link
applies to one visit of one episode.

### The controls

- **Caption row** - "Share this moment" sits at the right of the slim row under the stage,
  beside the playhead it is about. It shares the current whole second.
- **Feed rows** - every row (and the pinned sponsor) carries its own share icon for the moment
  that row names, as the seek button's *sibling*, never nested inside it: sharing a row does not
  seek to it. The label says which moment, e.g. "Share the moment at 2:34".
- Sharing never pauses, seeks, or otherwise touches playback. It reads the playhead.
- Timeline markers deliberately have no share control of their own - click one to seek, then
  share from the caption row. It keeps the strip uncluttered.

### Where the link goes

One ladder, in `src/share/share.ts`, and the last rung cannot fail:

| Rung | When | What the viewer gets |
|------|------|----------------------|
| `navigator.share` | the browser has it **and** the device wants it - a coarse pointer or a viewport ≤ 900 px, i.e. phones and tablets | the OS share sheet, with the link and `{episode title} - {time}` as its title. Dismissing it is **silent**: no notice at all |
| `navigator.clipboard.writeText` | a mouse and a wide window, or the share sheet was unavailable | the link on the clipboard, confirmed by "Moment marked. The link is on your clipboard." |
| shown | neither worked - an insecure context, a denied permission, an unfocused document | "Moment marked. Copy the link below." with the link in a read-only field, selected on arrival so one keystroke copies it, and a **Dismiss** control |

The confirmation is a System notice directly under the caption row, inside a `role="status"`
polite live region that is **always mounted and weightless** - so it announces once, and the
stage above it never moves when it appears. A copy or a native share clears itself after two
seconds; the fallback stands until it is dismissed, because it is holding the only copy of the
link the viewer has.

---

## Broadcast log

The feed is a rolling eight-item ticker: by 9:00 the cold open has scrolled away. The log is the
whole reel. It is 005 (`specs/005-episode-log/`).

**Where it sits.** A full-width section *below* the party rail on desktop - the dead space under
the frames - and last in the stacked phone layout, after the feed. It is a sibling of the
two-column grid, never inside it, so opening it grows the page downward and the stage, caption
row, timeline and rail do not move by a pixel (measured at 1440, 500 and 360 px; see the 005
Results).

**Collapsed by default**, like everything ambient here: a slim black bar reading
`BROADCAST LOG · Open the log · 55 moments on the log`. The count is a polite live region
throttled to one change a second, so a screen reader is not read a queue of numbers while the
broadcast runs. Open and closed is a **viewer preference**, remembered on this device:

- **Key**: `dcc-watch-hub:prefs:v1:log-open` in `localStorage`, value `"1"` or absent. Nothing
  else - no rows, no filters, no playhead. Blocked storage is silent: the log opens closed.

**The rows** are every known elapsed event, **oldest first** - the feed reads newest-first
because it is a ticker; the log reads top-down because it is a transcript. Each row is the feed's
own row: time, category, text, System boxes and purple sponsor slots included. Clicking a row
seeks the broadcast to that moment; each row's share icon copies that moment's link without
seeking, exactly as in the feed. The newest row carries a thin left accent. The list scrolls
inside a bounded area (60 vh desktop, 50 vh phone); nothing is virtualized at this scale.

Nothing on the log is ahead of the playhead: the rows are `logItems(events, t, party)`, recomputed
every render, so scrubbing back removes rows and the count follows.

**Filters** sit above the list in two groups, **Types** and **Crawlers**, each chip a toggle
button with its elapsed count. A chip exists only while something of its kind has elapsed - the
chips are a reading of the log so far, not a catalogue of what an episode might contain, so they
arrive as the broadcast produces them (17 types and 4 crawlers by 9:40 of Ep 1; 14 and 4 at 3:20).
A backward seek that empties a chip takes the chip away *and* the selection standing on it, so a
filter can never leave the log blank for a reason the viewer cannot see. Selections combine as
**any selected type AND any selected crawler**; a crawler filter drops rows that belong to nobody
(System, sponsor, chapter, map, note). The bar then reads "N of M moments", and **Clear** resets.
Filters are per visit - they are not remembered across reloads.

**Following the broadcast.** While the episode plays, the list stays pinned to the newest row.
Scroll up to read something and it lets go and offers **Follow the broadcast**; activating it
returns to the end and re-arms. `prefers-reduced-motion` turns the scroll from smooth to instant.

**Two quiet states**: before the first event the open log reads "Standing by. The System reports
when the broadcast begins." (and shows no filters at all, because there is nothing to filter);
a filter that matches nothing reads "Nothing on the log matches." while the log itself stays
whole.

---

## On a phone

Phones are the likely form factor for a watch-along, and v1 only stacked the desktop layout. The
mobile pass rebuilds the page under the existing 900 px breakpoint. It is 006
(`specs/006-mobile-pass/`). **Above 900 px nothing changed** - the desktop tree, its markup and
its pixels are the same (the 1440 px screenshots are identical before and after; see the 006
Results).

**The stage docks as you read.** Scroll past the player and the *same* element is repositioned by
CSS as a mini-player pinned under the header *and* under the tab strip - 45 vw wide (max 260 px,
170 px on a landscape phone), 16:9, top right, its top edge 8 px below the strip's underline
(88 px down the viewport). It is a fixed frame over a page that scrolls, so it yields the strip
rather than covering it: the four tabs are the page's navigation and stay tappable at every
scroll position. Nothing is re-parented, so the YouTube iframe never reloads and playback
does not stutter. The space the stage came from keeps its height, so the page below it does not
jump (measured: the slot is 213.8 px at 400 px wide, before, during and after docking). A 28 px
bar across the bottom of the mini frame is the one part of it that is ours to tap:
**Return to the stage** scrolls back to the top and the player grows back. The minimap badge is
hidden while docked, the achievement toast shrinks into the frame, and the resume offer and the
ended card cancel mini mode outright - those cards need the full stage.

**Four tabs under the timeline.** Feed, Party, Map and Log, a WAI-ARIA tab list: tap a tab, or
swipe the pane area left and right, or arrow through the strip with Home/End at the ends. The
strip **sticks** under the compact header once you scroll (44 px tall, `--tabstrip-h`, which is
also what the mini-player's offset is built from, so the two cannot drift): the panes are long,
and a strip that scrolled away would leave the page with no way between them - and would slide
under the docked player. All
four panes stay mounted and are hidden with `hidden`, so the log's follow position and the map's
zoom survive a switch. Vertical scrolling is untouched (`touch-action: pan-y`, and a drag counts
as a swipe only past 40 px and only when it is twice as horizontal as it is vertical). A pane
that owns the horizontal axis itself opts out with `data-swipe-ignore` - the floor map's pan
viewport does, so dragging the map pans the map and does not flick to the next tab. The selected
tab lasts the visit; it is not in the URL and not remembered across reloads.

- **Feed** is the ticker and the sponsor slot, as before. At 400 × 800 the first feed row lands at
  y 451 and six rows are fully above the fold.
- **Party** is the crawler frames in two columns - four of them since 008, so the grid is square;
  an odd crawler out spans both columns. Tapping one opens the glance as a sheet.
- **Map** is the floor map inline with its own zoom, fit and drag-to-pan - the stage's minimap
  badge is not rendered on phones, because the tab *is* the map.
- **Log** is the broadcast log, already open, with no toggle: the tab is the open/closed control.
  Its filters, seek, share and follow behave exactly as they do on desktop.

The desktop rail panel and the full-width log section are not rendered on phones at all.

**The glance is a bottom sheet.** It slides up to 70 vh over a dim backdrop, leaving the video
visible above it - 182 px of it at 400 × 800. On a **short landscape viewport** (under 500 px
tall) it takes 85 vh instead, and at that height it covers the player: 85% of an 844 × 390 screen
leaves 58.5 px, which the header and the docked frame's own offset use up. That is the intended
trade - a glance card needs the room to be readable, and "the video stays visible above the
sheet" is a portrait criterion. It has
a grab handle, a close control and a title; drag it down past a quarter of its height, tap the
backdrop, press Escape or use the close control and it goes, returning focus to the frame that
opened it. The page behind does not scroll while it is open. **Open full record** still opens the
full-screen record dialog, above the sheet, and closing the record leaves you back on the sheet.

**Reduced motion** removes all of it: the sheet appears instead of sliding, the snap-back is
instant, and "Return to the stage" jumps rather than scrolls.

**One thing to know about resizing.** Crossing 900 px swaps between two different trees, so the
player remounts and the embed reloads (and the tab selection resets to Feed). Rotating a phone,
or any resize that stays on one side of 900 px, does neither: the same stage element and the same
selected tab survive - verified at 400 × 800 → 800 × 400 → 880 px. Only a desktop window being
dragged across the breakpoint pays that cost, and it pays it once.

## Entities and the Codex

NPCs are the one thing the show has that the episode files could not hold: a boss met on floor 1
comes back three episodes later, and a viewer wants both "who is this, right now" and "who is
this, ever". So 007 (`specs/007-npc-registry/`) splits them in two, and the split *is* the
spoiler policy:

- **On the episode page, what you see is tied to the playhead.** The Encountered strip only lists
  entities the broadcast has already met, and a record only shows the facts already released. Scrub
  back and both shrink. This is the same rule as every other overlay surface (constitution I).
- **The Dungeon Codex is not tied to the playhead, or to this device at all.** It lists every
  entity that appears in any **published** episode, ordered by the episode that introduced it, with
  every fact any published episode has released. Opening `/codex` before watching episode 3 will
  tell you how episode 3 ends for The Tollkeeper. That is deliberate: a glossary you have to earn is
  not a glossary. Nothing device-specific gates it - no "visited" list, no local storage.

The line between them is **published**, not **watched**: an entity in `npcs.json` that no episode
in `show.json` mentions is not listed at all.

### The registry file

`show.json` gains one optional field, `registryUrl` (`"/data/npcs.json"` in the sample). Without
it there is no strip, no NPCs tab, no header link and no `/codex` route - the episode page
works exactly as it did, and `npc` events still show in the feed under their raw id.

```jsonc
{
  "entities": [
    {
      "id": "the-hoarder",              // stable; the anchor in /codex#<id>
      "name": "The Hoarder",
      "kind": "boss",                   // boss | vendor | ally - exactly these three
      "floor": 1,                       // optional
      "portrait": "/img/npcs/the-hoarder.svg",  // optional; an initial disc stands in
      "aliases": ["Hoarder", "The Crate King"], // optional; searched with the name
      "intro": "Something in Quadrant C has been stacking crates into walls…",
      "facts": [                        // 0..n; revealed one at a time by `unlock`
        { "id": "lair", "text": "It nests behind the crate wall it builds…" },
        { "id": "weakness", "text": "It cannot see red." }
      ]
    }
  ]
}
```

`intro` is the **spoiler-free** line: it is shown the moment an entity is met, so it must not
contain anything an episode later reveals. Everything that *is* a reveal belongs in `facts`, which
are released by name. Malformed entities and facts are dropped with a console warning rather than
breaking the page (`normalizeRegistry`), and the JSON Schema is
`specs/007-npc-registry/contracts/npcs.schema.json`.

Kind decides the tint everywhere: **boss** `--danger` (red), **vendor / guide** `--amber-fg`
(amber), **ally / faction** `--marker-levelup` (green). There is no "mob" kind - ordinary mobs are
not registry entities.

### The `npc` event and its CSV row

```jsonc
{ "t": 380, "type": "npc", "id": "the-hoarder", "action": "update",
  "unlock": ["lair"], "note": "It nests behind the wall it builds." }
```

`action` is one of `met` (enters the broadcast), `seen` (sighted), `update` (the System amends the
file - this is what carries `unlock`) and `defeated`. `unlock` names fact ids on that entity;
`note` is the System's line for the moment. Any action creates the encounter, so a `seen` before a
`met` still counts.

In the editor's sheet it is one row - field2 carries the action and, after a colon, the facts it
releases:

| type | field1 | field2 | field3 |
|------|--------|--------|--------|
| `npc` | entity id | `action`, optionally `action:fact-id,fact-id` | note |

```csv
2:08,npc,,the-hoarder,met,Something is stacking crates in Quadrant C.
2:30,npc,,the-hoarder,update:lair,It nests behind the wall it builds.
3:46,npc,,grull-rep,seen,A window opens in the wall. It is open for business.
```

The converter cannot check ids on its own - the registry is show-level data it is not given.
Pass `--registry` and it will:

```sh
npm run sheet-to-json -- scripts/samples/ep1-broken.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json \
  --registry public/data/npcs.json --out /tmp/ep1-broken.json
# WARN row 16: unknown entity "the-listener-below" (not in the registry)
# WARN row 17: unknown fact "lantern" on entity "the-hoarder"
```

Both are **warnings, not errors**: the row is still written. An unfiled entity is a real editorial
case - the feed says "the-listener-below enters the broadcast" and the strip simply has nothing to
file, which is what `ep1.json` at 4:05 does on purpose. Without `--registry` no id is checked at all.

### The Encountered strip and the entity record

Under the party rail (and as a fifth **NPCs** tab on phones, a two-column grid) sits
**ENCOUNTERED**: one chip per entity met so far, newest first, each a portrait or a kind-tinted
initial disc, the name, and the kind in mono caps. Defeated strikes the name through and adds a
red `DEFEATED` tag. Before the first `npc` event the strip says "No entities tagged yet." The
chips are panel triggers like the crawler frames - same `aria-expanded` / `aria-controls`, same
focus return when the panel closes.

Tapping one opens the **entity record** in the right rail (a bottom sheet on a phone): the
kind-tinted header with portrait, name, kind and floor; the intro; `DEFEATED` or `ACTIVE`;
**FACTS** - only those unlocked at or before the playhead, "The System has released nothing
further." when there are none; and **MOMENTS**, every `npc` event about this entity so far,
newest first, each one a seek control with the same share button the feed rows carry. Seeking
back takes facts away, and seeking before the entity was met closes the record outright, because
there is nothing left to show.

At the bottom, **Open in the Codex** - beside the broadcast this is a button, not a link: it
swaps the record for the **Registry panel** in the same rail, opened on that entity, and the video
never stops. The strip's own header carries the way in from cold, **Browse the Codex**, a panel
trigger like the chips beneath it. The one link out to `/codex` lives in that panel's footer.
See **The Registry beside the broadcast** below.

### The Dungeon Codex page

`/codex`, linked from the header (desktop cluster and phone menu) whenever the show has a
registry. It loads `show.json`, `npcs.json` and **every** episode file in parallel and builds the
index itself, so it needs no new data and no build step. If one episode file fails, the rest still
render and the page says so ("1 recap episode could not be indexed.").

- **Sections, newest episode first** - Episode 3, then 2, then 1 - one per episode that introduces
  somebody, headed with that episode's title and a count. An entity is filed under the episode it
  *first* appears in, however many times it comes back, and inside a section the entity introduced
  **latest** leads (same episode: later timecode first). Reading down the page is reading backwards
  through the archive, so the newest material is the material you land on.
- **Search** over name **and** aliases, case-insensitive substring - "crate king" finds The
  Hoarder. No match: "The Codex has no such entity."
- **Kind chips** with counts, combining as any-of: Boss + Ally shows both.
- **Expanding an entry** reveals its **FACTS**, each tagged `Ep N` with the episode that first
  released it (a fact no published episode unlocks is not listed), and its **APPEARANCES** -
  every moment, as `Episode N - Title · 5:30 · AMENDED`, linking to `/ep/N?t=330`. A defeated
  entity closes with "Defeated in episode N."
- **`/codex#<id>`** opens that entry expanded and scrolled clear of the sticky header, which is
  where "Open in the Codex" lands.

### Scoping the Codex

The Registry is published, not watched - so revision 2 adds the one control that lets a viewer
hold it to where they are. A labelled **Scope** select leads the toolbar, and whatever it says is
in the URL (`?scope=`, absent meaning all), so a scoped view is shareable and the back button
works. An unreadable scope opens the whole archive rather than an error.

- **All episodes** (the default) - everything published, exactly as before.
- **Through Episode N** (`?scope=through-N`) - only entities that debut at or before N, with facts
  released later and appearances later stripped out, and "Defeated in episode N" shown only once
  that defeat has happened. This is "what I am allowed to know, having watched this far".
- **Only Episode N** (`?scope=ep-N`) - only entities with a beat in N, filed under that one
  section, appearances narrowed to N. Facts released *earlier* stay, and so does an earlier
  defeat: that is history this viewer already has. Nothing later ever leaks. This is "who is in
  this episode".

Search, the kind chips (whose counts follow the scope), and `#<id>` all combine with it, and the
empty state still reads "The Codex has no such entity." with the scope left selected. The order
is the same at every scope: newest episode first, latest debut first inside it.

The episode page carries the same scopes: the Codex panel opens at **Through Episode N** for
the episode being watched, and its footer link hands that scope (and the open entity) to the full
page - `/codex?scope=through-N#<id>`, that entry open, with nothing past where the viewer is.

The trimming itself is one pure function, `scopeRegistry(entries, scope, show)` in
`src/engine/registry.ts`, beside `parseRegistryScope` and `scopeParam`; the page only chooses a
scope and renders what comes back.

### The Registry beside the broadcast

Revision 3 answers the obvious complaint about all of the above: reading the Codex meant
leaving the episode. It does not any more. **Browse the Codex** on the Encountered strip (and
in the NPCs tab) opens the Codex as a **rail panel** - a bottom sheet on a phone - beside a
video that keeps playing. It is the same panel slot the dossier and the entity record use: one at
a time, never over the stage, closed by Escape, the close control or the trigger, with focus
returning where it came from.

Inside it is the page in a narrow column: the same **Scope** select, search box, kind chips,
episode bars and expandable entries, with three differences that follow from the stage being right
there.

- It opens at **Through Episode N** for the episode being watched, not at the whole archive.
- The scope, the search and the chips are panel state. Changing them does **not** touch the URL -
  navigating would take the broadcast with it.
- An appearance **in the episode being watched** is a seek button (with the feed's share icon
  beside it), not a link: activating it moves the playhead and nothing else. Appearances in other
  episodes stay links to `/ep/N?t=…`.

One more difference, from revision 4: **in the panel, the current episode follows the playhead**.
Earlier episodes are published history and are listed whole, but the episode on the stage
contributes only what has already aired - an entity met later in it is not listed, a fact unlocked
later is not shown, and "Defeated in episode N" waits for the defeat. Scrub back and the panel
gives it up again; the facts, the appearances and the defeated line are recomputed from
`(episode, t)` on every frame, exactly like the strip beneath it. Everything else about the panel
is still publication-scoped, and opening it never seeks and never pauses.

The episode files it needs are fetched **once per visit**, lazily, the first time either the panel
or `/codex` asks - `RegistryIndexProvider` (`src/data/RegistryIndexContext.tsx`) holds the
index for both, with a System-voice "The System is indexing the archive." line until it lands and
the same "could not be indexed" notice inside the panel when a file fails.

## The spell registry

The Crawlers book prints every spell once - name, flavour line, type line, mana cost, range,
duration, AI Favor, limitations, cooldown, description, base damage and an UPGRADES block - so the
site prints it once too. `public/data/spells.json` holds the whole Spell Skills chapter (23 spells,
the d100 SPELLS CHART's full range), and `show.json` points at it with `spellsUrl`, exactly the way
`registryUrl` points at `npcs.json`. The schema is
`specs/008-real-crawlers/contracts/spells.schema.json`.

A crawler sheet then **points at a spell instead of restating it**. A `spells[]` entry or a
`hotlist[]` mark may carry `ref` (a spell id) in place of `name`:

```json
"hotlist": [{ "ref": "heal" }, { "name": "Standard Mana Potion", "qty": 5, "desc": "..." }],
"spells": [{ "ref": "heal", "rank": 1 }]
```

The entry inherits the book's name, mana cost and full text; `rank` stays the crawler's own, and
`mana` / `desc` written on the entry are explicit overrides, kept for homebrew and scroll-only
spells the book has no row for. Resolution lives in `src/engine/spells.ts` (`resolveSpell`,
`resolveHotlist`) and is pure, so the hotbar key, the spell tile, its tooltip and the list view all
read the same resolved view. A `ref` the file does not carry falls back to the entry's own fields
(and to the ref as a name), and a missing or malformed `spells.json` degrades to an empty registry
with a console warning - the page still renders, spells just read as the sheet wrote them.

The text is transcribed from the Crawlers book and lives in the data file only. This is a private
repo; check with the author before any public release.

## Authoring episode data

The editor logs events in a Google Sheet during the edit pass and exports CSV. Header row
required; columns are `timecode,type,actor,field1,field2,field3`
(full contract: `specs/001-watch-hub-v1/contracts/sheet-csv.md`).

- `timecode` - `hh:mm:ss`, `h:mm:ss`, `mm:ss`, or plain seconds. Unparseable → **ERROR**.
- `type` - one of the rows below. Unknown → **WARN**, and the row is passed through verbatim.
- `actor` - a crawler `id` from `initialState.party[].id`. Unknown or missing → **WARN**.
- `field1..field3` - per type, below. Lists use `;`; map cells use `r,c;r,c`.

| type | field1 | field2 | field3 |
|------|--------|--------|--------|
| `system_message` | text | – | – |
| `achievement` | title | desc | – |
| `loot` | item | source | – |
| `hp` | current | max | – |
| `mana` | current | max (number, optional) | – |
| `level_up` | level | – | – |
| `rank` | rank | – | – |
| `map_reveal` | cells `r,c;r,c` | label | – |
| `sponsor` | text | durationSec | – |
| `chapter` | label | kind (`boss`/`loot`/`achievement`/`levelup`/`story`) | – |
| `status` | add (`;`) | remove (`;`) | – |
| `inventory` | add (`;`) | remove (`;`) | – |
| `skill` | name | rank (number, optional) | desc (optional) |
| `spell` | name, or a `spells.json` id with `--spells` | rank (number, optional) | mana cost (number, optional) |
| `class` | class | – | – |
| `hotlist` | add (`;`) | remove (`;`) | – |
| `equip` | slot (`head`/`torso`/`arms`/`hands`/`legs`/`feet`/`accessory`) | item | – |
| `unequip` | slot (as above) | item (accessory only; optional) | – |
| `note` | text | – | – |
| `npc` | entity id | `action` (`met`/`seen`/`update`/`defeated`), optionally `action:fact-id,fact-id` | note |

Convert:

```sh
npm run sheet-to-json -- path/to/ep4.csv \
  --episode 4 --duration 5400 \
  --initial-state scripts/samples/ep1.initial.json \
  --registry public/data/npcs.json \
  --spells public/data/spells.json \
  --out public/data/ep4.json
```

`--registry` is optional and names the show's `npcs.json`; give it and every `npc` row's entity
id and fact ids are checked (warnings only - see **Entities and the Codex** above). Without
it no id is checked, because the registry is show-level data the converter is not otherwise given.

`--spells` is optional in the same way and names `spells.json` (see **The spell registry** below).
With it, a `spell` row whose field1 is kebab-case (`heal`) is read as a registry id and written as
`ref`; anything else (`Heal`) stays a display name, so older sheets are untouched. An id the file
does not carry is a warning and falls back to a name, and every `ref` in `--initial-state` is
checked too.

`--initial-state` is a JSON file holding the episode's `initialState` (`party` and `map`).
Each crawler there may carry the optional sheet fields the dossier renders - `race`, `pronouns`,
`crawlerNumber`, `stats` (`{ str, int, con, dex, cha }`), `mana` (`{ current, max }`), `hotlist[]`, `skills[]`
(`{ name, rank?, desc? }`), `spells[]` (`{ name?, ref?, rank?, mana?, desc? }`), `gear`
(`{ head?, torso?, arms?, hands?, legs?, feet?, accessories[]? }`)
and `art` (a full-figure image path; the record falls back to the bust without it). They need no new CSV columns, and v1 files without them keep working: the
dossier simply omits what it does not know.

**Mana** (009) is the one optional field with a rule behind it. Write `mana` and it is taken
verbatim - a sheet is allowed to disagree. Leave it out and the state derives it: `max` is the
crawler's `stats.int` and the pool starts full, so a file that never heard of mana still shows a
strip. A crawler with no `stats` either has no pool at all, which reads as 0/0 and hides the
strip rather than inventing one. Every shipped crawler writes the box explicitly, and every one
of them agrees with the rule.

`hotlist[]` and `inventory[]` take either a plain string or an object
(`{ name, qty?, desc? }`, plus `ref` on a hotlist mark) - a string is the shorthand for
`{ name }`, so every older file reads exactly as it did. `qty` draws the `x5` box on the hotbar key and the `x5` meta in a list view;
`desc` is the sheet's own paragraph and is what the tooltip shows. A paragraph does not belong
in a CSV cell, so this structure lives in `--initial-state` only: `hotlist`, `inventory` and
`spell` rows in the sheet still name entries by their short name alone, and a `hotlist` or
`inventory` `remove` matches on that name and drops the whole entry.
The converter sorts events by `t`, normalizes them, and prints a summary such as
`wrote public/data/ep4.json (42 events, 2 warnings)`. **Warnings still produce output** (unknown
actor, impossible HP, timecode past `--duration`, unknown type, bad `chapter.kind`, an
accessory `unequip` with no item - the last one worn comes off, a legacy `rank` row with
`crawler` in field1 - the rank is read out of field2, and - only with `--registry` - an `npc`
row naming an entity or a fact the registry does not have); **errors write nothing and
exit 1** (unparseable timecode, missing header column, non-numeric numeric field, empty required
field, an `equip`/`unequip` slot that is not one of the seven, a `spell` row with no name or ref or a
rank or mana cost that is not a non-negative integer, a `rank` row with `party` in
field1 - DCC has no party rank).

### Carrying the map across episodes

Each episode file is self-contained: the overlay never reads another episode's log. So when two
episodes share a floor, **the later one's `initialState.map.revealed` must already list every
cell the earlier ones revealed on that floor** - that is what `initialState` is for. `ep2.json`
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

## The Studio

The Studio is the author's event editor: watch the episode, pause, drop an event at the playhead,
pick a type, fill in only what that type needs, and export the exact `ep{N}.json` the viewer loads.
It is a tool, not a viewer surface - it is not linked from the site's navigation and it loads as its
own lazy chunk, so a viewer who never opens it never downloads it.

**Where it is**

| URL | What it is |
| --- | --- |
| `/studio` | Drafts in this browser, New episode, Open file..., Edit a published episode |
| `/studio/ep/{N}` | The editor for draft `N` |
| `/studio/ep/{N}?fake=1` | The editor driven by the dev scrubber instead of YouTube (dev server only) |

It needs a screen at least 1000 px wide; below that it shows a notice instead of the editor.
Authoring on a phone is a non-goal.

### The workflow

1. **Start an episode.** `/studio` -> *New episode*. Give it a number, a title, the YouTube URL (any
   share, watch, embed or shorts link - only the id is kept) and a floor. Choose where the party
   comes from: the **initial party** of another episode (restarting a run), the **final state** of
   another episode (episode N + 1 begins where N ended - the viewer's own reducer runs the whole log
   to work it out), or **empty**. Duration is optional here; fill it from the player later.
2. **Mark events.** Play the video. When something happens, press **E** (or the big *Add event at
   m:ss* button). Playback pauses, the form opens with the time already set. Filter the type grid,
   press Enter, fill the fields, **Cmd/Ctrl + Enter** to save - or **Shift + Cmd/Ctrl + Enter** to
   save and resume playback in one keystroke.
3. **Fix events.** Click a row in the Events list: the video seeks there and the form opens. Row
   actions *Retime to playhead*, *Duplicate at playhead* and *Delete* are one click, or **T**, **D**
   and **Delete** once a row is selected. Undo and redo cover everything, a hundred steps deep.
4. **Preview.** The pane under the timeline is not a mock-up: it runs the draft through the viewer's
   own `reduceTo` and renders the viewer's own party rail and event feed at the playhead. If the
   preview is wrong, the episode is wrong.
5. **Check.** The **Issues** tab runs the viewer's validation over the draft plus the cross-checks
   the loader deliberately skips: an actor who is not in the party, a spell or entity ref no registry
   carries, an event past the end of the video, a row the reducer would ignore. Clicking an issue
   selects and seeks to the offending event.
6. **Export.** See *Publishing an episode* below.

### Hotkeys

| Key | What it does |
| --- | --- |
| `Space` | Play / pause |
| `J` / `L` | Back / forward 5 seconds |
| `Left` / `Right` | Back / forward 1 second |
| `E` | Add an event at the playhead (pauses playback) |
| `T` | Retime the selected event to the playhead |
| `D` | Duplicate the selected event at the playhead |
| `Delete` / `Backspace` | Delete the selected event (no confirmation - undo is one keystroke away) |
| `Cmd/Ctrl + Z` | Undo |
| `Shift + Cmd/Ctrl + Z` | Redo |
| `Cmd/Ctrl + S` | Save: into the picked data folder if there is one, otherwise a download |
| `Escape` | Close the form (in the form) |
| `Cmd/Ctrl + Enter` | Save the event (in the form) |
| `Shift + Cmd/Ctrl + Enter` | Save the event and resume playback (in the form) |

Two rules about the keyboard:

- **A key pressed in a text box belongs to the text box.** Space types a space in the search field,
  `d` types a `d`. Only combinations with Cmd, Ctrl or Alt fire from inside an input.
- **While the event form is open the page keys are off.** Only undo, redo and save still fire; the
  form itself owns Escape and Cmd/Ctrl + Enter. The form says so under its buttons.

**YouTube would steal the keyboard, so the Studio does not let it.** A clicked iframe owns every
keypress after it, and the page hotkeys die with them - `E` does nothing and Space plays through
YouTube's handler rather than ours. The editor therefore lays a transparent shield over the embedded
player: **the video is click-to-pause; unlock to reach YouTube's own controls.** Clicking the stage
toggles playback through the transport and the keyboard stays on the page. The transport bar's
*Video controls: locked* button (locked by default) drops the shield when you need the host's own
controls - captions, quality - and says plainly that the hotkeys stop working once you click the
video; press it again to lock it. If Tab ever lands inside the iframe while it is locked, focus
comes straight back to the Add button. The dev stage (`?fake=1`) is never shielded: its play button
and scrubber are inside the box.

### Where drafts live

In `localStorage`, under the `dcc.studio.v1.` prefix: one key per draft plus a small index for the
list. Nothing is ever sent anywhere. That means:

- drafts are **per browser and per profile** - they do not follow you to another machine;
- a private window, or a browser with site data blocked, cannot hold them. The Studio says so in the
  header and on the drafts list; export early if you see that;
- clearing site data for the host clears the drafts. The export file is the durable copy.

The draft autosaves within half a second of every change, and flushes when you leave the page or
navigate back to the drafts list. The header says `Saved`, `Saving...`, or why not.

### Publishing an episode

1. **Export -> Download ep{N}.json** (or Cmd/Ctrl + S). The file is exactly what the viewer loads:
   two-space indentation, stable key order, one trailing newline, and it validates against
   `specs/009-mana/contracts/episode.schema.json`.
2. Put it in `public/data/` as `ep{N}.json`.
3. **Export -> Copy show.json entry** and paste the row into the `episodes` array in
   `public/data/show.json`, then list the episode's id under the right floor in `seasons`.
4. Commit both files. There are no code changes.

**Save to data folder** (Chromium only) skips steps 1 and 2: pick `public/data/` once per session
through the File System Access API and every later save - including Cmd/Ctrl + S - writes
`ep{N}.json` straight into the repo. Firefox and Safari have no such API, so the menu item is not
shown there at all and the download is the path.

To edit something that is already live, use **Edit a published episode** on `/studio`: it fetches the
file the site serves today and turns it into a draft, keeping the `show.json` row's title, video id
and duration. **Open file...** does the same for a `.json` you exported earlier. **Import**, in the
editor's header, replaces the current draft with a file while keeping the episode's own meta.

### The Episode tab

Title, video id, floor and duration, plus the starting party. The duration field has a *Use player
duration* button once the player knows one. The party is a validated raw-JSON box per crawler - the
deliberate escape hatch, because the crawler sheet is large and the Studio's job is events. Applying
a crawler goes through the same history as everything else, so undo covers it.

### Non-goals

No editor for `npcs.json`, `spells.json`, floors or maps; no full crawler-sheet form; no publishing
from the browser (no GitHub commit button); no collaboration; no thumbnails or waveforms; no CSV
import - the CSV pipeline above is unchanged and still the way an editor working in a spreadsheet
gets data in.

---

## Placeholders to replace before launch

Everything below is sample data so the site is runnable today, with one exception: as of
feature 008 the **party is real**. Harry, Mimi Rivers, Ronald "Madio" Hudson, Xavier "XO"
Ortiz and Veil Ravencrest are transcribed from the author's filled Dungeon Crawler Carl RPG
character sheets, and
the sheets - not this repo - are the source of truth for their names, stats, skills, hotlist,
inventory and gear. The sheets live in `character-sheets/` and the renders in
`character-portraits/`; both folders are gitignored source material and are not published.
The episodes those crawlers appear in (events, ticker copy, NPCs, map) are still invented.

**`public/data/show.json`**

| What | Current placeholder | Replace with |
|------|--------------------|--------------|
| `episodes[0].youtubeId` (Episode 1) | `"aqz-KE-bpKQ"` (Big Buck Bunny, Blender Foundation) | the real YouTube video id |
| `episodes[1].youtubeId` (Episode 2) | `"eRsGyueVLvQ"` (Sintel, Blender Foundation) | the real YouTube video id |
| `episodes[2].youtubeId` (Episode 3) | `"R6MlUcmOul8"` (Tears of Steel, Blender Foundation) | the real YouTube video id |
| `episodes[*].durationSec` | `635` / `888` / `734` (the open movies' real lengths) | the real runtime of each final edit, in seconds |
| `episodes[0].title` | `"Episode 1 - The World Dungeon"` | the real episode title |
| `episodes[1].title` | `"Episode 2 - The Meat District"` | the real episode title |
| `episodes[2].title` | `"Episode 3 - Descent"` | the real episode title |
| `links.discord` | `"https://discord.gg/9ezX89epYD"` | filled (2026-09-25); tiktok, bluesky, instagram too |
| `links.youtube` | `"https://www.youtube.com/@DungeonCrawlCast"` | confirm this is the real channel URL |
| `links.tiktok` / `links.bluesky` / `links.instagram` | filled (2026-09-25) | - |
| `trailerYoutubeId` | **absent** - the home page falls back to the newest episode's embed | the trailer's video id, once a trailer is cut |
| `episodes[*].premiereAt` / `hubLiveAt` | sample dates in August and September 2026, two days apart | the real premiere, and the premiere + 48 h hub unlock |
| `episodes[*].summary` | one invented spoiler-safe line each | the real one-sentence summary |

**`public/data/crawlers.json`** ships its own fill-in list in a top-level `"todo"` array, and
**The front door → Author to fill** above reproduces it in order, together with the three things
that live outside the data files (the domain, the Plausible site, and pointing every social bio at
`/community`). Nothing in that file renders the word "TODO", and nothing says "coming soon": an
unwritten `concept` or `pockets` is empty, and the page renders nothing for it (011 revision 2).

The three sample videos are the Blender Foundation's open movies: public, embeddable, and each a
different video so switching episodes is visibly a fresh broadcast. Each `durationSec` is that
video's real length and the sample events are spread across it. Change ids and durations together.

**Crawler portraits** - all five are real, cut from the author's renders:

- `public/img/crawlers/{harry,mimi,ronald,xo,veil}.png` - 192×192 head-and-shoulders busts, cropped
  from the full render at a matching scale (the raised hands of Ronald and Veil stay in frame).
- `public/img/crawlers/{id}-art.png` - the full-figure transparent render, 820-900 px tall, under
  350 kB each; shown in the full record and on the crawler pages.

Keep the filenames, or update each crawler's `portrait` path in every `ep{N}.json`. The rail
renders them at 40 px (32 px on a phone), so square art crops best; keep a bust under 40 kB.

**Crawler full-figure art** - the record's art column. Only the two rendered crawlers have any:

- `public/img/crawlers/mimi-art.png` (Mimi Rivers - **real**, 830×1200)
- `public/img/crawlers/ronald-art.png` (Ronald "Madio" Hudson - **real**, 830×1200)

their bust - which is the intended default, and keeps the fallback path exercised. A crawler's
`art` field names one of these files. Real art may be any aspect ratio - the column contains it
rather than cropping it. Keep art under 250 kB so the Lighthouse budget holds.

Both real images were produced from the 2896×4185 renders in `character-portraits/` with macOS
`sips` and no new dependencies: `sips -Z 1200` for the art, `sips -c <h> <w> --cropOffset <top>
<left>` then `-Z 192` for the bust, each re-exported as JPEG quality 82 to fit the budgets.

**Entity portraits** - two of the eight entities have one; the rest fall back to a kind-tinted
initial disc, which is the intended default:

- `public/img/npcs/the-hoarder.svg` (The Hoarder - boss)
- `public/img/npcs/grull-rep.svg` (Grull Industries Representative - vendor)

Same rule as the crawler busts: keep the filenames or update each entity's `portrait` path in
`public/data/npcs.json`. They render at 32 px in the strip and 48 px in the record, so square art
crops best.

**`public/data/npcs.json`** - all eight entities are invented, written to cover the three kinds
and the sample episodes, and every line of them is placeholder copy:

| Entity | Kind | Filed under |
|--------|------|-------------|
| The Hoarder | boss | Episode 1 (defeated there; amended again in episode 2) |
| Grull Industries Representative | vendor | Episode 1 (returns in episode 2) |
| Quartermaster Vel | ally | Episode 1 |
| Mother of Pipes | boss | Episode 2 (defeated there) |
| The Signal Choir | ally | Episode 2 |
| The Tollkeeper | boss | Episode 3 (defeated there) |
| The Lamplighter | ally | Episode 3 |
| Ghaza Provisioner | vendor | Episode 3 |

`ep1.json` also carries one **deliberately unfiled** id, `the-listener-below` at 4:05: it proves
the feed still names an entity the registry has never heard of, and that the strip files nothing
for it. Keep a case like it if you replace the samples.

**Also placeholder**: `public/img/dcc-mark.svg` and `public/favicon.svg` (the circular "DC" mark),
and the event logs in `public/data/ep1.json`, `ep2.json`, `ep3.json` - 63 / 53 / 53 invented
events, written to exercise every event type. Regenerate them from real sheets with `sheet-to-json`.

---

## Build pipeline

`npm run build` is three commands (see `package.json`):

1. **`vite build`** - the client bundle into `dist/`.
2. **`vite build --ssr src/entry-server.tsx --outDir dist/server`** - the same app, built for
   Node, used only at build time.
3. **`node scripts/postbuild.mjs`** - the orchestrator, in this order:
   1. copies `dist/index.html` to `dist/404.html` **first**, while it is still the empty shell, so
      a hub deep link (`/ep/3`, `/codex`) served by a static host boots into an empty app rather
      than into some other page's markup;
   2. `scripts/build-status.ts` (via `tsx`) - runs the hub reducer to the end of the newest
      episode whose `hubLiveAt` is past, and writes `dist/data/status.json`, together with the
      `appearances` map (which crawler is named by which published episode), which no page
      renders today but which costs the build nothing to keep;
   3. `scripts/prerender.mjs` - renders `/`, `/watch`, `/crawlers`, `/community` and
      `/crawlers/{id}` with the SSR bundle, and writes `dist/<route>/index.html` with the route's
      head tags in `<head>` and the data it was rendered from in a
      `<script id="__DCC__" type="application/json">`, so the browser hydrates without a fetch.
      Each injected head tag carries `data-dcc-head`, and the browser strips those at boot
      (`clearPrerenderedHead`) a moment before React renders the same values - React appends its
      hoistables rather than adopting the server's, and two `<title>`s is one too many;
   4. `scripts/og.mjs` - screenshots the `/_og/**` routes to `dist/og/*.png` (see below);
   5. `scripts/sitemap.mjs` - `sitemap.xml` and `robots.txt` from the prerenderer's own route list;
   6. deletes `dist/server`: it is a build tool, not a page.

Individual steps can be run by hand: `npm run build:status`, `node scripts/prerender.mjs`,
`node scripts/og.mjs`, `node scripts/sitemap.mjs` (each expects `dist/` to exist).

### Environment variables

| Variable | Default | What it does |
|---|---|---|
| `VITE_BASE` | `/` | deploy sub-path; the Pages workflow sets `/dcc-watch-hub/` |
| `VITE_SITE_URL` | `https://dungeoncrawlcast.com` | canonical origin for `<link rel=canonical>`, `og:url` and the sitemap |
| `VITE_PLAUSIBLE_DOMAIN` | unset | analytics site domain. **Unset means no analytics at all**: no script, no globals, no requests |
| `CHROME_PATH` | unset | where to find a Chrome for the OG renderer |

### OG images, and what happens without Chrome

`scripts/og.mjs` uses `puppeteer-core`, which deliberately **never downloads a browser**. It looks
for one at `CHROME_PATH`, then
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, then `/usr/bin/google-chrome`,
then `/usr/bin/chromium-browser`. It starts `vite preview` on a free port, loads
`/_og/crawler/{id}` and `/_og/episode/{id}`, and screenshots each at 1200x630 (device scale 1).

If no Chrome is found it prints a warning and exits 0 - the build still succeeds, just without
`dist/og/`. It also skips, with a warning, any route that does not render an element marked
`data-og-frame`, which is what the OG pages are identified by.

---

## Deploy

### GitHub Pages (the default)

One-time: repo **Settings → Pages → Source: "GitHub Actions"**.

Then every push to `main` runs `.github/workflows/deploy.yml`, which builds with `VITE_BASE=/`,
uploads `dist/`, and deploys it. The site is served from the custom domain
<https://dungeoncrawlcast.com/> (Settings -> Pages -> Custom domain). DNS at the registrar:
four `A` records on the apex pointing at `185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`, and a `CNAME` for `www` pointing at
`bastionfennell.github.io`. Once the DNS check passes, tick **Enforce HTTPS**. If the site ever
moves back to the project subpath, set `VITE_BASE=/dcc-watch-hub/` in the workflow.

### Netlify / Cloudflare Pages

Build command `npm run build`, publish directory `dist`, and **no** `VITE_BASE` (the base
defaults to `/`). `public/_redirects` sends anything with no file of its own to `/404.html` - the
empty shell, not the prerendered home page - which is how a hub deep link (`/ep/3`, `/codex`)
boots into an empty app; the prerendered marketing routes have real files and are served before
the rule applies. On GitHub Pages `dist/404.html` does the same job without a redirect file.

Any static host works - the build is HTML, one JS bundle, one CSS file, JSON and SVG.

---

## Performance

Measured on the production build (`npm run build`, Node 20.9.0):

| Asset | Raw | Gzipped |
|-------|-----|---------|
| `dist/assets/index-*.js` (the viewer's entry chunk) | 421.00 kB | **131.79 kB** |
| `dist/assets/index-*.css` | 79.04 kB | 13.11 kB |
| `dist/index.html` (prerendered `/`, markup and data included) | 13.29 kB | 4.02 kB |
| the front door's own chunks (`HomePage`, `WatchPage`, `CrawlersPage`, `CrawlerPage`, `CommunityPage`, `SiteLayout`, `HubHead`, `RosterCard`, `EpisodeRow`, …) | 0.5-4.6 kB each | lazy |

011 held the viewer's entry chunk to +1.3 kB over the pre-feature build (419.70 kB) while adding
five pages, a prerenderer and a head. That is the whole point of the split: `src/site/**` is lazy,
`src/data/roster.ts` carries the roster validators away from `validate.ts`, `src/site/meta.ts`
holds the dozen head strings the header needs so the other 2.9 kB of marketing prose stays in the
marketing chunk, and even the hub's own `<Seo>` (`src/site/HubHead.tsx`) is a lazy chunk, because
a hub page writes its head after boot anyway.

That is React 19 + react-router 7 + the whole app - v1 plus the v2 panels, dossier, floor map
and resume, plus the glance card, full record, deep links, share, the broadcast log and the
mobile pass, plus the NPC encounters and the Dungeon Codex - comfortably under the 150 kB
gzipped budget. Deep links and share cost ~1.9 kB gzipped of JS; the broadcast log cost 2.1 kB
gzipped of JS and 0.6 kB of CSS; the mobile pass (mini-player, tabs, bottom sheet) cost 2.2 kB
gzipped of JS and 0.8 kB of CSS; entities and the Codex (strip, record, NPCs tab, the
`/codex` page and the cross-episode index) cost 6.1 kB gzipped of JS and 2.0 kB of CSS -
the largest single feature since v2, and the only one that adds a page. None of the five
adds a dependency.

Lighthouse 11.7.1, desktop preset, against `npm run preview` with the real YouTube embed loading:
**performance 100, accessibility 100** on `/ep/1` and `/` (FCP 0.4 s, LCP 0.5 s, TBT 0 ms,
CLS 0). Details in `specs/002-watch-hub-v2/quickstart.md` → Results, re-measured for the crawler
record in `specs/003-crawler-record/quickstart.md` → Results, again for deep links in
`specs/004-deep-links/quickstart.md` → Results, and again with the broadcast log open in
`specs/005-episode-log/quickstart.md` → Results (**100 / 100** either side of the log's toggle,
and the log adds no scored audit of its own).

`/codex` was measured the same way for 007: **performance 100, accessibility 100,
best-practices 100** on the desktop preset (FCP 0.4 s, LCP 0.6 s, TBT 0 ms, CLS 0), and
**performance 98, accessibility 100** on the mobile preset (FCP 1.5 s, LCP 2.3 s, TBT 0 ms,
CLS 0). It fetches `show.json`, `npcs.json` and every episode file, and still paints in under half
a second on desktop, because those are four small JSON files behind one render. `/ep/1` re-scored
**performance 100, accessibility 100** with the Encountered strip and an entity record on the page.
axe-core 4.13 with every rule enabled finds **no violations** on the Encountered strip, the entity
record (rail and phone sheet), the NPCs tab, or `/codex` collapsed and expanded, at 1440 × 900
and 400 × 800. Details in `specs/007-npc-registry/quickstart.md` → Results.

008 revision 2 re-measured the record with its new explanation surface: Lighthouse 11.7.1
desktop scores `/ep/1` **accessibility 100**, and axe-core 4.13 with every rule enabled finds
**no violations** on Mimi's full record at 1440 × 900 with a hotbar tooltip open.

The **mobile** preset on the same build scores `/ep/1` **accessibility 100, performance 99**
(FCP 1.5 s, LCP 2.0 s, TBT 0 ms, CLS 0 - the mini-player's placeholder is what keeps that zero).
axe-core 4.13 with every rule enabled reports **no violations** on the phone page: on each of the
four tabs, with the mini-player docked, and with the glance sheet open, at 400 × 800 and at
844 × 390. Details in `specs/006-mobile-pass/quickstart.md` → Results.

A deep-linked page is the one exception worth knowing about. `/ep/1?t=156` audits
**accessibility 100, performance 79**: the seek starts the embed, and the YouTube player's own
iframe paints and un-paints a 984×553 layer while it does, which Chrome bills to us as
CLS 0.482. It is entirely sub-frame - our own document measures CLS 0 there (`is_main_frame:
false` in the trace; see the 004 Results) - and there is no CSS on our side that can reserve
space inside someone else's iframe. Two zero-weight accessibility audits are also worth
recording rather than hiding: `label-content-name-mismatch` on the feed's seek buttons
(a 003 surface a deep link is simply the first thing to show at first paint - the visible
category word, "Achievement", is not part of the row's accessible name), and axe's WCAG 2.2
`target-size` on the 6×11 px timeline markers (a 002 surface). Neither is scored by Lighthouse;
both are listed in `specs/004-deep-links/quickstart.md` → Results with the fix each would need.

The budget holds because of three rules: no webfonts (`system-ui` stack only, nothing blocks
first render), no render-blocking scripts (the bundle is a `type="module"` script, deferred by
default), and the YouTube IFrame API is injected at runtime by `YouTubeTimeSource` - so the
archive page requests zero third-party bytes.

---

### The front door (011)

Lighthouse 11.7.1 **mobile** preset on `/` against `npm run preview`, and axe-core 4.13 on all
five marketing routes at 375 x 667 and 1440 x 900:

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| default (simulated throttling) | 87 | 100 | 100 | 100 |
| `--throttling-method=devtools` | **98** | 100 | 100 | 100 |

The two rows differ on one metric. Lighthouse's default mode loads the page unthrottled and then
*simulates* a slow 4G phone from the trace; that simulation puts LCP at 4.1 s. Every direct
measurement of the same page disagrees: 1.5 s under real DevTools throttling, 0.34 s observed in
Lighthouse's own run, and 0.67 s from a `PerformanceObserver` on an emulated slow-4G + 4x-CPU
phone. The gap is bandwidth contention in the model - the LCP element is the hero's YouTube still,
and it shares a simulated 1.6 Mbps with the 132 kB entry bundle and 283 kB of roster art. Two
things would close it for real: re-encoding the five 192 x 192 crawler busts (55 kB of PNG each,
where a JPEG is under 10 kB), and a marketing-only JS entry so the front door does not download the
hub. Both are follow-ups, not v1 work.

What the front door did fix, measured: `<link rel="preconnect">` to `i.ytimg.com` and a
`<link rel="preload" as="image" fetchpriority="high">` for the hero still in the prerendered head
(FCP 3.0 s → 1.5 s), `width`/`height` and `fetchpriority="low"` on the roster art (CLS 0.68 → 0),
and a unique `aria-label` on the footer nav (axe's `landmark-unique`, the one violation found).

axe-core 4.13 with every rule enabled: **0 violations** on `/`, `/watch`, `/crawlers`,
`/crawlers/ronald` and `/community`, at both widths. No horizontal scroll at 375 px on any of
them, the hero CTAs sit 254 px down on `/` (well inside the first 667 px), and the roster is
2 columns at 375 px and 5 across at 1440 px.

---

## Specs and rules

Read in this order:

1. `.specify/memory/constitution.md` - the six non-negotiable principles. Time-truth, the
   host-agnostic playback seam, ambient/diegetic UI, static dependency-light delivery, scope
   discipline, and the author-friendly data pipeline.
2. `dcc-watch-hub-spec.md` - the author's handoff spec: concept, schemas, components, the visual
   language (§6) and the v1 acceptance checklist (§7).
3. `specs/001-watch-hub-v1/` - `spec.md` (requirements and success criteria), `plan.md`,
   `research.md` (the decisions and what was rejected), `data-model.md`, `contracts/`,
   `quickstart.md` (run + manual acceptance walkthrough + results), `tasks.md`.
4. `specs/002-watch-hub-v2/` - dossiers, the expanded map, resume and rank sparklines. Same
   layout, plus `contracts/panels.md` and `contracts/resume-storage.md`.
5. `specs/003-crawler-record/` - the rail's glance card and the modal full record. Same layout,
   plus `contracts/dialog.md`.
6. `specs/004-deep-links/` - `?t=` deep links and "Share this moment". Same layout, plus
   `contracts/deep-link.md`.
7. `specs/005-episode-log/` - the broadcast log under the rail, its filters, follow control and
   open-state preference. Same layout, plus `contracts/log.md`.
8. `specs/006-mobile-pass/` - the phone composition: the docked mini-player, the four tabs and
   the bottom sheets, all under the existing 900 px breakpoint.
9. `specs/007-npc-registry/` - the active feature: `npc` events, the Encountered strip and the
   entity record on the episode page, and the Dungeon Codex at `/codex`. Same layout, plus
   `contracts/npc.md` and `contracts/npcs.schema.json`.
10. `specs/010-studio/` - the Studio, the author's event editor at `/studio` (see "The Studio"
    above). Constitution 1.3.0 adds Principle VII for it: isolated lazy chunk, the same
    `reduceTo` the viewer uses, local-only storage under `dcc.studio.`, and transport control
    through an extension of `TimeSource`.

Three rules bite most often while editing:

- **Every user-facing string lives in `src/copy.ts`**, in the System's voice. "Dashboard",
  "Home", "Ads" and friends are defects - the archive is a *broadcast archive*, ads are
  *sponsors*, episodes are *recap episodes*. The one exception is the Studio: it is a tool, not a
  broadcast, so its strings live in `src/studio/copy.ts` in plain functional English.
- **Nothing may reference the YouTube API outside `src/playback/YouTubeTimeSource.ts` and
  `src/playback/loadYouTubeApi.ts`.** Lint fails the build if it does.
- **No new runtime dependencies, no webfonts, no audio.**

---

## Scope fence - v1 + v2 is exactly what is here

Parked, from the handoff spec §8 and constitution 1.1.0. Do not build, stub, or partially wire
these - not even "for later". In particular, do not *tease* them: no hover affordances, pointer
cursors, or tooltips on elements that do nothing. The interactive triggers are exactly: crawler
frames (dossier), the minimap badge (floor map), the timeline, the resume card's two buttons,
every feed row (seek, 003), the share controls in the caption row and on each feed row (004),
the broadcast log's own bar, filter chips, Clear, rows and follow control (005), the phone tab
strip (006), and the Encountered chips, the entity record's moments and registry link, and the
registry page's search, kind chips, entry disclosures and appearance links (007).

**Shipped in v2** (the four items below left the fence; see "Lean-forward (v2)" above)

- Click-open character sheets (inventory / skills / hot list history)
- Interactive minimap with pan and labels
- `localStorage` resume
- Per-crawler fame/rank sparklines

**Still parked**

- Stinger sounds (opt-in) - needs real audio
- Roster page with commissioned art - needs real art

**v3**

- Self-hosted or alternate video sources (new `TimeSource` implementations)
- Live premiere sync
- Sponsor slot management
- Accounts

v1 and v2 also explicitly exclude comments and any server-side anything. The `TimeSource` seam exists
so v3 costs one new adapter and a factory change - that is the only forward accommodation the
codebase makes.

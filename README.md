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
npm run dev            # http://localhost:5173/
npm run dev -- --open  # opens the archive
```

- Archive: <http://localhost:5173/>
- Episode with the real embed: <http://localhost:5173/ep/1>
- Episode with the dev scrubber, no network: <http://localhost:5173/ep/1?fake=1>

### Verify

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # vitest run  (184 tests)
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

### Layout of the source

| Path | What lives there |
|------|------------------|
| `src/engine/` | reducer, selectors, time formatting — pure, framework-free |
| `src/data/` | schema types, guards/normalization, fetching, show ordering |
| `src/playback/` | `TimeSource` interface, YouTube adapter, fake, `usePlayhead` |
| `src/components/` | stage, party rail, event feed, timeline, toast, minimap, header |
| `src/pages/` | `EpisodePage`, `HubPage`, `NotFoundPage` |
| `src/copy.ts` | **every** user-facing string, in the System's voice |
| `src/styles/tokens.css` | the colour/spacing/type tokens from spec §6 |
| `public/data/` | `show.json` + `ep{N}.json` (static, fetched at load) |
| `scripts/sheet-to-json.ts` | editor CSV → `ep{N}.json` converter |

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
| `note` | text | – | – |

Convert:

```sh
npm run sheet-to-json -- path/to/ep4.csv \
  --episode 4 --duration 5400 \
  --initial-state scripts/samples/ep1.initial.json \
  --out public/data/ep4.json
```

`--initial-state` is a JSON file holding the episode's `initialState` (party, `partyRank`, map).
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
| `episodes[0].youtubeId` (Episode 1) | `"M7lc1UVf-VE"` | the real YouTube video id |
| `episodes[1].youtubeId` (Episode 2) | `"M7lc1UVf-VE"` | the real YouTube video id |
| `episodes[2].youtubeId` (Episode 3) | `"M7lc1UVf-VE"` | the real YouTube video id |
| `episodes[*].durationSec` | `240` (all three) | the real runtime of each final edit, in seconds |
| `episodes[0].title` | `"Episode 1 — The World Dungeon"` | the real episode title |
| `episodes[1].title` | `"Episode 2 — The Meat District"` | the real episode title |
| `episodes[2].title` | `"Episode 3 — Descent"` | the real episode title |
| `links.discord` | `"https://discord.gg/REPLACE_ME"` | the real invite |
| `links.youtube` | `"https://www.youtube.com/@DungeonCrawlCast"` | confirm this is the real channel URL |

`M7lc1UVf-VE` is the video Google itself uses in the IFrame API docs; `durationSec: 240` matches
it so every sample event fires while it plays. Change the ids and the durations together.

**Crawler portraits** — all five are generated monochrome SVG busts, not art:

- `public/img/crawlers/stuntman.svg` (The Stuntman)
- `public/img/crawlers/psychic.svg` (The Psychic)
- `public/img/crawlers/harry.svg` (Harry)
- `public/img/crawlers/xo.svg` (X.O.)
- `public/img/crawlers/actress.svg` (The Actress)

Keep the filenames, or update each crawler's `portrait` path in every `ep{N}.json`. The rail
renders them at 40 px (32 px on a phone), so square art crops best.

**Also placeholder**: `public/img/dcc-mark.svg` and `public/favicon.svg` (the circular "DC" mark),
and the event logs in `public/data/ep1.json`, `ep2.json`, `ep3.json` — 31 invented events each,
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
| `dist/assets/index-*.js` | 299.0 kB | **95.1 kB** |
| `dist/assets/index-*.css` | 17.9 kB | 4.2 kB |
| `dist/index.html` | 0.7 kB | 0.4 kB |

That is React 19 + react-router 7 + the whole app, comfortably under the 150 kB gzipped budget.

Lighthouse 11.7.1, desktop preset, against `npm run preview` with the real YouTube embed loading:
**performance 100, accessibility 100** on both `/ep/1` and `/` (FCP 0.4 s, LCP 0.4 s, TBT 0 ms,
CLS 0). Details in `specs/001-watch-hub-v1/quickstart.md` → Results.

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

Three rules bite most often while editing:

- **Every user-facing string lives in `src/copy.ts`**, in the System's voice. "Dashboard",
  "Home", "Ads" and friends are defects — the archive is a *broadcast archive*, ads are
  *sponsors*, episodes are *recap episodes*.
- **Nothing may reference the YouTube API outside `src/playback/YouTubeTimeSource.ts` and
  `src/playback/loadYouTubeApi.ts`.** Lint fails the build if it does.
- **No new runtime dependencies, no webfonts, no audio.**

---

## Scope fence — v1 is exactly what is here

Parked, from the handoff spec §8. Do not build, stub, or partially wire these in v1 — not even
"for later". In particular, do not *tease* them: no hover affordances, pointer cursors, or
tooltips on elements that do nothing yet. Clicking a crawler frame is deliberately a no-op with
a default cursor, and the minimap is deliberately inert.

**v2**

- Click-open character sheets (inventory / skills / hot list history)
- Interactive minimap with pan and labels
- `localStorage` resume
- Stinger sounds (opt-in)
- Roster page with commissioned art
- Per-crawler fame/rank sparklines

**v3**

- Self-hosted or alternate video sources (new `TimeSource` implementations)
- Live premiere sync
- Sponsor slot management
- Accounts

v1 also explicitly excludes comments and any server-side anything. The `TimeSource` seam exists
so v3 costs one new adapter and a factory change — that is the only forward accommodation the
codebase makes.

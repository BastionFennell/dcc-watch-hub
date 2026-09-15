# Research: DCC Watch Hub v1

All Technical Context unknowns from plan.md resolved. Format: Decision / Rationale / Alternatives.

## R1. Toolchain versions on Node 20.9.0

- **Decision**: Vite 6.x, `@vitejs/plugin-react` 4.x, Vitest 3.x, React 19, react-router 7.x,
  TypeScript 5.x, tsx 4.x. Pin Node via `.tool-versions` (`nodejs 20.9.0`, already installed
  through asdf on the author's machine) and `"engines": { "node": ">=20.9 <21 || >=22" }`.
- **Rationale**: `npm view` on 2026-09-14: Vite 7 and plugin-react 5 require Node `^20.19 ||
  >=22.12`; Vite 6 / Vitest 3 / react-router 7 accept `^20.0.0`. Upgrading Node is the author's
  call, not the build's.
- **Alternatives**: Vite 7 (needs newer Node); Preact (smaller, but React 19 + tree-shaking is
  already well under budget and the spec allows either; React keeps `@testing-library/react`
  friction-free).

## R2. Router and static-host deep links

- **Decision**: `react-router` 7 in declarative mode (`BrowserRouter`, `Routes`, `Route`,
  `useParams`, `Link`) with `basename={import.meta.env.BASE_URL}`. Vite `base` comes from
  `VITE_BASE` env (default `/`; the Pages workflow sets `/dcc-watch-hub/`). Post-build script
  copies `dist/index.html` to `dist/404.html` (GitHub Pages fallback); `public/_redirects`
  contains `/* /index.html 200` for Netlify/Cloudflare.
- **Rationale**: Spec fixes routes `/` and `/ep/:id`. GitHub Pages has no rewrite rules; the
  404.html copy is the standard workaround and costs nothing. Declarative mode avoids the data
  router's loader machinery, which the two-fetch app does not need.
- **Alternatives**: `HashRouter` (works everywhere but `#/ep/3` contradicts the spec's URL shape);
  pre-rendering one HTML per episode (adds a build step for no v1 benefit).

## R3. Data URL resolution

- **Decision**: `show.json` keeps `dataUrl: "/data/ep1.json"` exactly as the handoff schema
  shows. The loader resolves any leading-slash URL against `import.meta.env.BASE_URL`
  (`joinBase(base, url)`), so the same data works at `/` and at `/dcc-watch-hub/`.
- **Rationale**: Editors should not have to know the deploy path; the schema stays as specified.
- **Alternatives**: Relative `dataUrl` (fragile against nested routes); env-specific data files (duplication).

## R4. YouTube IFrame Player API adapter

- **Decision**: `loadYouTubeApi()` injects `https://www.youtube.com/iframe_api` once and resolves
  a promise when `window.onYouTubeIframeAPIReady` fires (chaining any pre-existing callback).
  `YouTubeTimeSource` constructs `new YT.Player(el, { videoId, playerVars: { playsinline: 1,
  rel: 0, modestbranding: 1, origin: location.origin }, events })`. On `PLAYING` it starts a
  250 ms `setInterval` calling `getCurrentTime()` and emitting `onTick`; on `PAUSED`/`BUFFERING`
  it stops polling but emits one tick (so a paused scrub still updates the overlay); on `ENDED`
  it emits `onEnded`. `seek(t)` calls `seekTo(t, true)` then emits a tick with `t` immediately.
  `destroy()` clears the interval and calls `player.destroy()`.
- **Rationale**: Spec §3.1. Emitting a tick on pause handles the "scrub while paused" case that
  pure polling-while-playing would miss. Ads pause content time in `getCurrentTime()`, so no
  extra handling is needed. Types come from `@types/youtube` (global `YT` namespace).
- **Alternatives**: `postMessage` protocol directly (undocumented, brittle); `react-youtube`
  wrapper (extra runtime dep; hides the player instance we need).

## R5. Reducer, animation triggers, and toast queue without imperative state

- **Decision**: Every visual trigger is a function of playhead `t` and the elapsed events:
  - HP bar: CSS `transition: width 400ms` on the fill; React re-render with the new width animates it.
  - Danger: `hp.current / hp.max < 0.25` → `data-danger` attribute → persistent danger border plus
    a 600 ms keyframe flash that runs when the attribute is added.
  - Level-up pulse: selector `levelUpPulse(events, t, actor)` is true when a `level_up` for that
    actor has `t_e <= t < t_e + 1.2`. Seeking backward and forward naturally re-triggers it.
  - Achievement toast: for elapsed achievements in time order, `start_i = max(t_i, end_{i-1})`,
    `end_i = start_i + 6`; the active toast is the one with `start <= t < end`. This is the FIFO
    queue expressed as a pure function, so it is scrub-safe.
  - Active sponsor: latest sponsor event with `t_e <= t < t_e + durationSec`.
- **Rationale**: Principle I forbids imperative timers that can drift from the playhead. The
  selectors are trivially testable.
- **Alternatives**: `useEffect` timers keyed on event ids (breaks on backward seek; needs cleanup logic).

## R6. Tick cadence and recompute cost

- **Decision**: 250 ms polling; `reduceTo(episode, t)` filters and folds the whole event array on
  every tick. No memoization.
- **Rationale**: Spec §3.2 says do not optimize. ~500 events × 4 Hz is microseconds of work.
- **Alternatives**: Incremental apply with rollback on seek (explicitly rejected by the spec).

## R7. Styling and fonts

- **Decision**: CSS Modules per component, `tokens.css` with custom properties for every color in
  spec §6 and the wireframe's marker/label colors. Font stack:
  `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; System boxes use
  `ui-monospace, SFMono-Regular, Menlo, monospace` for the accent label, letter-spaced caps.
  No `@font-face`, no font CDN.
- **Rationale**: Principle IV (no blocking fonts, no UI framework); Lighthouse ≥ 90.
- **Alternatives**: Tailwind (framework-ish and unnecessary for ~12 components); a webfont
  (blocks render or FOUT; nothing in the brief requires one).

## R8. Icons

- **Decision**: Five inline SVG icons (broadcast, map, package/loot, trophy/rank, play) as tiny
  React components in `src/components/icons.tsx`. No icon font or icon package.
- **Rationale**: The wireframe uses Tabler icon classes (`ti ti-*`); shipping the font would add
  a blocking request and a dependency for five glyphs.

## R9. Runtime validation of JSON

- **Decision**: Hand-written type guards in `src/data/validate.ts` (`isShow`, `isEpisodeData`,
  `normalizeEvent`) shared by the app and the converter. `contracts/*.schema.json` are the formal
  contract; a Vitest test validates the sample JSON files against them with `ajv` (dev-only).
- **Rationale**: Zero runtime dependency for validation; the schemas still exist for editors and
  tests. Unknown event types pass through `normalizeEvent` as `{ type: 'unknown', raw }` so the
  reducer and selectors can ignore them (FR-006).
- **Alternatives**: zod at runtime (a dependency for a two-file schema); no schemas at all (loses
  the editor-facing contract).

## R10. CSV parsing in the converter

- **Decision**: `csv-parse/sync` (dev dependency; only the script imports it), columns
  `timecode,type,actor,field1,field2,field3`, header row required, `hh:mm:ss` or `mm:ss`
  timecodes. Run with `npm run sheet-to-json -- <csv> --episode <id> --duration <sec>
  --party <ids,comma,separated | path/to/initialState.json> --out public/data/ep<id>.json`.
  Warnings go to stderr with `WARN row N:`; errors `ERROR row N:` and exit 1 without writing.
- **Rationale**: Editors' descriptions contain commas and quotes; a hand-rolled parser is the
  classic source of silent data corruption. `csv-parse` has no dependencies.
- **Alternatives**: Hand-rolled split (rejected above); a full CLI framework (overkill).

## R11. Sample data and placeholder media

- **Decision**: Three sample episodes (ep1, ep2 on Floor 1; ep3 on Floor 2) with the five
  wireframe crawlers (`stuntman`, `psychic`, `harry`, `xo`, `actress`). All use YouTube's own
  IFrame API demo video id `M7lc1UVf-VE` with `durationSec` set to 240 and events spaced within
  the first four minutes so every event type fires while the demo video plays. Portraits are
  generated monochrome SVG busts under `public/img/crawlers/`. `show.json` `links` point to the
  Dungeon Crawl Cast channel placeholders the author must replace. A README section lists every
  placeholder.
- **Rationale**: FR-062 requires runnable sample data; real episodes do not exist yet. Using a
  video Google itself uses for embed demos avoids guessing at third-party content.
- **Alternatives**: Leave ids blank (page cannot be exercised); pick an arbitrary popular video
  (rights/embeddability uncertainty).

## R12. Testing strategy

- **Decision**: Vitest with two environments via `// @vitest-environment jsdom` on component
  tests; node default for engine/script tests. Coverage targets are behavioral, not
  percentage-based:
  - `reducer.test.ts`: each event type; unknown type ignored; unknown actor tolerated; clamp.
  - `selectors.test.ts`: t=0, mid, backward, forward; never-early invariant checked at
    `t = e.t - 0.001` for every event in the fixture; toast FIFO math; active sponsor; markers.
  - `show.test.ts`: ordering, prev/next at ends, by-floor grouping.
  - `EpisodePage.test.tsx`: mounts the page with `FakeTimeSource` and stubbed fetch, drives
    `set(t)`, asserts rail/feed/toast/ended card. This covers SC-002/003/004/006 without a browser.
  - `sheet-to-json.test.ts`: sample CSV → schema-valid JSON; broken CSV → warning naming row.
  - `samples.test.ts`: `public/data/*.json` validate against `contracts/*.schema.json` via ajv.
  - Lighthouse and cross-browser are manual steps in quickstart.md.
- **Rationale**: Principle I mandates engine tests; the fake TimeSource makes the whole page
  testable headlessly. Playwright is deferred: it would need Chrome in CI and a real embed.
- **Alternatives**: Playwright e2e against the YouTube embed (flaky, network-bound, slow).

## R13. CI and deploy

- **Decision**: `.github/workflows/ci.yml` on push/PR: `npm ci`, `typecheck`, `lint`, `test`,
  `build`. `.github/workflows/deploy.yml` on push to `main`: build with
  `VITE_BASE=/dcc-watch-hub/`, upload `dist`, `actions/deploy-pages`. Requires the repo's Pages
  source set to "GitHub Actions" (one-time setting, documented in quickstart).
- **Rationale**: The repo is on GitHub and the spec names GitHub Pages first.
- **Alternatives**: Netlify/Cloudflare (supported by `_redirects`, no workflow needed).

## R14. Dev-only fake stage

- **Decision**: In `import.meta.env.DEV` only, `?fake=1` on an episode URL swaps
  `YouTubeStage` for `FakeStage`: a black 16:9 box with a range input and play/pause driving a
  `FakeTimeSource` at 1× speed. Production builds tree-shake it (guarded by `import.meta.env.DEV`).
- **Rationale**: Principle II requires a fake that drives the full page; it also lets the author
  scrub through sample events without a network. Not a product feature, so no Scope violation.

# Quickstart: DCC Watch Hub v1

## Prerequisites

- Node 20.9.0 (`.tool-versions`; `asdf install` if missing). Vite 7 is intentionally not used
  because it needs Node ≥ 20.19.
- npm 10 (bundled with Node 20).

## Run

```sh
npm install
npm run dev            # http://localhost:5173/
npm run dev -- --open  # opens the hub
```

Episode page with the real embed: `http://localhost:5173/ep/1`  
Episode page with the dev scrubber (no network): `http://localhost:5173/ep/1?fake=1`

## Verify

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # vitest run
npm run build          # vite build + copies dist/index.html → dist/404.html
npm run preview        # serves dist/ at http://localhost:4173/
```

## Authoring pipeline

```sh
npm run sheet-to-json -- scripts/samples/ep1.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/ep1.json
npm run sheet-to-json -- scripts/samples/ep1-broken.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/ep1-broken.json   # prints WARN lines, exit 0
npm run sheet-to-json -- scripts/samples/ep1-error.csv --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json --out /tmp/never.json        # prints ERROR, exit 1
```

## Manual acceptance walkthrough (spec §7)

1. `npm run build && npm run preview`, open `/ep/1`. Network tab shows only `show.json`,
   `ep1.json`, the bundle, portraits, and YouTube's own requests. ✔ SC-001
2. At 0:00 the rail shows initial HP/level, feed empty. Play to ~1:00, pause: feed shows events
   ≤ 1:00 only. Seek back to 0:20: feed and rail shrink accordingly. Seek to 3:30: everything
   catches up. Reload: back to 0:00 and consistent. ✔ SC-002
3. Step through events with `?fake=1` and the scrubber; nothing appears before its time. ✔ SC-003
4. Any seek updates the rail within half a second. ✔ SC-004
5. Hover each timeline marker (tooltip), click one: video seeks there. ✔ SC-005
6. Let the video end: "Next recap episode →" card appears and navigates to `/ep/2`. On `/ep/3`
   (last) the card returns to the archive. Header arrows hidden at ep1 (prev) and ep3 (next). ✔ SC-006
7. Open `/`: episodes grouped under Floor 1 and Floor 2. ✔ SC-007
8. Chrome, Firefox, Safari desktop; then DevTools device toolbar at 400 px: stage → timeline →
   rail → feed stacked, no horizontal scroll. ✔ SC-008
9. Run the three converter commands above. ✔ SC-009
10. Lighthouse (Chrome DevTools, Navigation, Desktop) on `/ep/1` from `npm run preview`:
    Performance ≥ 90. ✔ SC-010
11. Read every visible string: no "Dashboard/Home/Ads". ✔ SC-011

## Deploy (GitHub Pages)

One-time: repo Settings → Pages → Source: **GitHub Actions**.  
Then every push to `main` runs `.github/workflows/deploy.yml`, which builds with
`VITE_BASE=/dcc-watch-hub/` and publishes `dist/`. Site: `https://bastionfennell.github.io/dcc-watch-hub/`.

Netlify / Cloudflare Pages: build command `npm run build`, publish dir `dist`, no `VITE_BASE`
(defaults to `/`). `public/_redirects` handles deep links.

## Replacing sample data

Edit `public/data/show.json` (real `youtubeId`, `durationSec`, titles, links), replace
`public/img/crawlers/*.svg` with real busts (same filenames or update `portrait`), and generate
each `public/data/ep{N}.json` from the editor's CSV. No code changes.

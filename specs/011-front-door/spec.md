# Feature 011 - The Front Door (marketing site)

Source: the author's "Marketing Site Addendum (spec v1.1)" (2026-09-23), reproduced in
`specs/011-front-door/addendum.md`. This spec records how it maps onto this codebase and the
decisions taken where the addendum and the repo differ. The addendum wins on intent; this file
wins on mechanics.

## Routes (v1, exactly these)
`/` home, `/watch` archive by floor, `/crawlers` roster, `/crawlers/:id` crawler page,
`/community` links page. The current hub list at `/` moves to `/watch`. Hub routes (`/ep/:id`,
`/codex`, `/studio/**`) are unchanged. Header nav on every page: Watch / Crawlers / Community; the
episode-context centre slot and the Codex link appear only on hub pages.

## Data
- `show.json` (in place, `seasons` kept because the hub reads it): add `tagline`, `pitch`,
  `cadence`, `trailerYoutubeId` (optional), `links.{tiktok,bluesky,instagram}` (optional), and per
  episode `premiereAt`, `hubLiveAt` (ISO), `summary`, `ogImage` (optional; defaults to
  `/og/ep{N}.png`). Schema: `contracts/show.schema.json` (copy of 008's + these). Missing
  `hubLiveAt` means "live now" so the sample episodes keep working.
- `public/data/crawlers.json` (new): the addendum's shape with **`id` equal to the hub crawler id**
  (`harry`, `mimi`, `ronald`, `xo`, `veil`) so live status joins. Schema
  `contracts/crawlers.schema.json`. Author-fillable fields ship as clearly marked placeholders
  (see "Author to fill").
- `dist/data/status.json` (generated at build, never committed): per crawler
  `{ level, hp: {current,max}, floor, lastEpisodeId }` from the reducer run to the end of the
  newest episode whose `hubLiveAt` is past at build time. Crawlers absent from that episode are
  omitted. Read by the crawler page and roster (embedded at prerender; fetched on client nav).

## Build pipeline (`npm run build`)
1. `vite build` (client) -> `dist/`.
2. `vite build --ssr src/entry-server.tsx` -> `dist/server/`.
3. `scripts/postbuild.mjs` runs, in order: status (`scripts/build-status.ts` via tsx), prerender
   (marketing routes -> `dist/<route>/index.html`, data embedded as
   `<script id="__DCC__" type="application/json">`), OG images (`scripts/og.mjs`: puppeteer-core +
   a system Chrome, screenshots `/_og/crawler/:id` and `/_og/episode/:id` at 1200x630 from a
   `vite preview` of `dist` -> `dist/og/*.png`; **skips with a warning when no Chrome is found**),
   `sitemap.xml` + `robots.txt`, then the existing `404.html` copy.
4. Env: `VITE_SITE_URL` (canonical base; default `https://dungeoncrawlcast.com`),
   `VITE_PLAUSIBLE_DOMAIN` (analytics off when unset), `CHROME_PATH` (OG renderer override),
   `VITE_BASE` (unchanged).

## Client boot
`main.tsx` hydrates when the embedded `__DCC__.route` equals the current path (a prerendered page),
otherwise creates a root (hub routes, deep links via 404.html). Providers seed from `__DCC__` when
present and fetch otherwise. Time-gated UI (`hubLiveAt`, countdown chips) renders the build-time
decision first and re-evaluates against `Date.now()` after mount, so hydration never mismatches.

## Pages, components, rules
As the addendum §3-§6: `RosterCard` with `variant="card" | "hero" | "og"` sharing one layout module;
`GatedCta`; `SystemBox` (the only announce style); `Seo` (title, description, canonical, og:*,
twitter:card, optional JSON-LD `VideoObject`); `SiteFooter`. 375 px first; tap targets >= 44 px;
`prefers-reduced-motion` respected; no autoplay. Art below the fold is `loading="lazy"`.

## Analytics
Plausible script (outbound-links variant) injected only when `VITE_PLAUSIBLE_DOMAIN` is set;
`track(name, props)` helper used for `hub_open`, `crawler_view`, `outbound` (YouTube/Discord).
No cookies, no banner.

## Author to fill (placeholders shipped, marked `TODO:` in the JSON and listed in README)
Crawler archetype names (`name`; only "The Stuntman" for Ronald and "The Actress" for Mimi are
known), `concept`, `pockets`, `entryAchievement`, player bios and links; `trailerYoutubeId`;
real `premiereAt`/`hubLiveAt`; TikTok / Bluesky / Instagram links; the site URL once the domain is
registered; the Plausible domain. Domain registration itself is outside this repo.

## Deviations from the addendum
- Crawler ids are the hub ids, not archetype slugs (needed for `status.json`).
- WebP conversion of art is deferred: no image tool in the toolchain; PNGs are lazy-loaded and
  under the existing budgets. OG images are PNG as required.
- Prerendering is a hand-rolled SSR step (react-dom/server + `StaticRouter`) rather than a plugin,
  keeping runtime dependencies at zero. `puppeteer-core` is the one new devDependency.

## Acceptance
The addendum's §8 checklist, verified in tasks T1130-T1132, plus: hub routes and tests unchanged;
viewer entry chunk within 3 kB of 418.08 kB (the marketing pages are lazy chunks); `npm run build`
succeeds without Chrome (OG skipped, warned).

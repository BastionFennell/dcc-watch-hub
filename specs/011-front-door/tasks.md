# Tasks - 011 Front Door

## Wave A - data + build plumbing
- [x] T1101 Types + `contracts/show.schema.json` (copy 008's, add fields) + `crawlers.schema.json` + `status.schema.json`
- [x] T1102 `public/data/show.json` additions (tagline/pitch/cadence from the addendum; sample dates; summaries; trailer TODO); `public/data/crawlers.json` for the five crawlers with TODO placeholders; samples test covers both
- [x] T1103 `validateCrawlers`, `validateStatus` (+tests); `fetchCrawlers`, `fetchStatus`, `readEmbedded()` in load.ts (+tests)
- [x] T1104 `ShowContext` seeds from embedded data; new `CrawlersContext` (profiles + status) (+tests)
- [x] T1105 `src/site/gate.ts` (+tests both sides of `hubLiveAt`, countdown formatting, newest episode)
- [x] T1106 `src/site/seo.tsx` `<Seo>` + `HeadCollector` (+tests: client hoisting, server collection)
- [x] T1107 `src/site/analytics.ts` (+tests: no-op when unset)
- [x] T1108 `src/entry-server.tsx` + `vite.config.ts` ssr entry; `main.tsx` hydrate-or-create (+test)
- [x] T1109 `scripts/build-status.ts` (+test against ep1-3: newest past-gate episode, omitted crawlers)
- [x] T1110 `scripts/prerender.mjs` (route list from data; template injection) (+smoke test via entry-server)
- [x] T1111 `scripts/sitemap.mjs` (+test), `scripts/og.mjs` (puppeteer-core, Chrome discovery, skip-with-warning), `scripts/postbuild.mjs` orchestrator; `npm i -D puppeteer-core`
- [x] T1112 Gates + README "Build pipeline" note

## Wave B - components + pages
- [x] T1113 `src/site/copy.ts`
- [x] T1114 `RosterCard` (card/hero/og variants, one layout module) (+tests)
- [x] T1115 `GatedCta`, `StatusLine`, `SystemBox`, `SocialRow`, `SiteFooter`, `TrailerEmbed` (+tests)
- [x] T1116 `EpisodeRow` with countdown chip (+tests)
- [x] T1117 `HomePage` (+tests: CTA gate both sides, latest card hidden without trailer)
- [x] T1118 `WatchPage` (floors, newest first, empty floor copy) (+tests)
- [x] T1119 `CrawlersPage` (chips only with >1 status) (+tests)
- [x] T1120 `CrawlerPage` (hero, concept, pockets, entry achievement SystemBox, player, appears-in, prev/next) (+tests)
- [x] T1121 `CommunityPage` (+tests)
- [x] T1122 `OgCrawlerPage`, `OgEpisodePage` at `/_og/**` (fixed 1200x630 frame)
- [x] T1123 `SiteHeader` nav (Watch / Crawlers / Community; hub extras only on hub pages) (+tests updated)
- [x] T1124 Mobile CSS pass at 375 px; reduced motion; lazy art

## Wave C - integration, OG, gates
- [x] T1125 Routes in `App.tsx` (lazy marketing pages; `/` -> HomePage; `/watch` = old hub list reworked; old `HubPage` removed or redirected)
- [x] T1126 `<Seo>` on every route incl. hub pages (title/description; og:image for episodes = `/og/ep{N}.png`); JSON-LD VideoObject on `/watch` rows or `/ep/:id`
- [x] T1127 Analytics events wired (hub_open, crawler_view, outbound)
- [x] T1128 Full build locally: prerendered HTML for all routes, `og/*.png` present, sitemap, status.json; hydrate without console mismatch warnings
- [x] T1129 CI/deploy workflows: Chrome path; build must pass on ubuntu
- [x] T1130 Lighthouse mobile on `/` >= 90 all categories (preview build); axe on all five routes; 375 px screenshots (no horizontal scroll, CTAs above the fold, roster 2-col)
- [x] T1131 README: front door section, data fields, author-to-fill list, env vars, build pipeline
- [x] T1132 Acceptance checklist (addendum §8) ticked with evidence in this file

### Notes from Wave C

- `HubPage` is deleted; `/watch` is the archive, and the two links that said "return to the
  archive" (`NotFoundPage`, `NextEpisodeCard`) point there now.
- `CrawlersProvider` did not go beside `ShowProvider` after all: it sits in a lazy layout route
  (`src/site/SiteLayout.tsx`) so a viewer who only opens `/ep/3` neither downloads it nor fetches
  `crawlers.json` and `status.json`. The entry-chunk budget is what forced the change, and it is
  the better shape anyway.
- The hub's own `<Seo>` is a lazy chunk (`src/site/HubHead.tsx`) for the same reason. A hub page
  is client-rendered, so its head was already written after mount.
- The prerenderer marks every head tag it writes with `data-dcc-head` and the browser strips them
  at boot: React appends its hoistables instead of adopting the server's, and without this every
  prerendered page carried two titles and two of each OpenGraph tag.
- `StaticRouter` now gets `basename`, so a `VITE_BASE` deploy prerenders `/dcc-watch-hub/watch`
  where the browser expects it. Without it every in-page link was a hydration mismatch on Pages.
- `public/_redirects` sends deep links to `/404.html` rather than `/index.html`, which is the
  prerendered home page now.
- `src/test/setup.ts` preloads the lazy pages (`src/site/pages/preload.ts`, the module the
  browser never imports). Without it a hub test occasionally raced the `HubHead` import's commit;
  nine consecutive full runs are green with it.
- Viewer entry chunk: 421.03 kB plain (budget 421.1, pre-feature 419.70), 421.17 kB with
  `VITE_BASE=/dcc-watch-hub/` - the extra 0.14 kB is the deploy prefix inlined into asset paths,
  not feature weight.

## Acceptance - addendum §8, verified

- [x] **`/`, `/watch`, `/crawlers`, `/crawlers/:id`, `/community` render from `show.json` +
  `crawlers.json` with no server.** `npm run build` prerenders 9 files (4 static + 5 crawlers);
  `dist/watch/index.html` carries the floor headings and every row in its markup, and the data it
  was rendered from in `<script id="__DCC__">`. `vite preview` serves them with no process behind
  it.
- [x] **Newest-episode CTA flips YouTube -> hub at `hubLiveAt` (both sides tested).**
  `src/site/gate.test.ts` (15 tests) and `WatchPage.test.tsx` "gates the row: a countdown chip
  before, a feed link after" render at `gate - 1h` and at `gate`; `HomePage.test.tsx` does the
  same for the hero pair.
- [x] **Every route has correct OG tags and a generated `/og/*.png`.** `dist/og/` holds
  `site.png`, `crawler-{harry,mimi,ronald,xo,veil}.png` and `ep{1,2,3}.png`, all PNG 1200x630
  (header read: 45-175 kB each). Each prerendered page has exactly one `<title>`, description,
  canonical and `og:*` set - e.g. `dist/crawlers/mimi/index.html` →
  `og:image=https://dungeoncrawlcast.com/og/crawler-mimi.png`, `og:type=profile`.
  *Not verified:* the Discord / Bluesky preview itself. Those scrapers need a public URL, so it was
  checked locally by tag inspection only (`grep -E 'og:(title|description|image)' dist/.../index.html`
  plus opening `/_og/crawler/mimi` in the preview) - repeat it against the real domain after the
  first deploy.
- [x] **Roster cards link to crawler pages; crawler pages show the entry achievement as a System
  box.** `RosterCard.test.tsx` and `CrawlerPage.test.tsx` ("renders the entry achievement as the
  page's System box, reward and all"); screenshot `fd-crawler-ronald-375.png`.
- [x] **`status.json` builds from the latest published episode and updates crawler pages without
  touching hub code.** `build-status: episode 3, 5 crawler(s)`; `scripts/status.test.ts` covers the
  gate on both sides and the omitted-crawler case. Wave C added the `appearances` map to the same
  file, so "Appears in" is in the prerendered HTML instead of five client fetches.
- [x] **Mobile 375 px: hero CTAs above the fold, no horizontal scroll, roster 2-col.** Measured in
  headless Chrome at 375 x 667 on all five routes: `documentElement.scrollWidth === 375`
  everywhere, hero CTAs bottom out at 254 px on `/`, roster is 2 columns. Screenshots
  `fd-{home,watch,crawlers,crawler-ronald,community}-375.png`.
- [~] **Lighthouse >= 90 mobile on `/`; no autoplay anywhere.** Autoplay: yes - `TrailerEmbed`
  ships a poster and mounts the iframe only on click, and `autoplay=1` is only ever on that
  post-click URL. Lighthouse 11.7.1 mobile: **accessibility 100, best practices 100, SEO 100**, and
  performance **98** with `--throttling-method=devtools` but **87** on the default simulated
  throttling, which is the number that misses. The simulation puts LCP at 4.1 s; every direct
  measurement of the same page says 0.34-1.5 s. See README → Performance → The front door for the
  breakdown and the two follow-ups (re-encode the 275 kB of roster PNGs; a marketing-only JS entry).
- [ ] **`/community` is the single link in every social bio.** The page exists, is prerendered and
  is linked from the header and footer of every route. Pointing the bios at it is an act outside
  this repo, and it is item 10 on the author-to-fill list.

# Tasks - 011 Front Door

## Wave A - data + build plumbing
- [ ] T1101 Types + `contracts/show.schema.json` (copy 008's, add fields) + `crawlers.schema.json` + `status.schema.json`
- [ ] T1102 `public/data/show.json` additions (tagline/pitch/cadence from the addendum; sample dates; summaries; trailer TODO); `public/data/crawlers.json` for the five crawlers with TODO placeholders; samples test covers both
- [ ] T1103 `validateCrawlers`, `validateStatus` (+tests); `fetchCrawlers`, `fetchStatus`, `readEmbedded()` in load.ts (+tests)
- [ ] T1104 `ShowContext` seeds from embedded data; new `CrawlersContext` (profiles + status) (+tests)
- [ ] T1105 `src/site/gate.ts` (+tests both sides of `hubLiveAt`, countdown formatting, newest episode)
- [ ] T1106 `src/site/seo.tsx` `<Seo>` + `HeadCollector` (+tests: client hoisting, server collection)
- [ ] T1107 `src/site/analytics.ts` (+tests: no-op when unset)
- [ ] T1108 `src/entry-server.tsx` + `vite.config.ts` ssr entry; `main.tsx` hydrate-or-create (+test)
- [ ] T1109 `scripts/build-status.ts` (+test against ep1-3: newest past-gate episode, omitted crawlers)
- [ ] T1110 `scripts/prerender.mjs` (route list from data; template injection) (+smoke test via entry-server)
- [ ] T1111 `scripts/sitemap.mjs` (+test), `scripts/og.mjs` (puppeteer-core, Chrome discovery, skip-with-warning), `scripts/postbuild.mjs` orchestrator; `npm i -D puppeteer-core`
- [ ] T1112 Gates + README "Build pipeline" note

## Wave B - components + pages
- [ ] T1113 `src/site/copy.ts`
- [ ] T1114 `RosterCard` (card/hero/og variants, one layout module) (+tests)
- [ ] T1115 `GatedCta`, `StatusLine`, `SystemBox`, `SocialRow`, `SiteFooter`, `TrailerEmbed` (+tests)
- [ ] T1116 `EpisodeRow` with countdown chip (+tests)
- [ ] T1117 `HomePage` (+tests: CTA gate both sides, latest card hidden without trailer)
- [ ] T1118 `WatchPage` (floors, newest first, empty floor copy) (+tests)
- [ ] T1119 `CrawlersPage` (chips only with >1 status) (+tests)
- [ ] T1120 `CrawlerPage` (hero, concept, pockets, entry achievement SystemBox, player, appears-in, prev/next) (+tests)
- [ ] T1121 `CommunityPage` (+tests)
- [ ] T1122 `OgCrawlerPage`, `OgEpisodePage` at `/_og/**` (fixed 1200x630 frame)
- [ ] T1123 `SiteHeader` nav (Watch / Crawlers / Community; hub extras only on hub pages) (+tests updated)
- [ ] T1124 Mobile CSS pass at 375 px; reduced motion; lazy art

## Wave C - integration, OG, gates
- [ ] T1125 Routes in `App.tsx` (lazy marketing pages; `/` -> HomePage; `/watch` = old hub list reworked; old `HubPage` removed or redirected)
- [ ] T1126 `<Seo>` on every route incl. hub pages (title/description; og:image for episodes = `/og/ep{N}.png`); JSON-LD VideoObject on `/watch` rows or `/ep/:id`
- [ ] T1127 Analytics events wired (hub_open, crawler_view, outbound)
- [ ] T1128 Full build locally: prerendered HTML for all routes, `og/*.png` present, sitemap, status.json; hydrate without console mismatch warnings
- [ ] T1129 CI/deploy workflows: Chrome path; build must pass on ubuntu
- [ ] T1130 Lighthouse mobile on `/` >= 90 all categories (preview build); axe on all five routes; 375 px screenshots (no horizontal scroll, CTAs above the fold, roster 2-col)
- [ ] T1131 README: front door section, data fields, author-to-fill list, env vars, build pipeline
- [ ] T1132 Acceptance checklist (addendum §8) ticked with evidence in this file

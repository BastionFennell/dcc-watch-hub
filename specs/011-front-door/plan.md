# Plan - 011 Front Door

Constitution: I-VII untouched; VIII (new) governs. One new devDependency (`puppeteer-core`).

## Layout
```
public/data/crawlers.json                         new
public/data/show.json                             + tagline/pitch/cadence/trailer/links/episode fields
src/data/types.ts                                 + ShowMeta fields, EpisodeMeta fields, CrawlerProfile, CrawlerStatus
src/data/validate.ts                              + validateCrawlers, validateStatus (lenient)
src/data/load.ts                                  + fetchCrawlers, fetchStatus, readEmbedded()
src/data/ShowContext.tsx                          seed from readEmbedded().show
src/data/CrawlersContext.tsx                      new: profiles + status (seeded or fetched)
src/site/                                         marketing code (lazy chunk per page)
  gate.ts        hubLive(ep, now), ctaFor(ep, now), countdown(ms), newestEpisode(show), useNow()
  seo.tsx        <Seo> (React 19 hoistable <title>/<meta>/<link>, plus a HeadCollector for SSR)
  analytics.ts   track(), Plausible loader (gated by env)
  copy.ts        marketing strings (plain voice; System voice only inside SystemBox)
  components/    RosterCard(+variants), GatedCta, SystemBox, SiteFooter, EpisodeRow, SocialRow,
                 TrailerEmbed (click-to-play poster -> iframe), StatusLine
  pages/         HomePage, WatchPage, CrawlersPage, CrawlerPage, CommunityPage, OgCrawlerPage,
                 OgEpisodePage (routes /_og/**, 1200x630 fixed frame)
src/entry-server.tsx                              render(url, data) -> { html, head }
src/main.tsx                                      hydrate-or-create
src/App.tsx                                       routes; SiteHeader nav
scripts/build-status.ts, prerender.mjs, og.mjs, sitemap.mjs, postbuild.mjs (orchestrator)
vite.config.ts                                    ssr build entry; keep modulePreload setting
.github/workflows/{ci,deploy}.yml                 CHROME_PATH=/usr/bin/google-chrome
specs/011-front-door/contracts/{show,crawlers,status}.schema.json
```

## Contracts
```ts
interface EpisodeMeta { ...existing; premiereAt?: string; hubLiveAt?: string; summary?: string; ogImage?: string }
interface Show { ...existing; tagline?: string; pitch?: string; cadence?: string; trailerYoutubeId?: string;
  links: { youtube: string; discord: string; tiktok?: string; bluesky?: string; instagram?: string } }
interface CrawlerProfile { id: string; name: string; characterName: string; handle: string;
  player: { name: string; pronouns?: string; bio?: string; bust?: string; links?: Record<string,string> };
  concept: string; pockets: string[]; entryAchievement?: { title: string; text: string; box?: string; item?: string };
  art: { bust: string; full?: string }; og?: string; status: 'alive' | 'dead' | 'fused' | 'unknown' }
interface CrawlerStatus { level: number; hp: { current: number; max: number }; floor: number; lastEpisodeId: number }
type StatusFile = { generatedAt: string; episodeId: number | null; crawlers: Record<string, CrawlerStatus> }
interface Embedded { route: string; show: unknown; crawlers: unknown; status: StatusFile | null }
// gate.ts
hubLive(ep, now = Date.now()): boolean   // !ep.hubLiveAt || Date.parse(ep.hubLiveAt) <= now
ctaFor(ep, now): { kind: 'youtube' | 'hub'; href: string; label: string }
// entry-server.tsx
render(url: string, data: Embedded): { html: string; head: string }   // head = title+meta+link tags
// RosterCard
{ profile: CrawlerProfile; status?: CrawlerStatus; variant: 'card' | 'hero' | 'og'; hook?: string }
```

## Prerender mechanics
`entry-server` wraps `<App>` in `StaticRouter` + providers seeded from `data`; `renderToString`.
Head tags: `<Seo>` renders React 19 hoistables; the server also pushes the same values into a
`HeadCollector` context so `render()` can return them deterministically. `prerender.mjs` takes
`dist/index.html` as the template, replaces `<title>`/description with the route's head, injects
`<div id="root">{html}</div>` and the `__DCC__` script, writes `dist/<route>/index.html`
(`dist/index.html` for `/`). Assets keep their hashed paths. Hub routes are not prerendered.

## Waves (sequential, one Opus agent each)
- **A - data + build plumbing**: T1101-T1112.
- **B - components + pages**: T1113-T1124.
- **C - integration, OG, gates**: T1125-T1132.

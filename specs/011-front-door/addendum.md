# Dungeon Crawl Cast - Marketing Site Addendum (spec v1.1)

Author's handoff, 2026-09-23, reproduced verbatim except for dashes (repo rule: hyphens only).

Extends `dcc-watch-hub-spec.md`. Same repo, same Vite build, same host, same design tokens and `show.json` data. The hub stays the product; these pages are its front door. Nothing here changes hub behavior.

## 0. Principles (inherit from hub spec, plus)

1. **One product.** Marketing pages and the hub share tokens, header, and data. A visitor should not be able to tell where "site" ends and "viewer" begins.
2. **YouTube first for first-watch.** New-episode CTAs point at YouTube for 48 hours after premiere (the broadcast-delay rule); the hub link activates after. Encoded in data (`hubLiveAt`), not hand-edited.
3. **Mobile-first here, desktop-first there.** Marketing pages get most traffic from phones arriving via shorts/social. The hub is desktop-first. Do not compromise either for the other.
4. **Shareable by default.** Every page has an OpenGraph image and description. Crawler and episode pages are the pages fans will link; their previews must look intentional.

## 1. Routes (v1 - exactly these)

| Route | Job |
|---|---|
| `/` | Convert a stranger in ten seconds. |
| `/watch` | Episode archive grouped by floor -> hub episode pages (existing `/ep/:id`). |
| `/crawlers` | Roster grid -> `/crawlers/:id`. |
| `/crawlers/:id` | One crawler + the player behind them. |
| `/community` | Discord, YouTube, TikTok, Bluesky, cadence. Replaces the Linktree. |

Parked (v2, do not build): `/world` (neighborhood lore, NPCs, glossary), `/press` (sponsor/press one-pager), newsletter signup.

## 2. Data

### 2.1 show.json - additions

```json
{
  "tagline": "Heart and chaos in the World Dungeon.",
  "pitch": "Five people from a film crew. One apocalypse. A game show that wants them dead and watchable.",
  "cadence": "New crawls every other week.",
  "trailerYoutubeId": "XXXXXXXXXXX",
  "links": { "youtube": "...", "discord": "...", "tiktok": "...", "bluesky": "...", "instagram": "..." },
  "episodes": [
    {
      "id": 1,
      "title": "Episode 1 - Lights, Camera, Apocalypse",
      "youtubeId": "XXXXXXXXXXX",
      "floor": 1,
      "durationSec": 5400,
      "dataUrl": "/data/ep1.json",
      "premiereAt": "2026-10-08T17:00:00Z",
      "hubLiveAt": "2026-10-10T17:00:00Z",
      "summary": "One-paragraph, spoiler-safe.",
      "ogImage": "/og/ep1.png"
    }
  ]
}
```

- `hubLiveAt` gates the hub CTA on `/`, `/watch`, and the episode card. Before it, the button reads "Watch on YouTube" and links out; after it, "Open the System feed" links to `/ep/:id`. Pure client-side comparison against `Date.now()`; no server.

### 2.2 crawlers.json (new)

```json
{
  "crawlers": [
    {
      "id": "stuntman",
      "name": "The Stuntman",
      "characterName": "Ronald",
      "handle": "Dungeon Crawler Ronald",
      "player": { "name": "Player Name", "pronouns": "he/him", "bio": "Two sentences.", "links": { "bluesky": "..." } },
      "concept": "Thrill-seeking stunt performer - bombastic, flashy, does everything the showy way.",
      "pockets": "What was in his pockets when the world ended - from the character doc.",
      "entryAchievement": { "title": "Method Acting", "text": "System text verbatim.", "box": "Golden Monster Box", "item": "Liquid Latex" },
      "art": { "bust": "/img/crawlers/stuntman-bust.png", "full": "/img/crawlers/stuntman-full.png" },
      "og": "/og/crawler-stuntman.png",
      "status": "alive"
    }
  ]
}
```

- `status` is authored: `alive | dead | fused | unknown`. Everything else live (level, HP) derives from hub data - see §5.
- Five crawlers at launch. The schema supports guests/Table B later; don't build UI for that now.

## 3. Pages

### 3.1 `/` Home

Order, top to bottom. Mobile stacks in the same order.

1. **Header** - reuse hub `SiteHeader` (mark -> `/`, nav: Watch / Crawlers / Community; the episode-context center slot is hidden off episode pages).
2. **Hero** - eyebrow ("A Dungeon Crawler Carl actual play"), `tagline` as the H1, `pitch` under it, two CTAs: primary = newest episode (YouTube or hub per `hubLiveAt`), secondary = the other. Right/below: 16:9 embed of `trailerYoutubeId` (or newest episode if no trailer), YouTube IFrame, click-to-play, no autoplay.
3. **Latest episode card** - title, floor, spoiler-safe summary, the same gated CTA. Hidden if it duplicates the hero's embed (i.e., no trailer configured).
4. **Meet the crawlers** - five `RosterCard`s (§4) in a row; 2-col on mobile. Whole card links to `/crawlers/:id`.
5. **Two strips** - "New to Dungeon Crawler Carl?" (System-blue callout linking the pillar essays on YouTube) and "Join the Discord" (purple card with the social row + `cadence`).
6. **Footer** - links, "Not affiliated with Matt Dinniman or Renegade Game Studios" line, © line.

### 3.2 `/watch`

- Episodes grouped by floor from `show.json.seasons`, newest first within a floor.
- Each row: thumbnail (YouTube `hqdefault` or `ogImage`), title, floor, duration, summary, the gated CTA. Rows before `hubLiveAt` show a small "System feed unlocks in 2d 4h" chip.
- Empty-state copy for floors with no episodes yet ("Floor 2 - the descent continues.").

### 3.3 `/crawlers`

- Grid of `RosterCard`s (5 now). Optional filter chips by status only if more than one status exists - otherwise no chips.

### 3.4 `/crawlers/:id`

Top to bottom:
1. **Hero** - full-body art on one side, name / character name / handle / status pill on the other. Live line under it: "Level 2 · 4/6 HB · Floor 1" (§5), or hidden if no episode data exists yet.
2. **Concept** - `concept` paragraph.
3. **"What was in their pockets when the world ended"** - `pockets`, styled as a list.
4. **Entry achievement** - rendered as a System box: title, verbatim text, then "Reward: {box} -> {item}". This is the on-brand centerpiece of the page.
5. **The player** - bust of the real person if provided, name, pronouns, two-sentence bio, links. Keep it short; the character is the star.
6. **Appears in** - episode list (derived: any episode whose event log references this crawler `id`).
7. Prev/next crawler links.

### 3.5 `/community`

- Single column. Big Discord CTA first, then the platform row, then `cadence`, then a one-paragraph "how to support" (subscribe, share, Discord). No newsletter in v1.
- This URL is what every social bio links to. Keep it fast and boring.

## 4. RosterCard component (does triple duty)

One component, three renders:

- **Card** (grid/strip): bust art, name, character name, level pill, status pill. Whole card is the link.
- **Hero** (crawler page): full-body art variant, larger type.
- **OG image** (static PNG, 1200x630): rendered at build time from the same data - bust art on the left, name + handle + a one-line hook on the right, brand mark bottom-right. Generated for each crawler and each episode (episode variant uses episode title/floor). Use a build-time renderer (e.g., satori/resvg or a Playwright screenshot step); output to `/og/`.

Rule: the three renders share layout logic and tokens so a card, its page hero, and its share preview are recognizably the same object.

## 5. Live status hook (crawler pages + roster)

- At build time, generate `/data/status.json`: for each crawler, run the hub reducer over the **latest published episode's** event log to its end (or `hubLiveAt`-gated latest), and emit `{ level, hp, floor, lastEpisodeId }`.
- Pages read `status.json`; nothing computes at runtime. A crawler with no events yet shows no live line.
- Spoiler rule: status reflects only episodes past `hubLiveAt`. A dead crawler's `status` flips to `dead` by hand in `crawlers.json`; never infer death from events.

## 6. Design

- Tokens, type, and colors: identical to hub (`#131320` canvas, `#1d1d28` panels, purple `#3C3489/#534AB7`, System blue `#0C447C/#B5D4F4`).
- Callouts that "announce" anything use the System-box style. Nothing else does - keep the box rare so it stays meaningful.
- Mobile: 375px-first. Hero CTAs above the fold. Roster 2-col. Tap targets >= 44px.
- Reduced-motion respected; no autoplaying video anywhere on the marketing pages.

## 7. Infrastructure & hygiene

- **Domain:** register the primary today (check `dungeoncrawlcast.com` first, then `.show` / `.tv`). All social bios point at `/community` once live.
- **Build:** same Vite project as the hub. Static routes prerendered (vite-plugin-ssr / vite-ssg or equivalent) so crawler and episode pages have real HTML for previews and search.
- **SEO:** per-page `<title>` and meta description from data; `sitemap.xml` generated at build; canonical URLs; JSON-LD `VideoObject` on episode pages (optional, cheap).
- **OpenGraph/Twitter cards:** every route sets `og:title`, `og:description`, `og:image` (from `/og/`), `og:type`.
- **Analytics:** privacy-respecting script (Plausible or equivalent), no cookie banner required. Track: outbound clicks to YouTube/Discord, hub opens, crawler page views.
- **Performance:** images as WebP with PNG fallback for OG; art lazy-loaded below the fold; Lighthouse >= 90 mobile on `/`.

## 8. v1 acceptance checklist

- [ ] `/`, `/watch`, `/crawlers`, `/crawlers/:id`, `/community` render from `show.json` + `crawlers.json` with no server.
- [ ] Newest-episode CTA correctly flips YouTube -> hub at `hubLiveAt` (test both sides of the timestamp).
- [ ] Every route has correct OG tags and a generated `/og/*.png`; a shared crawler link previews with the roster card in Discord and Bluesky.
- [ ] Roster cards link to crawler pages; crawler pages show the entry achievement as a System box.
- [ ] `status.json` builds from the latest published episode and updates crawler pages without touching hub code.
- [ ] Mobile 375px: hero CTAs above the fold, no horizontal scroll, roster 2-col.
- [ ] Lighthouse >= 90 mobile on `/`; no autoplay anywhere.
- [ ] `/community` is the single link in every social bio.

## 9. Parked (v2 - do not build)

- `/world`: neighborhood pages (The Test Kitchen), NPC pages (Sharky, Dennis, BEEF BUS), a newcomer glossary.
- `/press`: one-pager with logo pack, cast, audience stats, contact.
- Newsletter signup; guest/Table B roster UI; merch; comments.

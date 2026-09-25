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

## Author to fill (unwritten fields ship empty and render nothing; listed in the JSON's `todo` and in the README)
`concept`, `pockets`, player bios and links; `trailerYoutubeId`;
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

## Revision 2 (2026-09-24) - crawler page redesign

From an external design review of `/crawlers/:id` (values read off the live page), adopted with
three content adjustments the author confirmed.

### Content rules
- **Empty states render nothing**: no heading, no placeholder, never "coming soon". A page with
  one filled section beats one with five placeholders.
- **No progression spoilers in the hero**: no floor number, no level line, no "ALIVE" pill. The
  authored status pill shows only when status is not `alive` (dead / fused / unknown). A viewer
  progress-aware pill is parked as a data-model question.
- **Keep the entry achievement** when present, restyled to look like the System awarding an
  achievement (the hub's `AchievementToast` look: System-blue hairline frame, mono "ACHIEVEMENT
  UNLOCKED" kicker, trophy glyph, the title large, the verbatim text, then "Reward: {box} -> {item}"
  as the payout line). It is the page's only System-styled element.
- **Keep "Appears in"** as plain episode links (title only, no floor), only for published episodes.
- **Player credit moves into the hero**: "Played by {name}" (name bright, weight 600, rest muted),
  under a hairline. No standalone player section; pronouns/bio/links, when present, sit under the
  credit in one muted line.
- **One CTA**: "Start at Episode 1" as a grid child of the hero, using `GatedCta` for episode 1
  (YouTube before `hubLiveAt`, System feed after). Prev/next crawler in one full-width bar
  (prev left, next right).

### Layout (desktop)
Hero grid: `grid-template-columns: 320px minmax(0, 1fr)`, areas `"art text" "cta text" "fill text"`,
rows `auto auto 1fr` (the 1fr fill row keeps the 16 px gap under the portrait), column-gap 56,
row-gap 16, align-items/content start; the text column is full width (no `ch` cap on the paragraph
so paragraph, rules, and dividers end on the same pixel). Portrait 320 px, 14 px radius, hairline
border, soft shadow. Pockets: hairline rows (`<ul>` top border, `<li>` 11px 0 padding + bottom
border), no bullet glyphs. Next bar: full width, 56 px top margin, 18/20 padding, 10 px radius.
Type scale: eyebrow 11/0.16em caps accent; name 34/650/-0.02em; handle 12 mono 0.06em muted;
credit 13 muted; body 16/28; section label 11/0.16em caps 600 muted.

### Responsive (<= 720 px)
Single column, areas `"art" "text" "cta"` (CTA after the description), row-gap 28, portrait max
280 px, name 28 px, CTA capped at 280 px, nav bar stacks.

### Tokens
Map the review's colours to existing tokens where a role exists; add tokens only for missing roles
and list them in the README. The page container and the footer share one `--site-measure` width.

### Not committed
The reviewer's mockup copy (Harry's concept and pockets) is dummy text and must not land.

### Revision 2 as built (2026-09-24)

- **Archetype names and entry achievements are no longer placeholders.** All five archetype names
  and all five entry achievements are authored, transcribed verbatim. `CrawlerEntryAchievement`
  gains `reward`: the reward paragraph the System read out, rendered under the
  "Reward: {box} -> {item}" payout line. Schema and validator updated in the same change.
- **Empty is a valid value.** `concept` may be `""` and `pockets` `[]`; the validator keeps the
  crawler and the page renders nothing for that section. `"Concept coming soon."` and its siblings
  are gone from `crawlers.json`; the `todo` list stays.
- **Tokens added**: `--site-measure` (992 px, shared by `page.module.css` and `SiteFooter`),
  `--text-display` (28 px, 34 px from 721 px up), `--ink-muted` / `--ink-body`. `--hairline` already
  existed and was reused rather than redefined.
- **`EntryAchievement`** (`src/site/components/`) carries the achievement. It shares the hub
  `AchievementToast`'s tokens and shape - System-blue panel, amber mono kicker, trophy glyph
  (`IconRank`), title, verbatim text - but is a static block: no queue, no window, no animation.
  The hub component is not imported.
- **`GatedCta` gains `quiet` and `label`.** `quiet` is the crawler hero's full-width 44 px brand
  tint; `label` lets the hero say "Start at Episode 1" on both sides of the `hubLiveAt` gate. Every
  other call site is untouched and unchanged.
- **`StatusLine` is no longer used by the crawler page.** It stays, and `RosterCard`'s `hero`
  variant still renders it.
- **Reading order**: the CTA is the second grid child, so at <= 720 px the DOM order (art, CTA,
  text) differs from the visual order the revision asks for (art, text, CTA). The CTA therefore
  falls below the fold on a phone, which is the one place revision 2 and the addendum's §6
  "hero CTAs above the fold" pull in different directions; revision 2 wins, as the later document.

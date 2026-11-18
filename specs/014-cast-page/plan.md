# Plan - 014 cast page

Constitution 1.5.1 -> **1.5.2** (PATCH: `/cast` joins Principle VIII's route list and `cast.json`
joins the files the front door reads). No new dependencies, runtime or dev.

## Technical context
- TypeScript strict, React 19, react-router 7, CSS Modules, Vitest 3 + Testing Library, ajv for
  the schema tests. Node 20.9.
- Authored JSON under `public/data/`, validated leniently at runtime (`src/data/roster.ts`) and
  strictly by a lint that fails tests and the build (the 012 pattern).
- Prerendered by `scripts/prerender.mjs`; payload rides in `__DCC__`.
- Images are committed assets, prepared once by hand (`sips` crop + `cwebp`); nothing image-related
  runs at build.
- Budgets: card photo <= 45 kB, credit photo <= 8 kB (spec FR-013 / SC-005).

## Constitution check
| Principle | Verdict |
|---|---|
| I-VI (hub: pure overlay, YouTube seam, ambient panels, no audio, storage, System voice) | Untouched. No hub file changes except the header's nav and `src/copy.ts` (`navCast`). |
| VII Studio | Untouched. |
| VIII Front door: same tokens/header/data | Pass. Reuses `page.module.css`, the pill styles and `SiteFooter`; no System box. |
| VIII static + prerendered, per-route head, OG | Pass. `/cast` joins `STATIC_ROUTES`; shares `ogSiteImage` (no new OG frame). |
| VIII devDependencies only at build | Pass. None added. |
| VIII mobile-first at 375 px | Pass. Single column; nav verified at 375 and 320. |
| VIII no autoplay / spoiler-safe / absence is never a signal | Pass. No media; role lines carry the character's name and nothing else. |
| VIII route list names the marketing routes | **Amend** (1.5.2) in the same change; not a violation once amended. |
| Scope: nothing beyond the active feature | Pass. No JSON-LD `Person`, no per-person page, no hub change. |

Re-checked after design: no change.

## Layout
```
public/data/cast.json                              NEW authored: five members (data-model.md)
public/data/crawlers.json                          `player` removed from all four; `player.*` todo lines removed
public/img/cast/<id>.webp, <id>-sm.webp            NEW 480x480 card photo, 96x96 credit photo (research R3)
specs/014-cast-page/contracts/cast.schema.json     NEW
specs/011-front-door/contracts/crawlers.schema.json  amended: `player` gone (as 012 amended `status`)

src/data/types.ts            CastMember, CastLink, CastLinkKind, CAST_LINK_KINDS, CastFile;
                             CrawlerPlayer deleted; CrawlerProfile.player removed; Embedded.cast?: unknown
src/data/roster.ts           validateCast(raw), fetchCast(); toPlayer() deleted; a profile no longer needs a player
src/data/CrawlersContext.tsx + `cast: CastMember[]` (seeded from `embedded.cast`, else fetched; 404 -> [])
src/site/cast.ts             NEW pure: playerOf(cast, crawlerId), castAnchor(id) -> `/cast#id`
src/site/copy.ts             cast strings; platform.links = 'Links'
src/copy.ts                  navCast: 'Cast' (nav labels live here; siteCopy re-exports)

src/site/components/CastCard.tsx + .module.css      NEW one member: photo, name, role, pronouns, bio, links
src/site/components/CastLinks.tsx                   NEW ordered {kind,url}[] as pills (styles from SocialRow.module.css)
src/site/pages/CastPage.tsx + .module.css           NEW head, lead, cards, footer; hash scroll on client nav
src/site/pages/lazy.tsx, preload.ts                 + CastPage
src/App.tsx                                         + <Route path="/cast">
src/site/pages/CrawlerPage.tsx + .module.css        credit = small photo + "Played by <Link to=/cast#id>"; detail + SocialRow removed
src/components/SiteHeader/SiteHeader.tsx + css      + Cast NavLink; phone padding tightened if 4 items do not fit
src/site/components/SiteFooter.tsx                  + Cast link

scripts/cast.ts              NEW pure: lintCast(castRaw, crawlersRaw, fileExists) -> string[]
scripts/lint-cast.ts         NEW tsx entry: prints errors, exit 1; chained into `prebuild`
scripts/prerender.mjs        STATIC_ROUTES + '/cast' (before /community); reads cast.json into the payload
package.json                 prebuild: `tsx scripts/build-dossier.ts && tsx scripts/lint-cast.ts`; + `lint:cast`

.specify/memory/constitution.md   1.5.2
README.md                         "The cast page": how to add a bio, a link, a photo
```

## Design decisions (detail in research.md)
- **One direction of reference**: a member names their crawler (`crawlerId`); crawlers say nothing
  about people. The crawler page finds its player with `playerOf`. One fact, one place.
- **Runtime lenient, lint strict**: `validateCast` drops a bad member or a bad link and never
  throws; `lintCast` is where FR-011 lives and it fails `npm test` and `npm run build`.
- **No player, no credit**: if `cast.json` is missing or nobody claims a crawler, the crawler page
  renders without the credit block rather than failing. The lint makes that unreachable in a real
  build.
- **Cards are one per row at every width** (max measure ~720 px). Bios run from zero to two
  paragraphs; a grid would leave ragged holes. Phone: photo 96 px beside name/role/pronouns, bio
  under both. >= 640 px: photo 200 px in a left column, text right.
- **Anchors**: each card is `<article id={member.id}>` with `scroll-margin-top` = header height +
  space. Cold loads work natively because the markup is prerendered; a client-side navigation
  from a crawler page needs one effect in `CastPage` that scrolls to `location.hash` after mount.
- **Links**: `CastLinks` renders in authored order; label = `siteCopy.platform[kind]`;
  `target="_blank" rel="noopener"` (not `me`: the show's site is not that person's identity);
  `trackOutbound(kind)`.
- **Photos**: `photo: { card, credit }`, explicit paths like `art: { bust, full }`. `<img>` carries
  `width`/`height`, `alt={member.name}`, `loading="lazy"` except the first card (eager) and the
  crawler-page credit (eager, above the fold).

## Waves
- **A (assets, data, lint)**: T1401-T1411. Ends with `cast.json` valid, photos in budget, the
  crawler page still rendering its credit from the new source.
- **B (page, nav, anchors, credit, governance, gates)**: T1412-T1423.

## Risks
- **Nav width at 375 px**: four items plus the mark. Measure first; the fix is padding in the
  existing `max-width: 640px` block, not a menu.
- **Fixtures**: `player` appears in `src/test/fixtures.ts` and several page tests' fetch mocks;
  every mock that answers `crawlers.json` must also answer `cast.json` (or the provider's 404 path
  is what gets tested by accident).
- **Hydration**: `cast` must be seeded from the payload on prerendered routes exactly like
  `crawlers`, or the credit flashes in after a fetch.

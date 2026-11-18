# Tasks - 014 cast page

Read first: `spec.md` (FR-014 holds the exact bios), `plan.md`, `research.md`, `data-model.md`,
`contracts/cast.schema.json`, `quickstart.md`. Ids continue the repo's `T<feature><nn>` scheme.
`[P]` = can run alongside its neighbours (different files, no unfinished dependency).
Every phase ends with `npm run typecheck && npm run lint && npm test` green.

## Phase 1 - Setup (assets)

- [X] T1401 Prepare the ten photos in `public/img/cast/` per research R3. For each of `lulu`
  (`~/Downloads/img_1_1791845091930.jpg`), `madio` (`20261003_163615.jpg`), `danny`
  (`IMG_0575.jpg`), `sarah` (`IMG_5919.jpg`), `bastion` (`Bastion_and_Margruite_Edited-0092.jpg`):
  copy the source to the scratchpad, crop a square around the face with `sips` (face centred, eyes
  about 40% from the top, some shoulder; Bastion's face is in the top third of a 2667x4000 frame,
  so do not centre-crop), resize to 480x480 and 96x96, encode with `cwebp -q 80` to `<id>.webp`
  and `<id>-sm.webp`. Budgets: card <= 45 kB, credit <= 8 kB (lower `-q` if over). Read every
  output image back and fix any crop that cuts a face or chin. Never write into `~/Downloads`.
  The shipped files must carry no EXIF/GPS metadata: `cwebp` strips it by default (do not pass
  `-metadata`); if the JPEG fallback is used, strip it explicitly and confirm with `sips -g all`.

## Phase 2 - Foundational (data; blocks every story)

- [X] T1402 `src/data/types.ts`: add `CAST_LINK_KINDS`, `CastLinkKind`, `CastLink`, `CastMember`,
  `CastFile` exactly as in data-model.md; add `cast?: unknown` to `Embedded`; delete
  `CrawlerPlayer` and `CrawlerProfile.player`.
- [X] T1403 [P] `specs/011-front-door/contracts/crawlers.schema.json`: remove `player` from
  `required` and `properties`; extend the top `comment` with "Amended by 014: the player moved to
  cast.json".
- [X] T1404 [P] Author `public/data/cast.json` per data-model.md: order lulu, madio, danny, sarah,
  bastion; names, pronouns, `crawlerId` (mimi, ronald, xo, veil) / `role` ("The System AI"),
  photo paths from T1401, links from the spec's FR-014 table; bios copied character for character
  from spec FR-014 (Madio one paragraph, Sarah two, Danny one, Lulu and Bastion `[]`); `todo`
  as in data-model.md. In `public/data/crawlers.json` remove every `player` object and the two
  `player.*` todo lines.
- [X] T1405 `src/data/roster.ts`: delete `toPlayer` and the player requirement in
  `toCrawlerProfile`; add `validateCast(raw): CastFile` (lenient, never throws, rules in the
  data-model "Runtime" column, `console.warn` naming the member id) and `fetchCast()` (URL
  `/data/cast.json` via `joinBase(siteBaseUrl(), ...)`; fetch failure, non-OK or bad JSON ->
  `{ cast: [] }`, like `fetchStatus`). Tests in `src/data/validate.test.ts` beside the
  `validateCrawlers` ones: each lenient rule, plus "a crawler with no player field is kept".
- [X] T1406 [P] `scripts/cast.ts`: pure `lintCast(castRaw, crawlersRaw, fileSize): string[]`
  implementing every row of the data-model "Lint" column, including the photo budgets (the third
  argument is a `fileSize(path): number | null` probe: `null` = missing, card > 45 kB or credit
  > 8 kB = error, so a later photo swap cannot break SC-005 silently); each message starts with the member id
  (or the crawler id for "has no player" / "has more than one player"). `scripts/cast.test.ts`:
  one failing case per rule, a clean case, and a test that runs it over the real
  `public/data/cast.json` + `crawlers.json` with `statSync` sizes under `public/` and expects `[]`
  (so it needs T1401 and T1404 done).
- [X] T1407 `scripts/lint-cast.ts` (tsx entry: read both files, run `lintCast`, print each error
  to stderr, `process.exit(1)` if any). `package.json`: add `"lint:cast": "tsx scripts/lint-cast.ts"`
  and change `prebuild` to `tsx scripts/build-dossier.ts && tsx scripts/lint-cast.ts`.
- [X] T1408 [P] `src/data/samples.test.ts`: validate `public/data/cast.json` against
  `specs/014-cast-page/contracts/cast.schema.json` with the existing ajv setup; keep the
  crawlers-schema test passing against the amended schema.
- [X] T1409 `src/site/cast.ts` (pure): `playerOf(cast, crawlerId)` and `castAnchor(id)` returning
  `/cast#<id>`; `src/site/cast.test.ts`.
- [X] T1410 `src/data/CrawlersContext.tsx`: add `cast: CastMember[]` to the context value (default
  `[]`); seed it from `embedded.cast` through `validateCast` when the payload has it, otherwise
  `fetchCast()` in the same effect that fetches the roster (a payload with crawlers but no `cast`
  key, i.e. pre-014, also fetches). `scripts/prerender.mjs`: read `public/data/cast.json`
  (fallback `{ cast: [] }`) and add `cast` to every route's `data`. Update
  `src/data/CrawlersContext.test.tsx` (seeded: no fetch; unseeded: fetches `cast.json`; 404: empty
  cast, no error) and `scripts/prerender.test.ts`.
- [X] T1411 Keep the tree compiling and honest after T1402: in `src/site/pages/CrawlerPage.tsx`
  take the player from `playerOf(cast, profile.id)`, render the existing credit line with the name
  only, and render no credit block at all when there is no player; delete the `detail` line and
  the player `SocialRow`. Update `src/test/fixtures.ts` (drop `player` from crawler fixtures, add
  a `cast` fixture: one player with bio + two links, one player with nothing, one non-player with
  a role) and every fetch mock that answers `crawlers.json` (`src/App.test.tsx`,
  `src/App.shell.test.tsx`, `src/pages/EpisodePage.test.tsx`, `src/pages/EpisodePage.phone.test.tsx`,
  the site page tests) so it also answers `cast.json`. Fix `CrawlerPage.test.tsx`, `jsonLd.test.ts`,
  `Dossier.test.tsx` and any other test that still builds a `player`.

**Checkpoint**: gates green; `npm run lint:cast` passes; `/crawlers/ronald` still says "Played by
Madio".

## Phase 3 - User Story 1: meet the people who make the show (P1) - MVP

**Goal**: `/cast` exists, is in the nav, and shows five cards. **Independent test**: quickstart
steps 1-5 and 8.

- [X] T1412 [US1] Copy. `src/copy.ts`: `navCast: 'Cast'` beside the other nav labels.
  `src/site/copy.ts`: re-export `navCast`; add `platform.links: 'Links'`; add
  `castTitle: 'The cast'`, `castLead: 'The people behind the crawlers, and the voice of the System.'`,
  `castDescription: 'Meet the cast of Dungeon Crawl Cast: the four players behind the crawlers and the voice of the System.'`,
  `castPlays: (characterName: string) => \`Plays ${characterName}\``,
  `castLinksLabel: (name: string) => \`${name}'s links\``.
- [X] T1413 [P] [US1] `src/site/components/CastLinks.tsx`: props `{ links: CastLink[]; label: string }`;
  returns `null` for an empty list; a `<ul aria-label={label}>` of pills in authored order using
  the `.row` / `.link` classes from `SocialRow.module.css`; each `<a target="_blank"
  rel="noopener" onClick={() => trackOutbound(kind)}>` labelled `siteCopy.platform[kind]`.
- [X] T1414 [US1] `src/site/components/CastCard.tsx` + `CastCard.module.css`: props
  `{ member: CastMember; profile?: CrawlerProfile; eager?: boolean }`. `<article id={member.id}>`
  with an `<h2>` name; `<img src={asset(member.photo.card)} alt={member.name} width={480}
  height={480} loading={eager ? 'eager' : 'lazy'}>`; role line = `<Link to={/crawlers/<id>}>` with
  `siteCopy.castPlays(profile.characterName)` when `member.crawlerId` and `profile` are both
  present, `member.role` as plain text otherwise, nothing when neither applies; pronouns when
  present; one `<p>` per bio paragraph only when `bio.length > 0`; `<CastLinks>` only when
  `links.length > 0`. Layout per plan: phone = 96 px photo beside name/role/pronouns, bio and
  links below; >= 640 px = 200 px photo column, text right. Existing tokens only; no System box.
- [X] T1415 [US1] `src/site/pages/CastPage.tsx` + `CastPage.module.css`, modelled on
  `CommunityPage.tsx`: `<Seo title={siteCopy.pageTitle(siteCopy.navCast)}
  description={siteCopy.castDescription} canonicalPath="/cast" ogImage={siteCopy.ogSiteImage}>`,
  the shared page head (eyebrow, `<h1>`, lead), one `CastCard` per `cast` entry in order (first
  one `eager`, `profile` looked up in `profiles` by `crawlerId`), `SiteFooter`. One column of
  cards at every width, measure about 720 px. Default export. Register in
  `src/site/pages/lazy.tsx` (`CastPage`), `src/site/pages/preload.ts` (`PRELOADABLE`) and
  `src/App.tsx` (`<Route path="/cast">` between `/crawlers/:id` and `/community`).
- [X] T1416 [P] [US1] `scripts/prerender.mjs`: `STATIC_ROUTES = ['/', '/watch', '/crawlers',
  '/cast', '/community']`. Update `scripts/prerender.test.ts` and `scripts/sitemap.test.ts`.
- [X] T1417 [US1] Nav: add the Cast `NavLink` between Crawlers and Community in
  `src/components/SiteHeader/SiteHeader.tsx` and the Cast link in
  `src/site/components/SiteFooter.tsx`; update the header's doc comment and add `/cast` to the
  route lists in `src/components/SiteHeader/SiteHeader.test.tsx`,
  `src/site/components/SiteChrome.test.tsx` and `src/site/wiring.test.tsx`. Run the dev server at
  320 and 375 px on `/`, `/cast` and `/ep/1`, and at 641, 768 and 1024 px on `/ep/1` (the hub
  header also carries the episode menu, Codex link and channels, so a fourth item can overflow
  there before it does on a phone): if the header wraps, clips or the page scrolls sideways,
  reduce `.siteLink` padding and `.site` gap in `SiteHeader.module.css` at the widths that need
  it. No menu button.
- [X] T1418 [US1] `src/site/pages/CastPage.test.tsx`: five cards in file order from the real
  `cast.json`; the three bios equal the file's paragraphs exactly; a member with `bio: []` and
  `links: []` renders no `<p>` bio, no list and no placeholder text; player role links to the
  crawler page and the non-player role is plain text; link pills have the right label, `href`,
  `target="_blank"`, `rel="noopener"`; every image has `alt` = name, `width`, `height`, and only
  the first is eager; no crawler status words appear.

**Checkpoint**: `npm run build`; `dist/cast/index.html` contains all three bios; the sitemap lists
`/cast`.

## Phase 4 - User Story 2: link straight to one person (P2)

**Goal**: `/cast#<id>` lands on the card. **Independent test**: quickstart step 6 (cold load) and 8.

- [X] T1419 [US2] `CastCard.module.css`: `scroll-margin-top` on the article = `var(--header-h)`
  (the tall 48 px state, not the compact one) + one space step. `CastPage.tsx`: a `useEffect` on
  `[location.hash, cast.length]` that, when the hash names an element on the page, calls
  `scrollIntoView()` on it. The app has no scroll handling on route change today (no
  `ScrollRestoration`, no `scrollTo` outside panels), so this effect is the only thing that moves
  the page. Two guards: skip it when the cast was seeded from the prerender payload (the browser
  has already made the native fragment jump; a second one after hydration would yank a reader who
  has started scrolling), and call it only when `typeof el.scrollIntoView === 'function'` (jsdom
  has none; same guard as `src/studio/components/EventList.tsx`). An unknown hash does nothing.
  Tests in
  `CastPage.test.tsx`: each of the five ids is an element id; arriving with `#sarah` calls
  `scrollIntoView` on Sarah's card; `#nobody` calls nothing and does not throw.

## Phase 5 - User Story 3: from a crawler to their player (P2)

**Goal**: the crawler-page credit has a face and leads to the card. **Independent test**:
quickstart step 7.

- [X] T1420 [US3] `src/site/pages/CrawlerPage.tsx` + `CrawlerPage.module.css`: the credit becomes
  a row of the player's credit photo (`<img src={asset(player.photo.credit)} alt="" width={40}
  height={40} loading="eager">`, round or `--radius-sm`; `alt=""` because the name is right beside
  it) and "Played by " + `<Link to={castAnchor(player.id)}>` on the name; delete `.creditDetail`.
  Update `CrawlerPage.test.tsx`: each fixture crawler shows the right name, photo `src` and
  `/cast#<id>` href; no pronouns/bio/link row; a crawler nobody plays renders no credit. Confirm
  `/crawlers` (`RosterCard`) is unchanged.

## Phase 6 - User Story 4: the author fills in the gaps later (P3)

**Goal**: content changes are JSON-only and mistakes are caught. **Independent test**: quickstart
"Change the content later" and "Prove the lint bites".

- [X] T1421 [US4] `README.md`: a "The cast page" section (where the file is, how to add a bio
  paragraph, a link and its kinds, a photo and its two sizes and budgets, reordering,
  `npm run lint:cast`). Also correct what the README already says about players: remove the
  `player` row from the `crawlers.json` field table (near line 175) and the two `player.*` items
  from the reproduced todo list (near lines 341-342), pointing both at `cast.json`. Then run quickstart's "Prove the lint bites" (set Madio's `crawlerId` to
  `harry`, expect two errors, revert) and, in the dev server, add a two-paragraph bio and one link
  to Lulu, see both render, revert.

## Phase 7 - Governance and gates

- [X] T1422 `.specify/memory/constitution.md` -> 1.5.2 (PATCH, Last Amended 2026-11-17): add a
  Sync Impact line at the top; in Principle VIII add `/cast` to the route list and make the first
  bullet read "`show.json`, `crawlers.json` and `cast.json`". `CLAUDE.md` already points at 014.
- [X] T1423 Gates. `npm run typecheck && npm run lint && npm test && npm run build`. Then, on
  `npm run preview`: every step of quickstart "Check it" at 375 and 1440 px, including the
  JavaScript-off pass; screenshots of `/cast` (375, 1440) and one crawler page credit; axe on
  `/cast` and `/crawlers/ronald` with zero violations; Lighthouse mobile on `/cast` compared with
  `/community` (SC-006); `ls -l public/img/cast` against the budgets (SC-005). Record results and
  anything left over at the bottom of this file, as 011 and 012 did.

## Dependencies

- T1401 -> T1404 (paths) -> T1406's real-file test, T1408.
- T1402 -> T1405 -> T1410 -> T1411. T1409 needs T1402 only.
- Phase 2 -> every story. US1 (T1412 -> T1413/T1414 -> T1415 -> T1418; T1416, T1417 any time
  after T1412) is the MVP.
- US2 needs T1415. US3 needs T1401, T1409, T1411 and (for the link to land) T1415. US4 needs US1.
- T1422 any time; T1423 last.

## Parallel opportunities

- Phase 2: T1403, T1404, T1406, T1408 touch different files; T1401 can run beside T1402.
- US1: T1413 and T1416 beside T1414.
- After US1: US2 (T1419) and US3 (T1420) touch different files and can run together.

## Strategy

Ship order is the phase order. After Phase 3 the site already has a complete, correct cast page;
Phases 4-6 are each one task and independently checkable. Do not start the gates (T1423) with any
`[ ]` above it.

## Results (Wave B, 2026-11-17)

**Gates**: `npm run typecheck` clean, `npm run lint` clean, `npm test` 108 files / 1729 tests
green, `npm run build` green (prerender writes 9 pages including `/cast`; sitemap lists 9 routes
including `/cast`). `dist/cast/index.html` carries all five `<article id>` (lulu, madio, danny,
sarah, bastion) and all three bios (four paragraphs) in the server HTML; title "Cast · Dungeon
Crawl Cast", canonical `/cast`, `og:image` the shared `/og/site.png`. `npm run lint:cast` passes.

**Nav (T1417), measured with puppeteer-core + system Chrome on `npm run dev`**: at 320 and 375 px
on `/`, `/cast`, `/ep/1`, and at 641, 768, 1024 and 1440 px on `/ep/1`, the four links share one
`offsetTop`, none is clipped, header stays 48 px. A 1 px sweep from 300 to 1500 px found one
header overflow: on `/ep/1` from 641 to 737 px the right cluster ran up to 46 px past the edge
(the brand's title and pill, the Codex link and the show channels all return at 641 px). Tighter
`.siteLink` padding and no `.site` gap only bought back 10 px (the header grid splits the shortfall
between the brand and the right cluster; even zero padding left about 25 px), so the fix
**deviates from the task**: `SiteHeader.module.css` hides the decorative "System feed" pill at
641-760 px, the same treatment the phone block already gives it. After that the sweep is clean
from 326 to 1500 px on `/ep/1` and from 300 to 1500 px on `/`, `/watch`, `/cast`, `/community`,
`/crawlers/ronald`. No menu button.
- Not fixed, already there before 014 and unrelated to the nav: `/ep/1` at 300-324 px scrolls
  sideways by 1-4 px because a hidden timeline-marker tooltip (`Timeline` `.tooltip`, "Achievement
  at 8:58") pokes past the edge. Removing the Cast link does not change it; hiding the tooltips
  does. It is in the hub, so it is out of this feature's scope.

**Quickstart "Check it" on `npm run preview`, 375 and 1440 px** (`vite preview` only serves the
prerendered file at `/cast/`, with a trailing slash, as for every route; checks used that form):
1. Nav Watch / Crawlers / Cast / Community on one line, no sideways scroll on `/`, `/watch`,
   `/crawlers`, `/cast`, `/community` and all four crawler pages. Pass.
2. Five cards in order; Lulu's and Bastion's show only photo, name, role and pronouns. Pass.
3. Bios match the file (and the file matches FR-014; covered by `CastPage.test.tsx`). Pass.
4. "Plays Ronald Hudson" -> `/crawlers/ronald` (all four roles link correctly); "The System AI" is
   plain text. Pass.
5. Pills: Madio "Links", Danny "Links", Sarah "Instagram"; `target=_blank`, `rel=noopener`. Pass.
6. Cold `/cast/#sarah`: card top at 64 px (header 48 + 16). From `/crawlers/veil`, clicking
   "Sarah" lands on `/cast#sarah` with the card at 64 px. Pass, **after a fix** (below).
7. Each crawler page shows the 40 px headshot + "Played by {name}" linking to `/cast#<id>`, with no
   pronouns, bio or link row. Pass.
8. JavaScript off: `/cast/` has all 5 cards, 14 paragraphs and 3 pills, with no sideways scroll, and
   `/cast/#danny` jumps to Danny. **But** the card lands at 0 px, under the 48 px header, not at its
   scroll margin, and the page is unstyled apart from the shell: prerendered pages link only the
   entry CSS (`index-*.css`), and each page's own chunk CSS (`CastPage`, `page`, `SocialRow`...)
   arrives with JavaScript. `/community` and every other marketing page behave the same, so this
   came with 011's prerender. Left as is (fixing it means teaching `scripts/prerender.mjs` to
   link chunk CSS).
9. `ls -l public/img/cast`: cards 13.9, 19.5, 28.8, 38.1, 38.3 kB (all <= 45 kB, 138.6 kB total
   against the 225 kB budget); credits 1.6-2.9 kB (all <= 8 kB). Pass.

**Two findings the browser pass turned up, and what changed for them**:
- The `castSeeded` guard as first written (skip the scroll whenever the cast came from the payload)
  broke the main US3 path: the cast stays seeded for the whole visit, so a client-side hop from a
  prerendered crawler page never scrolled. The page now skips only on the history entry the
  document was loaded with (`location.key === 'default'`).
- On every prerendered marketing page (`/`, `/watch`, `/community`, `/crawlers/ronald`, `/cast`),
  React discards the server markup inside `<main>` about 50 ms after load and client-renders it
  about 250 ms later (traced with a MutationObserver: the `<!--$-->` Suspense boundary's content is
  removed, then re-added). That throws away the browser's native fragment jump, so a cold
  `/cast#sarah` ended at the top. **Deviation**: the native jump now counts only if the card is
  actually sitting at its scroll margin; otherwise the effect scrolls. Tests cover a seeded page
  that landed (no scroll), one that did not (scroll), a client-side arrival with a seeded cast
  (scroll), a fetched cast (scroll), `#nobody` (nothing) and jsdom with no `scrollIntoView`. The
  hydration fallback itself came with 011 and is left for its own fix.

**Screenshots** (in the session scratchpad, not the repo): `cast-375.png`, `cast-1440.png`
(full page), `crawler-ronald-375.png`, `crawler-ronald-1440.png`, `credit-ronald-375.png`,
`credit-ronald-1440.png`, `cast-375-nojs.png`, `lulu-edit-375.png`. Reading them turned up one
fix: on a phone, a card with no bio had 31 px under the photo against 16 px above it (the empty
body grid row still took the row gap). The gap now lives on `.body`, so it exists only when the
body does; padding measures 17/17 px at 375 and 25/25 px at 1440 on all five cards.

**axe** (axe-core 4.13.0 from the local npx cache, injected by puppeteer; not added to
`package.json`), WCAG 2.0/2.1 A + AA + best-practice at 375 px: `/cast` 0 violations,
`/crawlers/ronald` 0, `/community` 0.

**Lighthouse mobile** (11.7.1 from the npx cache; the cached 13.x needs a newer Node than 20.9),
`npm run preview`, two runs each:
| Page | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/cast` | 90, 93 | 100 | 100 | 100 | 2.5 s, 1.5 s | 3.2 s | 0 ms | 0 |
| `/community` | 93, 93 | 100 | 100 | 100 | 1.5 s, 1.7 s | 3.1 s | 0 ms | 0 |
SC-006: on par (the first `/cast` run was a cold start; the second matches).

**T1421 by hand**: setting Madio's `crawlerId` to `harry` makes `npm run lint:cast` exit 1 with
exactly two errors ("madio: crawlerId "harry" is not a crawler in crawlers.json." and "ronald: has
no player in cast.json."). In the dev server, a two-paragraph bio and a Bluesky link on Lulu both
render (`lulu-edit-375.png`). Both edits reverted; `git diff --stat public/data` is empty.

**Left over**: the hydration fallback on marketing pages, chunk CSS for JavaScript-off readers,
and the hub's 1 px tooltip overflow at 320 px (all above, all from before 014).

## Follow-up fixes (2026-11-18, same branch)

Two of the leftovers above are fixed; the notes above describe the state before these commits.

- **Hydration fallback** (`fix(site): load a prerendered route's chunks before hydrating`):
  `src/main.tsx` awaits `preloadRoute(route)` before `hydrateRoot`. Measured on `vite preview`:
  `<main>` on `/cast` and `/community` used to empty at about 45 ms and refill at about 280 ms; it
  is now never emptied.
- **Chunk CSS** (`fix(site): link each prerendered route's stylesheets in its HTML`): the client
  build writes a Vite manifest, `scripts/prerender.mjs` (`assetsFor`) links the route's
  stylesheets and preloads its chunks, and `scripts/postbuild.mjs` deletes the manifest. Measured
  at 375 px on all six route shapes, scripts on and off: styled, no duplicate stylesheet links, no
  console errors, no sideways scroll; `/cast/#danny` lands at 64 px in both modes.

Still left over: the hub's 1-4 px tooltip overflow on `/ep/1` below 325 px.

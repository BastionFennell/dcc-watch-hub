# Tasks - 014 cast page

Read first: `spec.md` (FR-014 holds the exact bios), `plan.md`, `research.md`, `data-model.md`,
`contracts/cast.schema.json`, `quickstart.md`. Ids continue the repo's `T<feature><nn>` scheme.
`[P]` = can run alongside its neighbours (different files, no unfinished dependency).
Every phase ends with `npm run typecheck && npm run lint && npm test` green.

## Phase 1 - Setup (assets)

- [ ] T1401 Prepare the ten photos in `public/img/cast/` per research R3. For each of `lulu`
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

- [ ] T1402 `src/data/types.ts`: add `CAST_LINK_KINDS`, `CastLinkKind`, `CastLink`, `CastMember`,
  `CastFile` exactly as in data-model.md; add `cast?: unknown` to `Embedded`; delete
  `CrawlerPlayer` and `CrawlerProfile.player`.
- [ ] T1403 [P] `specs/011-front-door/contracts/crawlers.schema.json`: remove `player` from
  `required` and `properties`; extend the top `comment` with "Amended by 014: the player moved to
  cast.json".
- [ ] T1404 [P] Author `public/data/cast.json` per data-model.md: order lulu, madio, danny, sarah,
  bastion; names, pronouns, `crawlerId` (mimi, ronald, xo, veil) / `role` ("The System AI"),
  photo paths from T1401, links from the spec's FR-014 table; bios copied character for character
  from spec FR-014 (Madio one paragraph, Sarah two, Danny one, Lulu and Bastion `[]`); `todo`
  as in data-model.md. In `public/data/crawlers.json` remove every `player` object and the two
  `player.*` todo lines.
- [ ] T1405 `src/data/roster.ts`: delete `toPlayer` and the player requirement in
  `toCrawlerProfile`; add `validateCast(raw): CastFile` (lenient, never throws, rules in the
  data-model "Runtime" column, `console.warn` naming the member id) and `fetchCast()` (URL
  `/data/cast.json` via `joinBase(siteBaseUrl(), ...)`; fetch failure, non-OK or bad JSON ->
  `{ cast: [] }`, like `fetchStatus`). Tests in `src/data/validate.test.ts` beside the
  `validateCrawlers` ones: each lenient rule, plus "a crawler with no player field is kept".
- [ ] T1406 [P] `scripts/cast.ts`: pure `lintCast(castRaw, crawlersRaw, fileSize): string[]`
  implementing every row of the data-model "Lint" column, including the photo budgets (the third
  argument is a `fileSize(path): number | null` probe: `null` = missing, card > 45 kB or credit
  > 8 kB = error, so a later photo swap cannot break SC-005 silently); each message starts with the member id
  (or the crawler id for "has no player" / "has more than one player"). `scripts/cast.test.ts`:
  one failing case per rule, a clean case, and a test that runs it over the real
  `public/data/cast.json` + `crawlers.json` with `statSync` sizes under `public/` and expects `[]`
  (so it needs T1401 and T1404 done).
- [ ] T1407 `scripts/lint-cast.ts` (tsx entry: read both files, run `lintCast`, print each error
  to stderr, `process.exit(1)` if any). `package.json`: add `"lint:cast": "tsx scripts/lint-cast.ts"`
  and change `prebuild` to `tsx scripts/build-dossier.ts && tsx scripts/lint-cast.ts`.
- [ ] T1408 [P] `src/data/samples.test.ts`: validate `public/data/cast.json` against
  `specs/014-cast-page/contracts/cast.schema.json` with the existing ajv setup; keep the
  crawlers-schema test passing against the amended schema.
- [ ] T1409 `src/site/cast.ts` (pure): `playerOf(cast, crawlerId)` and `castAnchor(id)` returning
  `/cast#<id>`; `src/site/cast.test.ts`.
- [ ] T1410 `src/data/CrawlersContext.tsx`: add `cast: CastMember[]` to the context value (default
  `[]`); seed it from `embedded.cast` through `validateCast` when the payload has it, otherwise
  `fetchCast()` in the same effect that fetches the roster (a payload with crawlers but no `cast`
  key, i.e. pre-014, also fetches). `scripts/prerender.mjs`: read `public/data/cast.json`
  (fallback `{ cast: [] }`) and add `cast` to every route's `data`. Update
  `src/data/CrawlersContext.test.tsx` (seeded: no fetch; unseeded: fetches `cast.json`; 404: empty
  cast, no error) and `scripts/prerender.test.ts`.
- [ ] T1411 Keep the tree compiling and honest after T1402: in `src/site/pages/CrawlerPage.tsx`
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

- [ ] T1412 [US1] Copy. `src/copy.ts`: `navCast: 'Cast'` beside the other nav labels.
  `src/site/copy.ts`: re-export `navCast`; add `platform.links: 'Links'`; add
  `castTitle: 'The cast'`, `castLead: 'The people behind the crawlers, and the voice of the System.'`,
  `castDescription: 'Meet the cast of Dungeon Crawl Cast: the four players behind the crawlers and the voice of the System.'`,
  `castPlays: (characterName: string) => \`Plays ${characterName}\``,
  `castLinksLabel: (name: string) => \`${name}'s links\``.
- [ ] T1413 [P] [US1] `src/site/components/CastLinks.tsx`: props `{ links: CastLink[]; label: string }`;
  returns `null` for an empty list; a `<ul aria-label={label}>` of pills in authored order using
  the `.row` / `.link` classes from `SocialRow.module.css`; each `<a target="_blank"
  rel="noopener" onClick={() => trackOutbound(kind)}>` labelled `siteCopy.platform[kind]`.
- [ ] T1414 [US1] `src/site/components/CastCard.tsx` + `CastCard.module.css`: props
  `{ member: CastMember; profile?: CrawlerProfile; eager?: boolean }`. `<article id={member.id}>`
  with an `<h2>` name; `<img src={asset(member.photo.card)} alt={member.name} width={480}
  height={480} loading={eager ? 'eager' : 'lazy'}>`; role line = `<Link to={/crawlers/<id>}>` with
  `siteCopy.castPlays(profile.characterName)` when `member.crawlerId` and `profile` are both
  present, `member.role` as plain text otherwise, nothing when neither applies; pronouns when
  present; one `<p>` per bio paragraph only when `bio.length > 0`; `<CastLinks>` only when
  `links.length > 0`. Layout per plan: phone = 96 px photo beside name/role/pronouns, bio and
  links below; >= 640 px = 200 px photo column, text right. Existing tokens only; no System box.
- [ ] T1415 [US1] `src/site/pages/CastPage.tsx` + `CastPage.module.css`, modelled on
  `CommunityPage.tsx`: `<Seo title={siteCopy.pageTitle(siteCopy.navCast)}
  description={siteCopy.castDescription} canonicalPath="/cast" ogImage={siteCopy.ogSiteImage}>`,
  the shared page head (eyebrow, `<h1>`, lead), one `CastCard` per `cast` entry in order (first
  one `eager`, `profile` looked up in `profiles` by `crawlerId`), `SiteFooter`. One column of
  cards at every width, measure about 720 px. Default export. Register in
  `src/site/pages/lazy.tsx` (`CastPage`), `src/site/pages/preload.ts` (`PRELOADABLE`) and
  `src/App.tsx` (`<Route path="/cast">` between `/crawlers/:id` and `/community`).
- [ ] T1416 [P] [US1] `scripts/prerender.mjs`: `STATIC_ROUTES = ['/', '/watch', '/crawlers',
  '/cast', '/community']`. Update `scripts/prerender.test.ts` and `scripts/sitemap.test.ts`.
- [ ] T1417 [US1] Nav: add the Cast `NavLink` between Crawlers and Community in
  `src/components/SiteHeader/SiteHeader.tsx` and the Cast link in
  `src/site/components/SiteFooter.tsx`; update the header's doc comment and add `/cast` to the
  route lists in `src/components/SiteHeader/SiteHeader.test.tsx`,
  `src/site/components/SiteChrome.test.tsx` and `src/site/wiring.test.tsx`. Run the dev server at
  320 and 375 px on `/`, `/cast` and `/ep/1`, and at 641, 768 and 1024 px on `/ep/1` (the hub
  header also carries the episode menu, Codex link and channels, so a fourth item can overflow
  there before it does on a phone): if the header wraps, clips or the page scrolls sideways,
  reduce `.siteLink` padding and `.site` gap in `SiteHeader.module.css` at the widths that need
  it. No menu button.
- [ ] T1418 [US1] `src/site/pages/CastPage.test.tsx`: five cards in file order from the real
  `cast.json`; the three bios equal the file's paragraphs exactly; a member with `bio: []` and
  `links: []` renders no `<p>` bio, no list and no placeholder text; player role links to the
  crawler page and the non-player role is plain text; link pills have the right label, `href`,
  `target="_blank"`, `rel="noopener"`; every image has `alt` = name, `width`, `height`, and only
  the first is eager; no crawler status words appear.

**Checkpoint**: `npm run build`; `dist/cast/index.html` contains all three bios; the sitemap lists
`/cast`.

## Phase 4 - User Story 2: link straight to one person (P2)

**Goal**: `/cast#<id>` lands on the card. **Independent test**: quickstart step 6 (cold load) and 8.

- [ ] T1419 [US2] `CastCard.module.css`: `scroll-margin-top` on the article = `var(--header-h)`
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

- [ ] T1420 [US3] `src/site/pages/CrawlerPage.tsx` + `CrawlerPage.module.css`: the credit becomes
  a row of the player's credit photo (`<img src={asset(player.photo.credit)} alt="" width={40}
  height={40} loading="eager">`, round or `--radius-sm`; `alt=""` because the name is right beside
  it) and "Played by " + `<Link to={castAnchor(player.id)}>` on the name; delete `.creditDetail`.
  Update `CrawlerPage.test.tsx`: each fixture crawler shows the right name, photo `src` and
  `/cast#<id>` href; no pronouns/bio/link row; a crawler nobody plays renders no credit. Confirm
  `/crawlers` (`RosterCard`) is unchanged.

## Phase 6 - User Story 4: the author fills in the gaps later (P3)

**Goal**: content changes are JSON-only and mistakes are caught. **Independent test**: quickstart
"Change the content later" and "Prove the lint bites".

- [ ] T1421 [US4] `README.md`: a "The cast page" section (where the file is, how to add a bio
  paragraph, a link and its kinds, a photo and its two sizes and budgets, reordering,
  `npm run lint:cast`). Also correct what the README already says about players: remove the
  `player` row from the `crawlers.json` field table (near line 175) and the two `player.*` items
  from the reproduced todo list (near lines 341-342), pointing both at `cast.json`. Then run quickstart's "Prove the lint bites" (set Madio's `crawlerId` to
  `harry`, expect two errors, revert) and, in the dev server, add a two-paragraph bio and one link
  to Lulu, see both render, revert.

## Phase 7 - Governance and gates

- [ ] T1422 `.specify/memory/constitution.md` -> 1.5.2 (PATCH, Last Amended 2026-11-17): add a
  Sync Impact line at the top; in Principle VIII add `/cast` to the route list and make the first
  bullet read "`show.json`, `crawlers.json` and `cast.json`". `CLAUDE.md` already points at 014.
- [ ] T1423 Gates. `npm run typecheck && npm run lint && npm test && npm run build`. Then, on
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

# Research - 014 cast page

No open clarifications; these are the decisions the plan rests on.

## R1 - Where the people live
- **Decision**: a new `public/data/cast.json`; each member optionally names a `crawlerId`.
  `crawlers.json` loses `player` entirely.
- **Rationale**: Bastion has no crawler, so people cannot hang off crawlers. Keeping a `player`
  stub on the crawler as well would state the same fact twice and let the two disagree.
- **Alternatives**: a `cast` array inside `crawlers.json` (no new fetch, but the file is "the
  roster of characters" in every comment, schema and test, and its todo list is about characters);
  `castId` on the crawler (reference in the other direction: needs a second lookup for the role
  line and still leaves Bastion special).

## R2 - Validation
- **Decision**: lenient runtime validator in `src/data/roster.ts` + strict `lintCast` in
  `scripts/cast.ts`, run by a vitest test and by `prebuild`. JSON Schema in `contracts/` checked
  by `src/data/samples.test.ts` with the existing ajv setup.
- **Rationale**: this is exactly how the dossier (012) splits it; the page never white-screens on
  a typo, and a typo never ships.
- **Lint rules** (FR-011): ids unique and `^[a-z0-9-]+$`; exactly one of `crawlerId` / `role`;
  `crawlerId` exists in `crawlers.json`; every crawler has exactly one member; `photo.card` and
  `photo.credit` exist under `public/`; link `kind` is known; link `url` starts with `https://`;
  pronouns match `^[a-z]+(/[a-z]+)+$`; bio paragraphs are non-empty strings.
- **Alternatives**: schema only (cannot express the crawler cross-reference or file existence).

## R3 - Photos
- **Decision**: WebP, two files per person: `<id>.webp` 480x480 (card, shown at up to 200 CSS px,
  so 2x is covered) and `<id>-sm.webp` 96x96 (credit, shown at 40 px). Crop with `sips`
  (`--cropOffset` + `-c`), resize with `sips -Z`, encode with `cwebp -q 80` (present at
  `/opt/homebrew/bin/cwebp`). Lower `-q` until under budget. Committed; originals stay in
  `~/Downloads`.
- **Rationale**: photographs, not line art: WebP is roughly a third smaller than JPEG at the same
  quality and is supported by every browser the site targets. Hand-prepared like the crawler busts,
  so the build gains no image tooling.
- **Fallback**: if `cwebp` is missing, `sips -s format jpeg -s formatOptions 70` and `.jpg` paths;
  the data file carries explicit paths, so nothing else changes.
- **Sources** (all portrait except Lulu's square): Madio `20261003_163615.jpg` 2544x3180; Sarah
  `IMG_5919.jpg` 2160x2880; Lulu `img_1_1791845091930.jpg` 1160x1160; Danny `IMG_0575.jpg`
  2160x2880; Bastion `Bastion_and_Margruite_Edited-0092.jpg` 2667x4000 (the face is in the top
  third; crop a square of about 1500 px around it, not the centre).
- **Crop rule**: face centred horizontally, eyes about 40% from the top, a little shoulder. Read
  each result back before committing (the busts in 008 needed hand tuning too).

## R4 - Links
- **Decision**: `links: [{ kind, url }]`, kinds = the five platforms in `siteCopy.platform` plus
  `links` (label "Links"). New `CastLinks` component; `SocialRow` is left alone.
- **Rationale**: `SocialRow` takes a `ShowLinks` object and a fixed platform order; cast links are
  an ordered list that may repeat a kind and includes one the show does not have. Bending
  `SocialRow` to both shapes costs more than a 30-line sibling that shares its pill styles.
- **`rel`**: `noopener` only. `rel="me"` on the show's site would claim the show *is* that person.

## R5 - Anchors and client navigation
- **Decision**: native fragment navigation for cold loads (the id is in the prerendered HTML);
  one `useEffect` in `CastPage` keyed on `location.hash` + the cast length that calls
  `scrollIntoView()` for client-side arrivals only (skipped when the cast came from the prerender
  payload, so hydration never jumps a second time). `scroll-margin-top: var(--header-h)` plus a
  space step on the card. The app has no route-change scroll handling to cooperate with (checked
  2026-11-17).
- **Rationale**: react-router does not scroll to a hash on its own, and the page is a lazy chunk,
  so the element does not exist when the navigation commits.

## R6 - Nav
- **Decision**: "Cast" between "Crawlers" and "Community" in header and footer. Label in
  `src/copy.ts` beside the other three.
- **Check**: at 375 and 320 px the header is mark + four links at `padding: 0 var(--space-4)`,
  `--text-xs`. If it overflows, reduce link padding / nav gap inside the existing
  `@media (max-width: 640px)` block. No hamburger.

## R7 - What does not change
- OG: `/cast` uses `siteCopy.ogSiteImage`; `scripts/og.mjs` is untouched.
- JSON-LD: none for people in this feature.
- The hub's `party[].player` strings in episode files and `copy.playedBy` in `src/copy.ts`.
- `/crawlers` roster cards (they never showed the player).

# Feature 012 - "Where are they now?" (the crawler dossier)

Source: the author's spec "Where are they now - gated status section on crawler pages"
(2026-09-25, reproduced in `brief.md`), adopted with the adjustments in "Deviations". The brief's
invariant is the feature: **absence must never be a signal**. Constitution 1.5.0 (Principle VIII +
the storage rule) encodes it.

## What it is
A full-width panel under the entry achievement on `/crawlers/:id`: a header, a spoiler banner, a
status strip (Level / Condition / Last on camera), one locked row per **aired** episode in
ascending order, and a footer with a hidden-count and one bulk control. Every card starts locked;
the reader reveals cards one at a time, or all at once with "Reveal all - I'm caught up". Reveals
persist per browser.

## Content model (authored) - `content/status/<id>.json` (repo root, NOT served)
```json
{ "id": "harry",
  "updates": [
    { "episode": 1, "kind": "update", "onCamera": true,
      "title": "<= 60 chars, present tense", "body": "1-3 sentences, present tense, System voice",
      "chips": ["<= 3 short mono facts"], "level": 1, "condition": "alive" }
  ] }
```
- `condition`: `alive | deceased`; sticky (a `deceased` card may not be followed by `alive`; the
  lint fails the build).
- `floor` is NOT authored; it comes from `show.json`.
- `level: null` means "derive from the hub reducer at the end of that episode".
- A missing entry for an aired episode becomes an **auto quiet card** (see build); an authored
  `kind: "quiet"` card may override its text.
- Cards for episodes not yet aired (`hubLiveAt` in the future at build time) are dropped at build
  and never reach the bundle or the served JSON.

## Build - `scripts/build-dossier.ts` (tsx), run by `predev` and inside `postbuild` before prerender
For each crawler in `crawlers.json`: read `content/status/<id>.json` (absent = empty), take the aired
episodes from `show.json` (past `hubLiveAt`, ascending), and emit `public/data/dossier/<id>.json`
(gitignored; copied to `dist/` by Vite) as
`{ id, generatedAt, updates: DossierCard[] }` with
`DossierCard = { episode, floor, kind, onCamera, title, body, chips, level, condition }`.
- Auto quiet card: `kind: 'quiet'`, `onCamera: false`, title `Off camera this episode`, body
  `{characterName} sits this one out. No status change.`, chips `[]`, `level` = reducer level at
  the end of that episode, `condition` = previous card's condition (or `alive`). Strings from
  `src/site/copy.ts` via a shared module both the script and the component import.
- Chips: authored as given; when `level` was `null` the derived level fills it.
- **Lint (fails the build)**: for every crawler, exactly one card per aired episode, ascending, no
  gaps, no duplicates; `condition` sticky; titles <= 60 chars; chips <= 3; an authored card for an
  unaired episode is allowed on disk but reported and dropped; an authored episode id that does not
  exist in `show.json` fails. The same lint runs as a vitest test over `content/status/*.json`.
- Also embedded into the prerender payload (`__DCC__.dossier[id]`) so the locked panel prerenders
  with the right number of rows and the client fetches nothing extra.

## Derivation (client, pure, tested)
From the set of **revealed** cards only: `level` = last revealed non-null level in episode order;
`condition` = `deceased` if any revealed card is `deceased`, else `alive`; `lastOnCamera` =
highest revealed episode with `onCamera`, else none. Never from the full list.

## Reveal store - `dcc.reveals.v1`
`{ v: 1, revealed: Record<id, number[]>, caughtUpThrough: number }`. A card is open when its
episode is listed for that crawler OR `episode <= caughtUpThrough`. "Reveal all - I'm caught up"
sets `caughtUpThrough` to the highest aired episode; "Hide everything again" resets both for that
crawler and sets `caughtUpThrough` to 0. All access in try/catch with an in-memory fallback.
Prerender and first client render are always fully locked; the store is applied after mount.

## Component - `src/site/components/Dossier/`
Header: mono eyebrow `SYSTEM FEED · CRAWLER DOSSIER`; h2 from the crawler's first pronoun
(`he` -> "Where is he now?", `she` -> "Where is she now?", else "Where are they now?"); sub-line
"Every card starts hidden." Banner: `⚠ SPOILERS · ONE CARD PER EPISODE` left, "Click a card to
reveal it. Your choices are remembered." right. Strip: three cells; unrevealed values are grey
pills, not text. Rows: locked row = whole row is a `role="button"` `tabindex=0`
`aria-expanded=false` with `aria-label="Reveal the Episode N status update"` (never content);
left column `EP N` + `LOCKED`, two placeholder bars, `REVEAL` pill right; hover lifts the row and
turns the pill amber; Enter/Space/click swaps in the card (tag column shows `UPDATE` / `QUIET`,
title, body, chips) fading 250 ms unless reduced motion; focus moves to the card's heading
(`tabindex=-1`). Footer: "{n} updates hidden" left; bulk control right. <= 560 px: strip single
column, tag column stacks above the body. Row hit area >= 44 px.
Launch state (no aired episodes): header + one line "The System files its first report after
Episode 1." and nothing else.

## Leak prevention
No status content in title, meta, og:*, JSON-LD, URL, or the DOM before reveal. Locked markup is
byte-identical across crawlers apart from name and id (snapshot test). No locked-state string or
label contains `deceased|death|final|killed|memorial` (test). Remove the hero status pill and the
roster `status` field/chips (condition lives only in revealed cards). Bios and cards stay present
tense. Portraits are never desaturated or regrouped.

## Deviations from the brief (agreed 2026-09-25)
- Quiet cards are generated when not authored; level chips derive from the reducer.
- "Aired" = past `hubLiveAt`; unaired cards never ship.
- Hero status pill and `crawlers.json.status` are removed; `pronoun` comes from the existing
  `pronouns` field, not a new one.
- Storage exception written into the constitution (1.5.0).
- The deploy workflow gains a weekly schedule so "aired" advances without a push.

## Acceptance
The brief's six criteria, plus: build fails on a lint error; a crawler with an empty content file
gets one auto quiet card per aired episode; the launch state renders with zero aired episodes;
prerendered HTML for two crawlers differs only in name/id inside the panel.

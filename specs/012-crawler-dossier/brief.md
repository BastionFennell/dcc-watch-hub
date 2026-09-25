# Author's brief - "Where are they now" (2026-09-25)

Reproduced verbatim except for dashes (repo rule: hyphens only). See `spec.md` for what was
adopted and what changed.

## Context
dungeoncrawlcast.com is a Vite + React SPA with CSS-module styling. Crawler pages live at
/crawlers/:slug for harry, mimi, ronald, xo, veil. Episodes live at /ep/:n and are grouped by floor
on /watch. Each crawler page currently shows portrait, archetype eyebrow, name, handle, player
credit, and a single blue "Achievement unlocked" card.

We're adding a per-episode status feed to each crawler page so fans can get ongoing detail
without being spoiled. A working visual prototype was injected into /crawlers/harry during design;
treat the screenshots as the reference and this document as the source of truth. All hex values in
the prototype were hardcoded - use the existing design tokens and CSS-module conventions instead,
and check whether GatedCta is already a reusable gate primitive before writing a new one.

## The one invariant
Absence must never be a signal. If a crawler dies in Episode 9, their page must not go quiet after
Episode 9, because a short card list is itself a spoiler. Therefore: every crawler has exactly one
status card for every aired episode, forever. Episodes a crawler didn't appear in get a real card
that says so, and that same "off camera" card type appears routinely on living crawlers so it can
never be read as a tell. After a death the cards keep coming and simply change subject - the
estate, the legacy item, reruns, merch. This rule is the feature. Everything else is presentation.

## Data model
```ts
type Condition = 'alive' | 'deceased';
interface StatusUpdate {
  episode: number;          // must exist in the episode index
  floor: number;
  kind: 'update' | 'quiet'; // 'quiet' = no screen time, still a real card
  onCamera: boolean;
  title: string;            // <= 60 chars, present tense
  body: string;             // 1-3 sentences, present tense
  chips: string[];          // 0-3 short monospace facts
  level: number | null;     // last known level as of this episode
  condition: Condition;     // sticky: once 'deceased', never back to 'alive'
}
interface CrawlerStatus {
  slug: string;
  pronoun: 'he' | 'she' | 'they';
  updates: StatusUpdate[];  // ascending, one per aired episode, no gaps
}
```
The status strip is derived only from the set of cards the reader has revealed, never from true
current state. Level is the last revealed non-null level; condition is deceased if any revealed
card is deceased, otherwise alive; "Last on camera" is the highest revealed episode with
onCamera: true, falling back to a dash. Deriving condition from only the most recent revealed card
showed "Alive" next to a posthumous merch update. Accumulate, and make death sticky.

This data also becomes the single source of truth for the level badges on /crawlers.

## Component
Rendering below the achievement card, full width, inside main. Header uses the site's monospace
eyebrow (SYSTEM FEED · CRAWLER DOSSIER), an h2 reading "Where is he now?" / "Where is she now?" /
"Where are they now?" driven by pronoun, and a sub-line explaining that everything starts hidden. A
warning banner sits at the top of the panel: ⚠ SPOILERS · ONE CARD PER EPISODE on the left, and
the affordance hint "Click a card to reveal it. Your choices are remembered." on the right.

Below that is the status strip (Level, Condition, Last on camera) where every unrevealed value
renders as a grey pill rather than text, then one row per episode in ascending order, then a
footer.

A locked row is the entire clickable target, not just the chip: episode tag and LOCKED in the left
column, two placeholder bars, and a REVEAL pill on the right. Hover lifts the row background and
turns the pill amber. Clicking or pressing Enter/Space replaces the row in place with the revealed
card - kind in the tag column, title, body, chips - fading in over ~250ms, suppressed under
prefers-reduced-motion. Reveals are independent and non-sequential.

The footer shows the count of hidden updates on the left, and on the right a single bulk control:
"Reveal all - I'm caught up" when nothing is open, flipping to "Hide everything again" once
something is. There is no dropdown and no "change how far I've watched" link.

## Reveal persistence
Store under a versioned key, e.g. dcc.reveals.v1, holding per-slug revealed episode arrays plus a
global caughtUpThrough: number watermark set by the bulk control. On mount, a card is open if it's
explicitly revealed for that slug or its episode is <= caughtUpThrough. Wrap all storage access in
try/catch and fall back to in-memory state.

## Accessibility
Locked rows are role="button" with tabindex="0", aria-expanded="false", and a deliberately neutral
label: aria-label="Reveal the Episode 9 status update". Never describe the content in the label.
After a reveal, move focus to the revealed card's heading (tabindex="-1"). Hit areas need a minimum
44px height on touch. Under roughly 560px the strip drops to a single column and the tag column
stacks above the card body.

## Leak prevention outside the component
Keep status content out of meta[name=description], all og:* tags, any JSON-LD, page titles, and URL
fragments or query params. Do not render revealed content into the DOM before reveal. Locked-state
markup must be byte-identical across crawlers apart from name and slug: no distinct treatment for a
death card. Level badges on /crawlers must be gated by the same watermark or removed. Bios and card
copy stay in present tense; portraits are never desaturated, bordered in memoriam, or moved into a
"Fallen" grouping. Any feed or notification must fire for all five crawlers every episode.

## Acceptance criteria
1. A content lint that fails the build when any crawler's updates array does not contain exactly
   one entry per aired episode, with no gaps and no duplicates.
2. A snapshot test asserting that the fully-locked render of two different crawlers at the same
   episode count is identical after substituting name and slug.
3. A test asserting no locked-state markup or ARIA label contains deceased, death, final, killed,
   or memorial.
4. Condition is sticky: revealing Episodes 9 and 12 where 9 is the death and 12 is posthumous
   yields "Deceased", never "Alive".
5. Reveal state survives reload and client-side navigation between crawler pages, and degrades to
   in-memory when localStorage throws.
6. Every card is revealable by keyboard alone, and focus lands on the revealed heading.

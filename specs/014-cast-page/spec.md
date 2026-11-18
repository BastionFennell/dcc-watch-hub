# Feature 014 - The cast page

**Feature Branch**: `014-cast-page`
**Created**: 2026-11-17
**Status**: Draft
**Input**: The author supplied five headshots, three bios, pronouns and links for the people who
make the show, and asked for the best way to put them on the site (2026-11-17).

## What it is

A new front-door page, `/cast`, that introduces the five real people behind Dungeon Crawl Cast: the
four players and the person who voices the System. One card per person: headshot, name, role,
pronouns, bio in their own words, and their links. Crawler pages keep their "Played by" credit, but
it now carries a face and leads to that person's card instead of trying to hold a bio in one line.

**Why a page of its own**: the bios are paragraphs, and the crawler page's credit line was built
for two sentences; the System's voice has no crawler page at all; and a card with a stable address
(`/cast#madio`) is something each cast member can link to from their own profiles.

## User Scenarios & Testing

### User Story 1 - Meet the people who make the show (Priority: P1)

A visitor opens `/cast` from the site navigation and reads who the cast are: a photo, a name, what
they do on the show, their pronouns, a bio and where to find them.

**Why this priority**: this is the feature. Everything else hangs off these five cards.

**Independent Test**: open `/cast` on a 375 px phone with scripts disabled; all five people are
there, in order, with everything the author supplied.

**Acceptance Scenarios**:

1. **Given** the site navigation, **When** the visitor chooses "Cast", **Then** `/cast` opens and
   shows five cards in the authored order: Lulu, Madio, Danny, Sarah, Bastion.
2. **Given** a member with a bio (Madio, Sarah, Danny), **When** their card renders, **Then** it
   shows headshot, name, role, pronouns, every paragraph of the bio and their links.
3. **Given** a member with no bio and no links yet (Lulu, Bastion), **When** their card renders,
   **Then** it shows headshot, name, role and pronouns and nothing else: no placeholder text, no
   empty link row, no "coming soon".
4. **Given** a member who plays a crawler, **When** their card renders, **Then** the role reads
   "Plays {character name}" and links to that crawler's page; Bastion's role reads "The System AI"
   and links nowhere.
5. **Given** a 375 px viewport, **When** the page renders, **Then** it is a single column with no
   horizontal scroll, and the navigation (now four items) still fits on one line.
6. **Given** the page's HTML as served, **When** scripts never run, **Then** all names, roles,
   bios and links are present in it.

---

### User Story 2 - Link straight to one person (Priority: P2)

A cast member puts `…/cast#madio` in their own bio. Someone following it lands on Madio's card.

**Why this priority**: it is what makes the page useful to the cast themselves, and it is what the
crawler-page credit (Story 3) points at.

**Independent Test**: load `/cast#sarah` cold; Sarah's card is at the top of the viewport, clear of
the site header.

**Acceptance Scenarios**:

1. **Given** `/cast#<id>` for any of the five ids (`lulu`, `madio`, `danny`, `sarah`, `bastion`),
   **When** the page loads, **Then** that person's card is scrolled into view and not hidden under
   the header.
2. **Given** `/cast#nobody`, **When** the page loads, **Then** the page shows from the top as
   normal.

---

### User Story 3 - From a crawler to their player (Priority: P2)

A visitor on `/crawlers/ronald` sees who plays Ronald, with a face, and can go and read about them.

**Why this priority**: most visitors meet the characters first; this is the path from character to
person.

**Independent Test**: on each of the four crawler pages the credit shows the right name and
headshot and leads to the right card.

**Acceptance Scenarios**:

1. **Given** a crawler page, **When** it renders, **Then** the credit reads "Played by {name}" with
   that player's small headshot, and the name links to `/cast#<id>`.
2. **Given** a crawler page, **When** it renders, **Then** the player's pronouns, bio and links are
   no longer shown there (they live on the cast page).
3. **Given** the `/crawlers` roster, **When** it renders, **Then** it is unchanged by this feature.

---

### User Story 4 - The author fills in the gaps later (Priority: P3)

Lulu sends her bio; Sarah sends a better link; Bastion writes his own. The author edits one data
file, rebuilds, and the cards update. No code changes.

**Why this priority**: two of five bios are missing on day one, so this will happen soon, but the
page is complete without it.

**Independent Test**: add a two-paragraph bio and one link to Lulu's entry and rebuild; her card
shows both.

**Acceptance Scenarios**:

1. **Given** a member with no bio, **When** the author adds bio paragraphs and links to their entry
   and rebuilds, **Then** the card shows them with no other change.
2. **Given** an entry that is wrong (unknown crawler, duplicate id, a crawler with no player or two
   players, a missing photo file, a link that is not an `https` address), **When** the author
   builds or runs the tests, **Then** it fails with a message naming the entry and the problem.

### Edge Cases

- A bio of one short sentence and a bio of several long paragraphs both sit comfortably in the
  same card design; cards are not forced to equal height.
- A member with a bio but no links, or links but no bio, shows only what exists.
- A member with several links (a link hub plus a platform) shows them all, in authored order.
- A headshot that fails to load leaves the card readable: the name is never only in the image.
- The cast page says nothing about any crawler's fate, level or status: role lines name the
  character only. (Constitution VIII: absence is never a signal, and neither is presence here.)
- Harry and his player do not appear anywhere.

## Requirements

### Functional Requirements

**The page**

- **FR-001**: The site MUST serve a front-door page at `/cast`, prerendered like the other
  marketing routes, with its own title, description and canonical address, the site's shared social
  image, and an entry in the sitemap.
- **FR-002**: The site navigation MUST gain a "Cast" item between "Crawlers" and "Community", in the
  header and the footer, and MUST still fit one line at 375 px.
- **FR-003**: The page MUST show one card per cast member, in the order the data file lists them,
  in a single column at 375 px. Wider layouts may use more columns but MUST keep reading order.
- **FR-004**: Each card MUST show the member's headshot, name, role and pronouns, and MUST show the
  bio (as separate paragraphs) and links only when they exist. Nothing stands in for missing
  content.
- **FR-005**: The role line MUST be derived for players ("Plays {character name}", linking to the
  crawler page) and authored for anyone else ("The System AI").
- **FR-006**: Each card MUST be addressable as `/cast#<id>` and land clear of the site header.
- **FR-007**: The page MUST use the existing tokens, type and components of the front door, in the
  site's plain voice (the System box is not used: nobody here is being "announced"). All fixed
  wording MUST live in the marketing copy file; bios are data, not copy.

**Links**

- **FR-008**: A member's links MUST support the platforms the site already names (YouTube, Discord,
  TikTok, Bluesky, Instagram) plus a generic kind for link hubs and personal sites, labelled
  "Links". Links open in a new tab, follow the site's outbound-link safety rule, and are counted by
  the existing outbound analytics.

**Crawler pages**

- **FR-009**: The crawler-page credit MUST show "Played by {name}" with a small headshot and link
  the name to the member's card. The one-line pronouns/bio detail and the player's link row are
  removed from crawler pages.

**Data**

- **FR-010**: Cast members MUST live in one authored data file, the only place a person is
  described: id, name, role (when not a player), the crawler they play (when a player), pronouns
  (slash form), bio paragraphs, photo, links. The inline player object on each crawler, and the
  `player.*` lines of the crawler to-do list, are retired in the same change.
- **FR-011**: Validation MUST fail the tests and the build when: an id is duplicated or not a
  lowercase slug; a member names a crawler that does not exist; a crawler has no player or more
  than one; a photo file is missing; a link has an unknown kind or is not an `https` address.
- **FR-012**: The hub's own data (episode files, the party rail's player names) is not touched.

**Photos**

- **FR-013**: Each supplied headshot MUST be cropped square around the face and shipped in two
  sizes: a card size (at most 45 kB) and a credit size for crawler pages (at most 8 kB). Originals
  stay out of the repository. Every image has the person's name as its text alternative, reserves
  its space before loading, and only the first card's image on `/cast` loads eagerly.

**Content (launch)**

- **FR-014**: The page MUST launch with the content below. Bios are the cast's own words with typos
  fixed and nothing else changed; first person stays first person.

| id | Name | Role | Pronouns | Links |
|----|------|------|----------|-------|
| `lulu` | Lulu | Plays Mimi Rivers | she/her | none yet |
| `madio` | Madio | Plays Ronald Hudson | he/him | Links: `https://beacons.ai/madiotu` |
| `danny` | Danny | Plays Xavier "X.O." Ortiz | he/him | Links: `https://linktr.ee/dannyrmendoza` |
| `sarah` | Sarah | Plays Veil Ravencrest | she/they | Instagram: `https://www.instagram.com/sarahthegeeky` (interim) |
| `bastion` | Bastion | The System AI | he/him | none yet |

**Madio** (edits: "is" added; "Oakland Ca" -> "Oakland, CA"; "TTRPGS" -> "TTRPGs"; "substack" ->
"Substack"; two commas):

> La Madio is a writer and performer originally from Oakland, CA, now based out of Atlanta. His
> passion for TTRPGs began during his time studying creative writing at UCLA. Since then he's
> launched Dice Pile, a TTRPG blog over on Substack, and began taking on roles within the actual
> play sphere. Notably, he works as a team member with Dungeon Dropouts and here on Dungeon Crawl
> Cast. When he's not working on projects you can likely find him diving into a new book or playing
> through his backlog of games.

**Sarah** (edits: "writiing" -> "writing"; the closing line about her handle is carried by her
link instead):

> Hi there! I hail from the beautiful Puget Sound region in Washington State and I have a
> background in graphic design and voice acting, and I'm currently venturing into creative writing!
> Although I daylight as a corporate drone, my passions lie in art and creativity in any form.
>
> I fell in love with TTRPGs when I realized that they inherently thrive on an intersection of
> human creativity. Art, creative writing, music, worldbuilding, theater and so much more can be
> explored and expressed in a fun and safe environment with your favorite people... while rolling
> math rocks! Seriously, what's not to love?

**Danny** (no edits):

> Danny Mendoza is a Miami-based director, producer, and actor whose career spans 2-3 decades in
> broadcast television, film, theatre, and most recently in the Actual Play space. With
> foundational training from NYU's Tisch School of the Arts, Old Vic New Voices, the Upright
> Citizens Brigade, and the Labyrinth Theatre Company, Danny brings a cinematic and collaborative
> lens to his part of the Dungeon Crawl Cast. At the table, he champions a "play to lift"
> philosophy, prioritizing comprehensive safety, community care, and anti-authoritarian
> storytelling. Danny serves as the founder of Miami Story Center, a Founder among many at
> Streaming Rainbow, and Creative Director at Many-Faced Plays.

**Lulu**, **Bastion**: no bio yet.

### Key Entities

- **Cast member**: a real person on the show. Id (the anchor), display name, pronouns, photo, bio
  paragraphs (zero or more), links (zero or more), and either the crawler they play or an authored
  role.
- **Cast link**: a kind (a named platform, or generic "links") and an address.
- **Crawler** (existing): no longer describes its player; exactly one cast member points at each
  crawler.

## Success Criteria

- **SC-001**: A visitor can get from any page to a named cast member's bio in two taps or fewer
  (navigation, then scroll or anchor; or the crawler-page credit).
- **SC-002**: All five people appear on `/cast` with a headshot, name, role and pronouns; the three
  supplied bios appear complete and match FR-014 word for word.
- **SC-003**: With scripts disabled, `/cast` still shows all of its content, and every `/cast#<id>`
  address lands on the right card.
- **SC-004**: At 375 px no page on the site scrolls sideways after the navigation gains its fourth
  item.
- **SC-005**: The five card photos together add no more than 225 kB to `/cast`, and a crawler page
  gains no more than 8 kB.
- **SC-006**: `/cast` scores at least as well as `/community` on the mobile performance and
  accessibility audits the project already runs, with no accessibility violations.
- **SC-007**: Adding a missing bio or changing a link takes one edit to one data file and a
  rebuild.

## Governance

- Constitution VIII names the marketing routes; `/cast` joins that list (PATCH bump), and
  `CLAUDE.md`'s active-feature pointer moves to 014 in the same change.

## Assumptions

- Display names are the short names the site already uses (Madio, Sarah, Lulu, Danny, Bastion);
  fuller names appear only where a bio uses them.
- "La Madio" is Madio's full name (author, 2026-11-17).
- Card order follows the crawler order the site already uses, then Bastion (confirmed by the
  author); it can be changed by reordering the file.
- Bastion's role line is "The System AI" (confirmed by the author).
- Sarah's Instagram link is a stand-in until she sends the one she wants.
- Everyone has confirmed their headshot may be public (author, 2026-11-17).
- The figure behind Bastion in his photo is his own reflection; the square crop is a normal
  face crop and needs no special handling.
- No per-person social image or structured-data entry in this feature; `/cast` shares the site
  image.

## Out of scope

- Writing Lulu's or Bastion's bio.
- Any change to the hub (episode pages, party rail, codex) or the Studio.
- Crew beyond these five, guest players, or a per-person page.

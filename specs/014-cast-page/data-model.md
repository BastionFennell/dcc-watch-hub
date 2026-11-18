# Data model - 014 cast page

## `public/data/cast.json` (authored)

```json
{
  "todo": ["Lulu's bio and links.", "Bastion's bio and links.", "Sarah's preferred link (Instagram is a stand-in)."],
  "cast": [
    {
      "id": "lulu",
      "name": "Lulu",
      "pronouns": "she/her",
      "crawlerId": "mimi",
      "bio": [],
      "photo": { "card": "/img/cast/lulu.webp", "credit": "/img/cast/lulu-sm.webp" },
      "links": []
    },
    {
      "id": "madio",
      "name": "Madio",
      "pronouns": "he/him",
      "crawlerId": "ronald",
      "bio": ["La Madio is a writer and performer ... (spec FR-014, verbatim)"],
      "photo": { "card": "/img/cast/madio.webp", "credit": "/img/cast/madio-sm.webp" },
      "links": [{ "kind": "links", "url": "https://beacons.ai/madiotu" }]
    },
    { "id": "danny", "crawlerId": "xo", "...": "links: [{ kind: 'links', url: 'https://linktr.ee/dannyrmendoza' }]" },
    { "id": "sarah", "crawlerId": "veil", "...": "bio: two paragraphs; links: [{ kind: 'instagram', url: 'https://www.instagram.com/sarahthegeeky' }]" },
    {
      "id": "bastion",
      "name": "Bastion",
      "pronouns": "he/him",
      "role": "The System AI",
      "bio": [],
      "photo": { "card": "/img/cast/bastion.webp", "credit": "/img/cast/bastion-sm.webp" },
      "links": []
    }
  ]
}
```

Array order is display order. Bio text for Madio, Sarah and Danny is copied from spec FR-014
exactly; Sarah's is two array items.

## Types (`src/data/types.ts`)

```ts
export const CAST_LINK_KINDS = ['youtube', 'discord', 'tiktok', 'bluesky', 'instagram', 'links'] as const;
export type CastLinkKind = (typeof CAST_LINK_KINDS)[number];

export interface CastLink { kind: CastLinkKind; url: string }

/** A real person on the show. Exactly one of `crawlerId` / `role` is set. */
export interface CastMember {
  id: string;            // slug; the `/cast#id` anchor
  name: string;
  pronouns?: string;     // slash form
  crawlerId?: string;    // the crawler they play
  role?: string;         // authored, for someone who plays no crawler
  bio: string[];         // paragraphs; [] = not written yet
  photo: { card: string; credit: string };
  links: CastLink[];     // authored order; [] = none
}

export interface CastFile { cast: CastMember[]; todo?: string[] }
```

Removed: `CrawlerPlayer`, `CrawlerProfile.player`. Added: `Embedded.cast?: unknown` (validated on
read, like `crawlers`; absent on a payload written before 014).

## Rules

| Rule | Runtime (`validateCast`, lenient) | Lint (`lintCast`, fails build + tests) |
|---|---|---|
| File is `{ cast: [...] }` | else empty cast + warn | error |
| `id` slug, unique | drop the later duplicate | error |
| `name` non-empty | drop member | error |
| `photo.card`, `photo.credit` strings | drop member | error; files must exist under `public/`, card <= 45 kB, credit <= 8 kB |
| exactly one of `crawlerId` / `role` | both: keep `crawlerId`; neither: drop member | error |
| `crawlerId` is a real crawler | not checked (roster may still be loading) | error |
| every crawler has exactly one member | first match wins (`playerOf`) | error |
| `pronouns` slash form | kept as written | error |
| `bio` items non-empty strings | drop empty items | error |
| link `kind` known, `url` is `https://...` | drop that link | error |

## Derived

- `playerOf(cast, crawlerId): CastMember | undefined` - first member with that `crawlerId`.
- Role line: `crawlerId` -> `siteCopy.castPlays(profile.characterName)` linking to
  `/crawlers/<crawlerId>`; if the crawler is not in the roster (still loading), render the member
  without a role line rather than a broken one. Otherwise `member.role`, plain text.
- `castAnchor(id)` -> `/cast#<id>`.

## `crawlers.json` after 014

Each crawler: `id, name, characterName, handle, pronouns, concept, pockets, entryAchievement, art`
(+ optional `og`). `todo` keeps the handle / concept / pockets / show.json lines and drops the two
`player.*` lines. Schema: `player` leaves `required` and `properties`.

## Payload

`__DCC__` gains `cast` (the raw file) on every prerendered route. It is about 2.5 kB; splitting it
per route is not worth a second code path.

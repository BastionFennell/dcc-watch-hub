# Authoring the crawler dossier

One file per crawler, `content/status/<id>.json`, where `<id>` is the crawler's id in
`public/data/crawlers.json` (`harry`, `mimi`, `ronald`, `xo`, `veil`).

These files are **source**, not site data. Nothing here is served. `npm run build:dossier` compiles
them into `public/data/dossier/<id>.json`, which is gitignored and regenerated on every build and
every `npm run dev`.

## The one rule everything else serves

**Absence is never a signal.** Every crawler gets exactly one card for every aired episode,
forever. A crawler who dies in Episode 9 keeps getting cards in Episode 10, 11 and 12 - the estate,
the legacy item, the reruns. A crawler who was simply not in Episode 4 gets the same kind of card a
dead one would. If a reader can learn anything by counting rows, the feature has failed.

You do not have to write a card for every episode. The build writes one for you when you skip an
episode, and that generated card is deliberately identical for everyone:

> **Off camera this episode**
> {characterName} sits this one out. No status change.

Those two strings live in `src/site/dossier/quiet.ts`. Change them there, never per crawler.

## The file

```json
{
  "id": "harry",
  "updates": [
    {
      "episode": 1,
      "kind": "update",
      "onCamera": true,
      "title": "Harry meets the door and wins",
      "body": "One or two sentences, present tense, System voice.",
      "chips": ["GATE CRASHER", "4/20 HB"],
      "level": null,
      "condition": "alive"
    }
  ]
}
```

A crawler with nothing written yet is `{ "id": "veil", "updates": [] }` - every card is generated,
and the page still fills. That is a legal, shipping state, not a TODO.

| field      | what it is                                                                     |
| ---------- | ------------------------------------------------------------------------------ |
| `episode`  | an episode id from `show.json`. Ascending, at most one card per episode.         |
| `kind`     | `update` (there is news) or `quiet` (there is none, in your own words).          |
| `onCamera` | did they appear on screen? Feeds "Last on camera" in the strip.                  |
| `title`    | <= 60 characters, present tense.                                                 |
| `body`     | 1-3 sentences, present tense, System voice.                                      |
| `chips`    | 0-3 short mono facts. Think `RANK 740`, `4/20 HB`, `WARDEN KEY`.                 |
| `level`    | an integer, or `null` to derive it from the hub reducer at the end of the episode. |
| `condition`| `alive` or `deceased`. Sticky: never back to `alive`.                            |

`floor` is **not** authored. It comes from `show.json`, so the two can never disagree.

## What the build refuses (these stop the build)

- a card for an episode `show.json` has never heard of;
- two cards for the same episode, or cards out of ascending order;
- an empty title or body, a title over 60 characters, more than 3 chips, an empty chip;
- a level below 1;
- `condition: "alive"` on a card after any earlier card said `deceased`.

## What the build only mentions (these still ship)

- a card for an episode that has not aired yet. Writing ahead is encouraged; the card is **dropped**
  at compile time, so it never reaches the served file, the prerendered payload, or a devtools tab.
  It appears the moment that episode's `hubLiveAt` passes and something rebuilds - which the weekly
  deploy schedule takes care of without a push.
- a `quiet` card that also claims `onCamera: true`. A reader would see the contradiction.

## Voice

Present tense, always, including for a crawler who has died: this is a broadcast archive, and the
archive does not speak about anyone in the past tense. The System is bored, precise and faintly
commercial. It does not editorialize about loss.

Write the same **kind** of card after a death that you wrote before it. The subject changes - what
the estate does, who carries the legacy item, how the reruns are performing - and the shape does
not. Nothing in a title, body or chip should read as a eulogy.

## Checking your work

```
npm run build:dossier          # compiles, prints a summary, exits 1 on any error
npm test -- samples            # the same lint, as a test, against the live show.json
```

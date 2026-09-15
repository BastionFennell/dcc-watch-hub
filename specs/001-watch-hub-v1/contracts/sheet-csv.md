# Contract: Editor sheet CSV → `ep{N}.json`

Editors log events in a Google Sheet during the edit pass and export CSV. Header row required.

## Columns

`timecode,type,actor,field1,field2,field3`

- `timecode`: `hh:mm:ss`, `h:mm:ss`, `mm:ss`, or plain seconds. Unparseable → **ERROR**.
- `type`: one of the event types below. Unknown → **WARN**, row passed through with `field1..3`
  copied verbatim.
- `actor`: crawler id (must match `initialState.party[].id`). Required for actor events.
  Unknown → **WARN** (row still emitted). Empty on actor events → **WARN**.
- `field1..field3`: per-type mapping. Lists use `;` separators. Cells use `r,c;r,c`.

| type | field1 | field2 | field3 |
|------|--------|--------|--------|
| system_message | text | – | – |
| achievement | title | desc | – |
| loot | item | source | – |
| hp | current | max | – |
| level_up | level | – | – |
| rank | scope (`party`/`crawler`) | rank | – |
| map_reveal | cells `r,c;r,c` | label | – |
| sponsor | text | durationSec | – |
| chapter | label | kind | – |
| status | add (`;`) | remove (`;`) | – |
| inventory | add (`;`) | remove (`;`) | – |
| note | text | – | – |

## Command

```sh
npm run sheet-to-json -- scripts/samples/ep1.csv \
  --episode 1 --duration 240 \
  --initial-state scripts/samples/ep1.initial.json \
  --out public/data/ep1.json
```

`--initial-state` is a JSON file holding the `initialState` object (party, partyRank, map). The
converter emits `{ episodeId, initialState, events }` with events sorted by `t` (stable).

## Diagnostics

- **WARN row N: ...** (stderr) — output still written; exit 0:
  - unknown actor; missing actor on an actor event
  - HP for an actor changed relative to the previous `hp` row without an intervening `hp` event
    is *not* detectable from rows alone, so the check implemented is: `current > max`, or `current`
    decreased by more than `max` (impossible jump), or `hp` row for an actor with no prior state
  - timecode > `--duration`
  - unknown event type (passed through)
  - `chapter.kind` not in {boss, loot, achievement, levelup, story}
- **ERROR row N: ...** — nothing written; exit 1:
  - unparseable timecode; missing header column; numeric field not numeric; empty required field
    (e.g. achievement title)
- Summary line on completion: `wrote public/data/ep1.json (42 events, 2 warnings)`.

## Samples

- `scripts/samples/ep1.csv` — clean, exercises every type.
- `scripts/samples/ep1-broken.csv` — same plus: row with actor `ghost` (warn), row at
  `01:30:00` past duration (warn), row `hp` with `current` 999 > max (warn).
- `scripts/samples/ep1-error.csv` — row with timecode `abc` (error, exit 1).

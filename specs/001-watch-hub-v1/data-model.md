# Data Model: DCC Watch Hub v1

Three layers: **static data** (files on disk, authored), **overlay state** (derived by the
reducer, never stored), and **view models** (derived by selectors for components).

## 1. Static data (authored)

### Show (`public/data/show.json`)

| Field | Type | Notes |
|-------|------|-------|
| title | string | "Dungeon Crawl Cast" |
| seasons | Season[] | ordered |
| episodes | EpisodeMeta[] | flat list; `id` unique |
| links | { youtube: string; discord: string } | header links |

**Season**: `{ season: number; floors: Floor[] }`  
**Floor**: `{ floor: number; label: string; episodes: number[] }` - ordered episode ids.  
**EpisodeMeta**: `{ id: number; title: string; youtubeId: string; floor: number; durationSec: number; dataUrl: string }`

**Derived ordering** (`src/data/show.ts`): `orderedEpisodeIds(show)` = concat of every
`season.floors[].episodes` in order. `prevNext(show, id)` → `{ prev?: EpisodeMeta; next?: EpisodeMeta }`.
`episodesByFloor(show)` → `Array<{ season, floor, label, episodes: EpisodeMeta[] }>` for the hub
and the dropdown. Validation: every id in floors must exist in `episodes`; ids in `episodes`
missing from floors are appended to a synthetic "Unsorted" group with a console warning (never crash).

### EpisodeData (`public/data/ep{N}.json`)

| Field | Type | Notes |
|-------|------|-------|
| episodeId | number | must equal EpisodeMeta.id |
| initialState | InitialState | |
| events | Event[] | sorted ascending by `t`; stable for equal `t` |

**InitialState**: `{ party: Crawler[]; partyRank: number | null; map: MapState }`  
**Crawler**: `{ id: string; name: string; handle: string; player: string; level: number; hp: { current: number; max: number }; portrait: string; class: string | null; inventory: string[]; rank: number | null }`  
**MapState**: `{ floor: number; grid: { cols: number; rows: number }; revealed: Cell[] }`, `Cell = [row, col]`

### Event (discriminated union on `type`)

| type | fields | actor? | reducer effect | feed | toast | marker |
|------|--------|--------|----------------|------|-------|--------|
| system_message | text | no | none | System box | – | – |
| achievement | title, desc | yes | append to crawler.achievements | item (amber label) | yes, 6 s FIFO | achievement color |
| loot | item, source | yes | append item to inventory | item (loot label) | – | – |
| hp | current, max | yes | set hp (clamped 0..max) | item | – | – |
| level_up | level | yes | set level | item | – | level-up color |
| rank | scope ("party" \| "crawler"), rank | if scope=crawler | set partyRank or crawler.rank | item (rank label) | – | – |
| map_reveal | cells: Cell[], label? | no | union cells into revealed | item (map label) | – | – |
| sponsor | text, durationSec | no | none | purple slot; pinned while active | – | – |
| chapter | label, kind ∈ {boss, loot, achievement, levelup, story} | no | none | item | – | color by kind (unknown kind → story) |
| status | add: string[], remove: string[] | yes | statuses = (statuses − remove) ∪ add | item | – | – |
| inventory | add: string[], remove: string[] | yes | inventory = (inventory − remove) ∪ add | item | – | – |
| note | text | no | none | item (muted) | – | – |
| *(unknown)* | raw | – | ignored | omitted | – | – |

Common: `t: number` (seconds into the final edit, ≥ 0). `actor` references `Crawler.id`; an
actor not in the party leaves state untouched but the event still appears in the feed.

Loading normalizes each raw object with `normalizeEvent(raw): Event | UnknownEvent` so downstream
code only sees well-typed events.

## 2. Overlay state (derived, `src/engine/state.ts`)

```ts
interface OverlayState {
  party: CrawlerState[];          // same order as initialState.party
  partyRank: number | null;
  map: MapState;                  // revealed grows monotonically with t
}
interface CrawlerState extends Crawler {
  statuses: string[];             // starts []
  achievements: string[];         // titles, starts []
}
```

`fromInitialState(init)` clones and adds the empty derived arrays.
`applyEvent(state, event): OverlayState` is pure and returns a new object.
`reduceTo(episode, t) = events.filter(e => e.t <= t).reduce(applyEvent, fromInitialState(init))`.

Invariants (unit-tested):
- `reduceTo(ep, t)` depends only on `(ep, t)`; calling it twice yields deep-equal results.
- For all events e: `reduceTo(ep, e.t - ε)` does not reflect e; `reduceTo(ep, e.t)` does.
- HP is clamped to `[0, max]`; level never decreases via anything but the data itself.

## 3. View models (derived, `src/engine/selectors.ts`)

All take `(episode: EpisodeData, meta: EpisodeMeta, t: number)` or the already-reduced state.

| Selector | Returns | Rule |
|----------|---------|------|
| `elapsed(events, t)` | Event[] | `e.t <= t`, original order |
| `partyFrames(state, events, t)` | PartyFrame[] | per crawler: name, level, hp, pct, `danger = hp.current / hp.max < 0.25`, `levelUpPulse` (level_up for actor with `t_e <= t < t_e + 1.2`), statuses, portrait |
| `feedItems(events, t, n = 8)` | FeedItem[] | last n known elapsed events, newest first; each with `kind`, `label`, `text`, `t` |
| `activeSponsor(events, t)` | FeedItem \| null | latest sponsor with `t_e <= t < t_e + durationSec` |
| `activeToast(events, t)` | Toast \| null | achievements in order; `start_i = max(t_i, end_{i-1})`, `end_i = start_i + 6`; return the one with `start <= t < end` |
| `timelineMarkers(events, durationSec)` | Marker[] | chapter (kind→color), achievement, level_up; `pos = t / durationSec` clamped 0..1; label = chapter label / achievement title / "{name} reaches Lv {n}" |
| `mapCells(state)` | { floor, cols, rows, revealed: Set<string> } | key `"r,c"` |
| `stageCaption(meta, t)` | string | `Ep {id} · Floor {floor} · {formatTime(t)}` |

`formatTime(sec)`: `mm:ss` under one hour, `h:mm:ss` at or above.

## 4. Playback

`TimeSource` (see contracts/time-source.md). `usePlayhead(source)` returns
`{ t, playing, ended }` and re-renders on every tick; components never touch the source except
`EventTimeline` (calls `seek`) and `NextEpisodeCard` (reads `ended`).

## 5. Sheet row (authoring input)

`SheetRow = { timecode: string; type: string; actor: string; field1: string; field2: string; field3: string }`
→ one Event per contracts/sheet-csv.md. Converter state: party ids (for actor checks), last HP
per actor (for the non-monotonic check), duration (for range check).

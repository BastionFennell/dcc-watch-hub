# Data Model: DCC Watch Hub v2 (deltas over v1)

v1's model (`specs/001-watch-hub-v1/data-model.md`) stands. This file lists only additions.

## 1. Static data additions

### Crawler (optional sheet fields; all may be absent in v1 files)

| Field | Type | Notes |
|-------|------|-------|
| race | string | e.g. "Human" |
| pronouns | string | free text |
| crawlerNumber | string \| number | shown as "Crawler #…" |
| stats | { str, int, con, dex, cha: number } | all five required if present |
| hotlist | string[] | starting Hotlist entries |
| skills | SkillEntry[] | `{ name: string; rank?: number }` |

### New events

| type | fields | actor | reducer effect | feed | toast | marker |
|------|--------|-------|----------------|------|-------|--------|
| skill | name, rank?, desc? | yes | upsert skill by name; rank replaces when given | "Skill" item | – | – |
| class | class | yes | set crawler.class | "Class" item | – | – |
| hotlist | add[], remove[] | yes | hotlist = (hotlist − remove) ∪ add | "Hotlist" item | – | – |

Converter rows (contracts/sheet-csv.md): `skill` field1=name field2=rank field3=desc;
`class` field1=class; `hotlist` field1=add(`;`) field2=remove(`;`).

## 2. Overlay state additions (`src/engine/state.ts`)

```ts
interface CrawlerState extends Crawler {
  statuses: string[];
  achievements: string[];
  skills: SkillEntry[];   // seeded from Crawler.skills ?? []
  hotlist: string[];      // seeded from Crawler.hotlist ?? []
}
```

## 3. New derived view models (`src/engine/selectors.ts`)

| Selector | Returns | Rule |
|----------|---------|------|
| `crawlerHistory(events, t, actorId, party)` | FeedItem[] | all elapsed known events with `actor === actorId`, newest first, uncapped |
| `rankSeries(events, t, scope)` | `{ points: {t, rank}[]; current: number \| null; best: number \| null }` | scope `{ actor }` → crawler rank events; `'party'` → party rank events; ordered by t; best = min rank |
| `hpSegments(hp)` | `{ filled: 0..10; pct: number }` | `filled = ceil(current / max * 10)` clamped 0..10 (a living crawler with any HP shows ≥ 1) |
| `crawlerDossier(state, events, t, actorId, party)` | Dossier \| null | header fields from `CrawlerState`; `hp: hpSegments`; `rank: rankSeries`; `debuffs = statuses`; `stats?`; `hotlist`; `skills`; `inventory`; `achievements: {title, desc?, t}[]` from elapsed achievement events for the actor; `history: crawlerHistory(...)`; null if actor unknown |
| `mapLabels(events, t)` | `{ label: string; row: number; col: number; cells: number }[]` | for each distinct `label` among elapsed `map_reveal` events, centroid (mean row, mean col) over the union of their cells; order by first reveal time |

All are pure; none read the clock or DOM.

## 4. Viewer state (not overlay state)

| State | Owner | Shape | Persisted |
|-------|-------|-------|-----------|
| Panel | `usePanel` in EpisodePage | `{ kind:'none' } \| { kind:'dossier'; crawlerId } \| { kind:'map' }` + trigger element ref | no; resets on episode change |
| Map view | `FloorMap` | `{ zoom: number; panX: number; panY: number }` | no; resets on mount |
| Resume record | `resume.ts` (`localStorage`) | `{ episodeId: number; t: number; savedAt: string }` | yes, per episode, this device |
| Resume offer | `useResume` | `pending: { t } \| null` | no |

## 5. Fixture facts for page tests (`src/test/fixtures.ts`, episode 1)

Add, keeping every existing time:
- `harry`: `rank` (scope crawler) at 100 → 4188, 150 → 3012, 200 → 3550 (sparkline: 3 points, best 3012, current 3550).
- `xo`: `skill` at 80 `{ name: 'Understudy Strike', rank: 1 }`, `skill` at 160 `{ name: 'Understudy Strike', rank: 2 }` (upsert).
- `harry`: `class` at 95 `{ class: 'Compensated Anarchist' }`; `hotlist` at 105 `{ add: ['Door'], remove: [] }`, `hotlist` at 165 `{ add: ['Crowbar'], remove: ['Door'] }`.
- `map_reveal` at 90 keeps label "The Meat District" (cells (3,2),(4,2)); add `map_reveal` at 175 label "The Rot Market" cells (6,5),(6,6),(7,5) → centroid (6.33, 5.33).
- Initial fields for `harry`: `race: 'Human'`, `pronouns: 'he/him'`, `crawlerNumber: '10,491,201'`, `stats {str:5,int:6,con:6,dex:7,cha:4}`, `hotlist: []`, `skills: [{ name: 'Powerful Strike', rank: 1 }]`. Others: race + pronouns only.
- Party `rank` at 125 → 61 already exists (feed header line shows "#61" from 125).

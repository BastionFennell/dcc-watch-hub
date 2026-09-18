# Contract: Broadcast log

## Selectors (`src/engine/selectors.ts`)
- `FeedItem` gains `actorId?: string`.
- `logItems(events, t, party): FeedItem[]` - all known elapsed events, chronological (file order for ties).
- `logCounts(items): { total: number; byType: Partial<Record<EventType, number>>; byActor: Record<string, number> }`
- `applyLogFilters(items, filters: { types: ReadonlySet<EventType>; actors: ReadonlySet<string> }): FeedItem[]`

## Preference (`src/prefs/logOpen.ts`)
- Key `dcc-watch-hub:prefs:v1:log-open`, value `"1"` | absent. `loadLogOpen(): boolean`, `saveLogOpen(open: boolean): void`; try/catch everywhere.

## Component (`src/components/EpisodeLog/EpisodeLog.tsx`)
Props: `{ items: FeedItem[]; party: readonly { id: string; name: string }[]; t: number; playing: boolean; onSeek(t): void; onShare(t): void; initialOpen?: boolean; onOpenChange?(open): void }`
- Root `<section aria-labelledby=… data-testid="episode-log" data-open>`; header `<h2>` with the
  toggle `<button aria-expanded data-testid="log-toggle">` and the count (`data-testid="log-count"`,
  polite live region throttled to 1 s): "N moments" or "N of M moments".
- Filters: `data-testid="log-filters"`, chips `log-chip-type-<kind>` / `log-chip-actor-<id>` with
  `aria-pressed` and a count badge; `log-clear`.
- List: `data-testid="log-list"` (`role="list"`), rows `log-row` reusing feed rows (`data-latest` on the last).
- Follow control: `data-testid="log-follow"` shown only when not following.
- Empty: `log-empty` with `copy.feedStandby` (no events) or `copy.logNoMatch` (filtered).

## Copy
`logTitle` "Broadcast log", `logCount(n)`, `logCountFiltered(n, m)`, `logOpen` "Open the log",
`logClose` "Close the log", `logFiltersTypes` "Types", `logFiltersCrawlers` "Crawlers", `logClear` "Clear",
`logFollow` "Follow the broadcast", `logNoMatch` "Nothing on the log matches.".

# Data Model: Crawler Record (deltas)

## Derived (new)

```ts
interface LedgerRow { count: number; newest?: { text: string; t?: number } }
interface Glance {
  id: string; name: string; handle: string; player: string; portrait: string;
  class: string | null; level: number;
  hp: Hp & HpSegments;                 // from Dossier
  rank: RankSeries;                    // from Dossier
  debuffs: string[];
  ledger: { hotlist: LedgerRow; skills: LedgerRow; inventory: LedgerRow; achievements: LedgerRow };
  recentHistory: FeedItem[];           // ≤ 3, newest first
}
crawlerGlance(dossier: Dossier): Glance   // pure
```

Rules: `ledger.<list>.newest` = last element of the current list (skills: `name` + rank suffix);
`achievements.newest` = last elapsed achievement `{ text: title, t }`; `count` = length.

## Viewer state (new)

`record: string | null` in `EpisodePage` — the crawler whose full record is open. Cleared when
`panel.kind !== 'dossier'`, when `panel.crawlerId` changes, and on episode change.

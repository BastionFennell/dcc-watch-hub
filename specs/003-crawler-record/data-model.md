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

## Revision 2 additions

### Static data
- `Crawler.art?: string` — full-figure illustration path (the bust `portrait` remains for frames).
- `Crawler.gear?: Gear` where `Gear = { head?: string; torso?: string; arms?: string; hands?: string; legs?: string; feet?: string; accessories?: string[] }`.
- Events: `equip { t, actor, slot: GearSlot, item }`, `unequip { t, actor, slot: GearSlot, item? }`;
  `GearSlot = 'head' | 'torso' | 'arms' | 'hands' | 'legs' | 'feet' | 'accessory'`.
- Converter rows: `equip` field1 slot, field2 item; `unequip` field1 slot, field2 item (accessory only).
  Unknown slot → ERROR. Accessory `unequip` without item → WARN (removes the last accessory).

### Overlay state
`CrawlerState.gear: Required<Gear>`-like normalized `{ head, torso, arms, hands, legs, feet: string | null; accessories: string[] }`
seeded from `Crawler.gear`. Reducer: `equip` sets the slot (accessory appends, cap 10, dedupe);
`unequip` clears the slot (accessory removes by name, or the last one when no item).

### Derived
- `Dossier` gains `gear` and `art?`.
- `Glance` (revised): `{ id, name, handle, player, portrait, class, level, hp, rank, debuffs,
  equipped: { slot: GearSlot; item: string }[] (accessories expanded, sheet order), latestAchievement?: { title, desc?, t },
  recentHistory: FeedItem[] (≤ 3) }`. `ledger` is removed.
- `hotbarSlots(hotlist, n = 10): (string | null)[]` + `overflow: number`.
- `rankSeries(events, t, actorId: string)` — party rank is gone (T334): the `rank` event is
  `{ t, type: 'rank', actor, rank }` with no `scope`, and `InitialState` has no `partyRank`.
  Converter row: `rank` field1 = the rank (legacy `crawler` in field1 → WARN, `party` → ERROR).
- Record view state (component-local): `view: 'sheet' | 'skills' | 'inventory' | 'achievements' | 'history'`.

### Fixture facts to add (episode 1)
- Harry: `gear` initial `{ hands: 'Enchanted Crowbar' }`; `equip` at 152 `{ slot: 'torso', item: 'Patched Jacket' }`;
  `equip` at 152.5 → no: keep integer times — `equip` at 153 `{ slot: 'accessory', item: 'Lucky Rabbit Foot' }`;
  `unequip` at 168 `{ slot: 'hands' }` (crowbar traded at 150 → unequipped at 168), `equip` at 169 `{ slot: 'hands', item: 'Torch' }`.
- The Actress: `art: '/img/crawlers/actress-art.svg'`; Harry: `art: '/img/crawlers/harry-art.svg'`; others none (bust fallback case).
- X.O.: seven skills by t=200 (add skill events at 85, 90, 115, 125, 135) so the Skills grid exceeds… no — cap is 8; add nine skills total for X.O. by 200 (events at 85, 90, 115, 125, 135, 140, 145 plus the two existing) to exercise "View all (9)".
- Hotlist: Harry gets 11 hotlist entries by t=210 via a `hotlist` event at 210 adding ten names, to exercise the "+N" marker.

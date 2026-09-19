# Data Model: NPC encounters + System Registry

## Registry (`public/data/npcs.json`)
```ts
interface Registry { entities: Entity[] }
interface Entity {
  id: string; name: string; kind: 'boss' | 'vendor' | 'ally';
  portrait?: string; floor?: number; aliases?: string[];
  intro: string;                       // spoiler-free
  facts: { id: string; text: string }[];
}
```
`Show.registryUrl?: string` (leading slash resolved against BASE_URL like `dataUrl`).

## Event
`NpcEvent { t; type: 'npc'; id; action: 'met'|'seen'|'update'|'defeated'; note?; unlock?: string[]; actor? }`

## Overlay state
`OverlayState.npcs: Record<string, NpcState>`; `NpcState { firstMet; encounters; unlocked: string[]; defeated; lastT }`.

## Derived
- `encounteredNpcs(state, registry): Encounter[]` — `{ id, name, kind, portrait?, floor?, intro, state, unlockedFacts }` newest `lastT` first; ids missing from the registry omitted.
- `npcRecord(state, events, registry, id, party, t): NpcRecordView | null` — encounter + `moments: FeedItem[]` (npc events for the id ≤ t, newest first).
- `registryIndex(show, registry, episodes): RegistryEntry[]` (see research R5).

## Viewer state
- Panel kind `{ kind: 'npc'; npcId: string }` (usePanel). Registry page: `query`, `kinds: Set`, `expanded: Set<id>` (hash seeds one).

## Fixture facts (episode 1)
- Registry fixture: `hoarder` (boss, floor 1, facts `lair`, `weakness`), `grull-rep` (vendor "Grull Industries Representative", aliases ["Grull"]), `quartermaster` (ally, facts `debt`).
- Events: `npc met hoarder @118 note "Something is stacking crates in Quadrant C."`, `npc update hoarder @122 unlock [lair]`, `npc met grull-rep @112`, `npc seen quartermaster @135`, `npc update hoarder @185 unlock [weakness] note "It cannot see red."`, `npc defeated hoarder @195`, plus one `npc met unknown-id @140` to exercise the missing-registry case. (Keep feed-count checkpoints at 20/50/60/180 true — all new events are > 100 except none; re-verify 180: cap of 8 already reached.)

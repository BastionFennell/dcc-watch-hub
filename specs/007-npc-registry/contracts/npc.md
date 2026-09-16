# Contract: NPC encounters + Registry

## Data
- `show.json`: optional `registryUrl` (string, leading `/`).
- `npcs.json`: per data-model.md; JSON Schema in `npcs.schema.json`; episode schema gains the `npc` branch; show schema gains `registryUrl`.
- CSV row: `npc | field1 = id | field2 = action[:fact-id[,fact-id]] | field3 = note`.

## Engine / data exports
- `types.ts`: `Registry`, `Entity`, `EntityKind`, `ENTITY_KINDS`, `NpcEvent`, `NpcAction`, `NPC_ACTIONS`.
- `validate.ts`: `normalizeRegistry(raw): Registry` (drops malformed entities with warn), `isRegistry`.
- `load.ts`: `fetchRegistry(show): Promise<Registry | null>` (null when no `registryUrl`).
- `RegistryContext.tsx`: `RegistryProvider`, `useRegistry(): { registry: Registry | null; loading; error }`.
- `state.ts`: `NpcState`, `OverlayState.npcs`.
- `selectors.ts`: `encounteredNpcs`, `npcRecord`, `npcMoments`; `FeedItem.npcId?` for npc rows.
- `registry.ts`: `registryIndex(show, registry, episodes: ReadonlyMap<number, EpisodeData | null>): { entries: RegistryEntry[]; missingEpisodes: number[] }`.

## UI
- `EncounterRail({ encounters, activeId, onActivate(id, el), layout: 'row' | 'grid' })` — testids `encounter-rail`, `encounter-chip` (+`data-npc`, `data-kind`, `data-defeated`), empty `encounter-empty`.
- `NpcRecord({ record, onSeek, onShare })` — testids `npc-record`, `npc-facts`, `npc-fact`, `npc-moments`, `npc-registry-link`.
- `usePanel` kind `npc` (`{ kind: 'npc'; npcId }`); rail kicker `copy.npcKicker` "ENTITY RECORD".
- `MobileTabs` `TabId` + `'npcs'` (label `copy.tabNpcs` "NPCs"), only when a registry exists.
- `RegistryPage` at `/registry`: testids `registry`, `registry-search`, `registry-chip-<kind>`, `registry-section-<episodeId>`, `registry-entry` (+`id="<entity id>"`, `data-expanded`), `registry-fact` (+`data-episode`), `registry-appearance` (link to `/ep/N?t=`), `registry-empty`, `registry-missing`.
- Header: `copy.registry` "Registry" link (only when `registryUrl`).

## Copy (System voice)
`registryTitle` "System Registry", `registryKicker` "ENTITY RECORDS", `registryLead`, `registrySearch` "Search the Registry", `registryNoMatch` "The Registry has no such entity.", `registryMissing(n)`, `kindLabels { boss: 'Boss', vendor: 'Vendor / Guide', ally: 'Ally / Faction' }`, `labels.npc` "Entity", `feedText.npcMet/npcSeen/npcUpdate/npcDefeated`, `encounterTitle` "ENCOUNTERED", `encounterEmpty` "No entities tagged yet.", `npcKicker`, `npcFacts` "FACTS", `npcFactsEmpty` "The System has released nothing further.", `npcMoments` "MOMENTS", `npcDefeated` "DEFEATED", `npcActive` "ACTIVE", `npcOpenRegistry` "Open in the Registry", `tabNpcs` "NPCs", `registryEpisodeSection(n, title)`, `registryFactTag(n)` → `Ep N`.

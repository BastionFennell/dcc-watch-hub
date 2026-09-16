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

## Revision 2 — scope
- `src/engine/registry.ts`: `type RegistryScope = { kind: 'all' } | { kind: 'through'; episodeId: number } | { kind: 'only'; episodeId: number }`;
  `parseRegistryScope(param: string | null, show): RegistryScope` (`through-N`, `ep-N`; unknown/invalid → all);
  `scopeParam(scope): string | null`; `scopeRegistry(entries, scope, show): RegistryEntry[]` (pure; uses `orderedEpisodeIds(show)` for ordering).
- RegistryPage: `<select aria-label={copy.registryScope} data-testid="registry-scope">` with options `all`, then `through-N` per episode ("Through {title}"), then `ep-N` ("Only {title}"); reads/writes `?scope=` via `useSearchParams`; empty state `registry-empty` when nothing remains.
- Episode page: `NpcRecord` link → `/registry?scope=through-<episodeId>#<id>` (new prop `episodeId`); `EncounterRail` gains `registryHref?: string` rendering a `Link` "Registry for this episode" (`data-testid="encounter-registry-link"`).
- Copy: `registryScope` "Scope", `registryScopeAll` "All episodes", `registryScopeThrough(title)` → `Through {title}`, `registryScopeOnly(title)` → `Only {title}`, `encounterRegistryLink` "Registry for this episode".

## Revision 3 — Registry panel
- `usePanel`: kind `{ kind: 'registry'; focusId?: string }`.
- `src/data/RegistryIndexContext.tsx`: `RegistryIndexProvider`, `useRegistryIndex(): { index: RegistryIndexResult | null; loading; error; load(): void }` — loads show + registry + all episodes once (`Promise.allSettled`), cached for the visit; `load()` is idempotent.
- `RegistryBrowser({ currentEpisodeId, focusId?, onSeek(t), onShare(t) })` — testids `registry-browser`, reuses `registry-scope`, `registry-search`, `registry-chip-*`, `registry-entry`, `registry-appearance` (current episode → `<button data-current>`; other → `Link`), footer `registry-browser-full` link to `/registry?scope=…`.
- `EncounterRail` prop `onBrowse?(el)` renders `<button data-testid="encounter-browse" aria-expanded aria-controls="rail-panel" data-panel-trigger="registry">` (replaces the plain link inside the strip; the link moves to the panel footer).
- `NpcRecord` prop `onOpenRegistry?(id)` → button (`npc-registry-open`) instead of the link when provided.
- Copy: `registryBrowse` "Browse the Registry", `registryOpenFull` "Open the full Registry", `registryPanelKicker` "SYSTEM REGISTRY".

## Revision 4
- `registrySections(entries, scope, show)` returns sections **newest episode first**; entries within a section sorted by `firstEpisode` order desc then `firstT` desc then id.
- `RegistryBrowser` gains `t: number` and `currentEpisode: EpisodeData | null` (the page's own copy of the episode being watched, `null` while its file is still landing — the whole episode rather than only its events, so the panel is correct before the lazy cross-episode load finishes). It lays that episode over the cached index inputs and recomputes `registryIndexAt` per render (pure; small). Expose the clipping as a pure helper `clipEpisodeToPlayhead(episode, t)` in `src/engine/registry.ts` and `registryIndexAt(show, registry, episodes, currentEpisodeId, t)`.
- `RegistryIndexProvider` exposes the raw `episodes` map (`ReadonlyMap<number, EpisodeData | null>`) alongside `index` so the panel can re-index with the clipped current episode.

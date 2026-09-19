# Research: NPC encounters + System Registry

## R1. Registry as show-level data
- `show.json.registryUrl` (optional, `/data/npcs.json`) → `fetchRegistry(show)`; absent → all NPC UI
  hidden (strip, tab, header link, panel kind), `npc` events still render with their id.
- Loaded by `RegistryProvider` alongside the show (context) so both the episode page and the
  registry page share it.

## R2. Event and state
- `npc { t, id, action: 'met'|'seen'|'update'|'defeated', note?, unlock?: string[], actor? }`.
- `NpcState { firstMet: number; encounters: number; unlocked: string[]; defeated: boolean; lastT: number }`.
- Reducer: any action creates/updates the entry (`firstMet` on first event of any action — a `seen`
  before a `met` still counts as encountered), `encounters++`, `unlock` appended (dedupe), `defeated` on `defeated`.
- Feed text (System voice): met → "{name} enters the broadcast", seen → "{name} is sighted", update →
  "{name}: {note}" (note required for update; else "The System amends its file on {name}"), defeated →
  "{name} is no more"; a note appends " — {note}" where not already used. Label "Entity".

## R3. Encountered strip
- Desktop: a horizontal chip row under the party rail (`overflow-x: auto`, no wrap), newest first;
  chip = portrait/initial disc tinted by kind (boss `--danger`, vendor `--amber-fg`, ally `--marker-levelup`),
  name, kind badge (mono caps), defeated → struck name + "DEFEATED" tag. Chips are panel triggers
  (`aria-expanded`, `aria-controls="rail-panel"`, `data-panel-trigger="npc:<id>"`).
- Phone: NPCs tab renders the same chips as a 2-column grid.

## R4. Entity record (panel)
- Glance-style: kind-tinted header (portrait, name, kind, floor), intro, FACTS (unlocked ≤ t, in
  registry order), STATUS (Defeated / Active), MOMENTS (feed rows for this entity, newest first,
  seek + share), footer link "Open in the Registry" → `/registry#<id>`. Empty facts: "The System
  has released nothing further."

## R5. Registry index (cross-episode)
- `registryIndex(show, registry, episodes: Map<episodeId, EpisodeData | null>)` → entries sorted
  by first appearance (episode order, then t): `{ entity, firstEpisode, facts: [{ id, text, episodeId }]
  (only facts unlocked somewhere), appearances: [{ episodeId, t, action, note }], defeatedIn?: episodeId }`.
  Entities with no appearances are omitted. Missing episode data → skipped and reported.
- Page: fetch show → registry → all episodes in parallel (`Promise.allSettled`); render sections per
  episode; search over name + aliases (case-insensitive substring); kind chips any-of with counts;
  `#<id>` → expand + `scrollIntoView` after data lands; expanding is a `<details>`-like disclosure
  (button + region) with the entry id as anchor.

## R6. Converter
- `npc` row: field1 id, field2 `action[:fact,fact]`, field3 note. `--registry <path>` optional:
  when given, unknown ids / fact ids → WARN; without it, no id validation.

## R7. Tests
- validate/reducer/selectors (state transitions, unlock dedupe, never-early sweep for strip + facts).
- `registryIndex` (ordering, fact tags, appearances, omitted entities, missing episode).
- Components: strip (order, badges, defeated, trigger semantics), record (facts, moments, link), registry page (sections, search, chips, hash expand).
- Page: strip under the rail; chip → panel `npc` in the rail (sheet on phone); phone NPCs tab; registry absent → no UI.

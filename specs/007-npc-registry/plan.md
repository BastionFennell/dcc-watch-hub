# Implementation Plan: NPC encounters + System Registry

**Branch**: `007-npc-registry` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

## Summary
Add an optional show-level registry (`public/data/npcs.json`) and an `npc` episode event. The
reducer tracks per-entity state (first met, encounters, unlocked facts, defeated); selectors
derive the Encountered strip, the entity record, and feed rows. UI: `EncounterRail` under the
party rail (phone: NPCs tab), `NpcRecord` in the rail panel/sheet (new panel kind `npc`), and a
`RegistryPage` at `/registry` that indexes every published episode. Converter gains the `npc` row.

## Technical Context
Unchanged stack. New data file + loader; new route; `usePanel` kind. No deps.

## Constitution Check (1.2.1)
| Principle | Gate | Status |
|-----------|------|--------|
| I | Encounters/records/feed derive from events ≤ t; the registry derives from full published files (not the playhead - it is a glossary, by design and author decision) | PASS |
| II | No playback change; moments seek via the page's `source.seek` | PASS |
| III | Strip is ambient (a row of chips); record opens by tap; registry is a separate page | PASS |
| IV | Static JSON; no deps | PASS |
| V | Only this feature; kinds fixed by the author | PASS |
| VI | Converter row + samples + schema | PASS |

## Project Structure (additions)
```text
public/data/npcs.json                       # sample registry (~8 entities)
public/img/npcs/*.svg                       # placeholder portraits (optional; initials fallback)
src/data/types.ts                           # Registry, Entity, EntityKind, NpcEvent; Show.registryUrl?
src/data/validate.ts                        # normalize npc events; isRegistry/normalizeRegistry
src/data/load.ts                            # fetchRegistry(show)
src/data/RegistryContext.tsx                # RegistryProvider/useRegistry (loaded once with the show)
src/engine/state.ts, reducer.ts             # npcs: Record<id, NpcState>
src/engine/selectors.ts                     # encounteredNpcs, npcRecord, npcMoments, feed text for npc
src/engine/registry.ts                      # registryIndex(show, registry, episodesData): RegistryEntry[] (cross-episode; framework-free)
src/components/EncounterRail/**             # strip + chip
src/components/NpcRecord/**                 # panel body (glance-style)
src/components/RegistryPage? → src/pages/RegistryPage.tsx (+css, +test), src/components/RegistryEntry/**
src/pages/EpisodePage.tsx                   # strip placement, panel kind 'npc', phone NPCs tab
src/components/MobileTabs (TabId + 'npcs')
src/components/SiteHeader (Registry link)
scripts/sheet-to-json.ts                    # npc row; --registry for id validation (optional)
specs/007-npc-registry/contracts/{episode.schema.json, npcs.schema.json, show.schema.json}
```
**Structure Decision**: registry indexing lives in `src/engine/registry.ts` (pure), fed by the
page which fetches all episode files; the episode page never loads other episodes.

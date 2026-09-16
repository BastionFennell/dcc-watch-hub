/**
 * The cross-episode registry index (007, FR-620/FR-621, research R5).
 *
 * Where `selectors.ts` reads one episode at one playhead, this reads *every*
 * published episode whole: the glossary is not tied to what the device has
 * watched, only to what the show has published. Nothing here is playhead-aware,
 * so no time-truth invariant applies — the input is the complete event log of
 * every episode the archive lists.
 *
 * Framework-free (constitution I/IV): no React, no DOM, no fetch.
 */
import type {
  AnyEvent,
  Entity,
  EpisodeData,
  NpcAction,
  NpcEvent,
  Registry,
  Show,
} from '../data/types';
import { orderedEpisodes } from '../data/show';

/** One `npc` beat, flattened to what the registry entry needs to link to it. */
export interface RegistryAppearance {
  episodeId: number;
  t: number;
  action: NpcAction;
  note?: string;
}

/** A fact tagged with the episode that first released it (spec US2 scenario 4). */
export interface RegistryFact {
  id: string;
  text: string;
  episodeId: number;
}

export interface RegistryEntry {
  entity: Entity;
  /** The episode this entity first appears in, in broadcast order. */
  firstEpisode: number;
  /** Its timecode inside that episode — the tie-break between two debuts. */
  firstT: number;
  /** Registry order, filtered to facts some published episode unlocks. */
  facts: RegistryFact[];
  /** Broadcast order, then timecode. Every `npc` beat, not just the first. */
  appearances: RegistryAppearance[];
  /** The first episode in which a `defeated` beat elapses, if any. */
  defeatedIn?: number;
}

export interface RegistryIndexResult {
  entries: RegistryEntry[];
  /** Episodes the caller could not load; the index simply lacks their beats. */
  missingEpisodes: number[];
}

function isNpcEvent(event: AnyEvent): event is NpcEvent {
  return event.type === 'npc';
}

interface Accumulator {
  entity: Entity;
  appearances: RegistryAppearance[];
  /** fact id → the first episode that unlocked it. */
  unlockedIn: Map<string, number>;
  defeatedIn?: number;
}

/**
 * Index every entity that appears in any published episode.
 *
 * `episodes` maps an episode id to its loaded data, or to `null` when the fetch
 * failed — a failure costs that episode's beats and nothing else (spec US2
 * scenario 6). An id the show lists but the map does not carry at all counts as
 * missing too. Entities that never appear anywhere are omitted entirely, and an
 * `npc` beat naming an id the registry does not carry is skipped (the episode
 * feed still shows it under its raw id; the glossary has nothing to file).
 */
export function registryIndex(
  show: Show,
  registry: Registry | null,
  episodes: ReadonlyMap<number, EpisodeData | null>,
): RegistryIndexResult {
  const missingEpisodes: number[] = [];
  if (registry === null) return { entries: [], missingEpisodes };

  const byId = new Map<string, Entity>();
  for (const entity of registry.entities) {
    if (!byId.has(entity.id)) byId.set(entity.id, entity);
  }

  const accumulators = new Map<string, Accumulator>();
  // Broadcast order is the show's order, not the map's insertion order.
  const order = orderedEpisodes(show);
  const rank = new Map<number, number>();
  order.forEach((meta, index) => rank.set(meta.id, index));

  for (const meta of order) {
    const data = episodes.get(meta.id);
    if (data === null || data === undefined) {
      missingEpisodes.push(meta.id);
      continue;
    }

    // Sorted defensively: a hand-authored file may list beats out of order, and
    // ties keep their file order (Array.prototype.sort is stable).
    const beats = data.events.filter(isNpcEvent).slice().sort((a, b) => a.t - b.t);

    for (const beat of beats) {
      const entity = byId.get(beat.id);
      if (entity === undefined) continue;

      let acc = accumulators.get(entity.id);
      if (acc === undefined) {
        acc = { entity, appearances: [], unlockedIn: new Map() };
        accumulators.set(entity.id, acc);
      }

      acc.appearances.push({
        episodeId: meta.id,
        t: beat.t,
        action: beat.action,
        ...(beat.note !== undefined ? { note: beat.note } : {}),
      });

      for (const factId of beat.unlock ?? []) {
        // A fact the entity does not carry is ignored (the converter warns).
        if (!entity.facts.some((fact) => fact.id === factId)) continue;
        if (!acc.unlockedIn.has(factId)) acc.unlockedIn.set(factId, meta.id);
      }

      if (beat.action === 'defeated' && acc.defeatedIn === undefined) {
        acc.defeatedIn = meta.id;
      }
    }
  }

  const entries: RegistryEntry[] = [];
  for (const acc of accumulators.values()) {
    const first = acc.appearances[0];
    if (first === undefined) continue;

    const facts: RegistryFact[] = [];
    for (const fact of acc.entity.facts) {
      const episodeId = acc.unlockedIn.get(fact.id);
      if (episodeId === undefined) continue;
      facts.push({ id: fact.id, text: fact.text, episodeId });
    }

    entries.push({
      entity: acc.entity,
      firstEpisode: first.episodeId,
      firstT: first.t,
      facts,
      appearances: acc.appearances,
      ...(acc.defeatedIn !== undefined ? { defeatedIn: acc.defeatedIn } : {}),
    });
  }

  entries.sort((a, b) => {
    const byEpisode = (rank.get(a.firstEpisode) ?? 0) - (rank.get(b.firstEpisode) ?? 0);
    if (byEpisode !== 0) return byEpisode;
    if (a.firstT !== b.firstT) return a.firstT - b.firstT;
    return a.entity.id.localeCompare(b.entity.id);
  });

  return { entries, missingEpisodes };
}

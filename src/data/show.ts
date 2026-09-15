/**
 * Ordering and grouping derived from show.json. The floors define the canonical
 * order; the flat `episodes` list carries the metadata (data-model.md §1).
 */
import type { EpisodeMeta, Show } from './types';

export interface FloorGroup {
  season: number;
  floor: number;
  label: string;
  episodes: EpisodeMeta[];
}

const UNSORTED_LABEL = 'Unfiled transmissions';

let warnedUnsorted = false;

export function orderedEpisodeIds(show: Show): number[] {
  const ids: number[] = [];
  for (const season of show.seasons) {
    for (const floor of season.floors) {
      for (const id of floor.episodes) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  for (const episode of show.episodes) {
    if (!ids.includes(episode.id)) ids.push(episode.id);
  }
  return ids;
}

export function findEpisode(show: Show, id: number): EpisodeMeta | undefined {
  return show.episodes.find((episode) => episode.id === id);
}

export function orderedEpisodes(show: Show): EpisodeMeta[] {
  return orderedEpisodeIds(show)
    .map((id) => findEpisode(show, id))
    .filter((episode): episode is EpisodeMeta => episode !== undefined);
}

export function prevNext(
  show: Show,
  id: number,
): { prev?: EpisodeMeta; next?: EpisodeMeta } {
  const episodes = orderedEpisodes(show);
  const index = episodes.findIndex((episode) => episode.id === id);
  if (index === -1) return {};
  const prev = episodes[index - 1];
  const next = episodes[index + 1];
  return {
    ...(prev ? { prev } : {}),
    ...(next ? { next } : {}),
  };
}

/**
 * Hub and header grouping. Episodes present in `show.episodes` but missing from
 * every floor land in a synthetic trailing group rather than disappearing.
 */
export function episodesByFloor(show: Show): FloorGroup[] {
  const groups: FloorGroup[] = [];
  const placed = new Set<number>();

  for (const season of show.seasons) {
    for (const floor of season.floors) {
      const episodes: EpisodeMeta[] = [];
      for (const id of floor.episodes) {
        const episode = findEpisode(show, id);
        if (episode) {
          episodes.push(episode);
          placed.add(id);
        }
      }
      groups.push({ season: season.season, floor: floor.floor, label: floor.label, episodes });
    }
  }

  const unsorted = show.episodes.filter((episode) => !placed.has(episode.id));
  if (unsorted.length > 0) {
    if (!warnedUnsorted) {
      warnedUnsorted = true;
      console.warn(
        `show.json: ${unsorted.length} episode(s) are not listed under any floor; filing them under "${UNSORTED_LABEL}".`,
      );
    }
    groups.push({
      season: show.seasons[0]?.season ?? 1,
      floor: 0,
      label: UNSORTED_LABEL,
      episodes: unsorted,
    });
  }

  return groups;
}

export function seasonOf(show: Show, id: number): number {
  for (const season of show.seasons) {
    for (const floor of season.floors) {
      if (floor.episodes.includes(id)) return season.season;
    }
  }
  return show.seasons[0]?.season ?? 1;
}

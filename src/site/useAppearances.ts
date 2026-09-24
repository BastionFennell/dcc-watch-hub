/**
 * "Appears in" (011 §3.4): the episodes whose data actually names this crawler,
 * either in the party they started with or as the actor of an event.
 *
 * The build already knows the answer. `scripts/build-status.ts` walks every
 * published episode once and writes the map into `status.json`, so a prerendered
 * crawler page renders the list in its HTML and the browser fetches nothing
 * (T1125). The fallback - dev, where no build has run, or a deploy whose status
 * file predates the map - is the original client derivation: fetch each episode
 * and look. That path still renders `[]` first, which is what keeps hydration
 * honest when it is the one in use.
 */
import { useEffect, useState } from 'react';
import { useShow } from '../data/ShowContext';
import { useCrawlers } from '../data/CrawlersContext';
import { fetchEpisode } from '../data/load';
import { findEpisode, orderedEpisodes } from '../data/show';
import type { EpisodeData, EpisodeMeta } from '../data/types';

/** Does this episode's data name the crawler at all? */
export function referencesCrawler(episode: EpisodeData, crawlerId: string): boolean {
  if (episode.initialState.party.some((crawler) => crawler.id === crawlerId)) return true;
  // Events are a union; only some carry an actor, and an unknown type is fine.
  return episode.events.some((event) => (event as { actor?: string }).actor === crawlerId);
}

export function useAppearances(crawlerId: string): EpisodeMeta[] {
  const { show } = useShow();
  const { status } = useCrawlers();
  const precomputed = status?.appearances;
  const [found, setFound] = useState<EpisodeMeta[]>([]);

  useEffect(() => {
    setFound([]);
    if (show === null || crawlerId === '' || precomputed !== undefined) return;
    let live = true;

    const episodes = orderedEpisodes(show);
    void Promise.all(
      episodes.map(async (meta) => {
        try {
          return referencesCrawler(await fetchEpisode(meta), crawlerId) ? meta : null;
        } catch {
          // An episode whose data cannot be read is simply not an appearance.
          return null;
        }
      }),
    ).then((results) => {
      if (!live) return;
      setFound(results.filter((meta): meta is EpisodeMeta => meta !== null));
    });

    return () => {
      live = false;
    };
  }, [show, crawlerId, precomputed]);

  if (precomputed === undefined) return found;
  if (show === null) return [];
  /*
   * A crawler the build never saw has no entry, which means no appearances -
   * not "go and look". An id the show has since dropped is skipped.
   */
  return (precomputed[crawlerId] ?? [])
    .map((id) => findEpisode(show, id))
    .filter((meta): meta is EpisodeMeta => meta !== undefined);
}

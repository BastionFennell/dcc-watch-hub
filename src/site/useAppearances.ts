/**
 * "Appears in" (011 §3.4): the episodes whose data actually names this crawler,
 * either in the party they started with or as the actor of an event.
 *
 * Derived on the client, lazily. Nothing here runs on the server, so the first
 * render - the prerendered HTML and the hydrating render that must match it -
 * is always an empty list, and the section fills in after mount. The episode
 * files are the same ones the hub fetches, so a visitor who goes on to open an
 * episode has them warm.
 */
import { useEffect, useState } from 'react';
import { useShow } from '../data/ShowContext';
import { fetchEpisode } from '../data/load';
import { orderedEpisodes } from '../data/show';
import type { EpisodeData, EpisodeMeta } from '../data/types';

/** Does this episode's data name the crawler at all? */
export function referencesCrawler(episode: EpisodeData, crawlerId: string): boolean {
  if (episode.initialState.party.some((crawler) => crawler.id === crawlerId)) return true;
  // Events are a union; only some carry an actor, and an unknown type is fine.
  return episode.events.some((event) => (event as { actor?: string }).actor === crawlerId);
}

export function useAppearances(crawlerId: string): EpisodeMeta[] {
  const { show } = useShow();
  const [found, setFound] = useState<EpisodeMeta[]>([]);

  useEffect(() => {
    setFound([]);
    if (show === null || crawlerId === '') return;
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
  }, [show, crawlerId]);

  return found;
}

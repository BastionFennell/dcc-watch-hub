/**
 * The live crawler status, as a pure function (011 §5).
 *
 * "For each crawler, run the hub reducer over the latest published episode's
 * event log to its end, and emit `{ level, hp, floor, lastEpisodeId }`." The
 * spoiler rule lives here too: only an episode past its `hubLiveAt` counts, so
 * a crawler's numbers never run ahead of what a viewer is allowed to have seen.
 *
 * The I/O half is `scripts/build-status.ts`; this module never touches a disk,
 * which is what makes it testable against the sample episodes.
 */
import type { EpisodeData, EpisodeMeta, Show, StatusFile } from '../src/data/types';
import { reduceTo } from '../src/engine/reducer';
import { hubLive } from '../src/site/gate';

/**
 * The newest episode a visitor may already have seen in the hub: the highest id
 * whose `hubLiveAt` is absent or past. `null` when none is.
 */
export function publishedEpisode(show: Show, now: number): EpisodeMeta | null {
  let newest: EpisodeMeta | null = null;
  for (const episode of show.episodes) {
    if (!hubLive(episode, now)) continue;
    if (newest === null || episode.id > newest.id) newest = episode;
  }
  return newest;
}

/**
 * @param loadEpisode reads and normalizes one episode file. Injected so the
 *   caller decides where the bytes come from (disk, a fixture, a test).
 */
export function buildStatus(
  show: Show,
  loadEpisode: (meta: EpisodeMeta) => EpisodeData,
  now: number,
): StatusFile {
  const generatedAt = new Date(now).toISOString();
  const meta = publishedEpisode(show, now);
  if (meta === null) return { generatedAt, episodeId: null, crawlers: {} };

  const episode = loadEpisode(meta);
  // The end of the episode: the same reducer the viewer runs, at t = Infinity.
  const state = reduceTo(episode, Number.POSITIVE_INFINITY);

  const crawlers: StatusFile['crawlers'] = {};
  for (const crawler of state.party) {
    crawlers[crawler.id] = {
      level: crawler.level,
      hp: { current: crawler.hp.current, max: crawler.hp.max },
      floor: state.map.floor,
      lastEpisodeId: meta.id,
    };
  }
  return { generatedAt, episodeId: meta.id, crawlers };
}

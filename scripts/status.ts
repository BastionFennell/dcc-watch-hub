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

/** Every episode a visitor may already have seen, oldest first. */
export function publishedEpisodes(show: Show, now: number): EpisodeMeta[] {
  return show.episodes.filter((episode) => hubLive(episode, now)).sort((a, b) => a.id - b.id);
}

/**
 * Who this episode's data names: the party it opened with, plus the actor of
 * every event. It feeds the `appearances` map in `status.json`. No page renders
 * that map since "Appears in" was dropped (011 R2, 2026-09-25); it stays because
 * the build answers the question once and cheaply.
 */
export function crawlerIdsIn(episode: EpisodeData): Set<string> {
  const ids = new Set<string>();
  for (const crawler of episode.initialState.party) ids.add(crawler.id);
  // Events are a union; only some carry an actor, and an unknown type is fine.
  for (const event of episode.events) {
    const actor = (event as { actor?: string }).actor;
    if (typeof actor === 'string' && actor !== '') ids.add(actor);
  }
  return ids;
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
  const published = publishedEpisodes(show, now);
  if (published.length === 0) {
    return { generatedAt, episodeId: null, crawlers: {}, appearances: {} };
  }
  /*
   * One read per file, two answers out of it: "appears in" spans every
   * published episode, while the live numbers come only from the newest - a
   * crawler's level is where they are now, not where they have been.
   */
  const loaded = published.map((episodeMeta) => ({
    meta: episodeMeta,
    data: loadEpisode(episodeMeta),
  }));

  const appearances: Record<string, number[]> = {};
  for (const episode of loaded) {
    for (const id of crawlerIdsIn(episode.data)) {
      (appearances[id] ??= []).push(episode.meta.id);
    }
  }

  const newest = loaded[loaded.length - 1];
  const meta = newest.meta;
  // The end of the episode: the same reducer the viewer runs, at t = Infinity.
  const state = reduceTo(newest.data, Number.POSITIVE_INFINITY);

  const crawlers: StatusFile['crawlers'] = {};
  for (const crawler of state.party) {
    crawlers[crawler.id] = {
      level: crawler.level,
      hp: { current: crawler.hp.current, max: crawler.hp.max },
      floor: state.map.floor,
      lastEpisodeId: meta.id,
    };
  }
  return { generatedAt, episodeId: meta.id, crawlers, appearances };
}

/**
 * The broadcast-delay rule, as one pure function per question (011 §2.1).
 *
 * "New-episode CTAs point at YouTube until `hubLiveAt`; the hub link activates
 * after." Nothing here reads the clock on its own: every caller passes `now`,
 * so a test can stand on either side of the timestamp and a prerendered page
 * can be rendered at build time and re-evaluated after mount.
 *
 * Framework-free on purpose - the React half lives in `useNow.ts`.
 */
import type { EpisodeMeta, Show, ShowLinks } from '../data/types';
import { siteCopy } from './copy';

/** What the button does, and therefore where it points. */
export interface Cta {
  kind: 'youtube' | 'hub';
  href: string;
  label: string;
}

/**
 * Is the System feed open for this episode? An episode with no `hubLiveAt` is
 * live now, which is what keeps every pre-011 show.json working. An unparseable
 * date is treated the same way: the gate never hides an episode by accident.
 */
export function hubLive(episode: EpisodeMeta, now: number = Date.now()): boolean {
  if (episode.hubLiveAt === undefined || episode.hubLiveAt === '') return true;
  const at = Date.parse(episode.hubLiveAt);
  return Number.isNaN(at) ? true : at <= now;
}

/** How long until the feed opens, in ms. `0` once it has. */
export function msUntilHubLive(episode: EpisodeMeta, now: number = Date.now()): number {
  if (hubLive(episode, now)) return 0;
  return Date.parse(episode.hubLiveAt as string) - now;
}

/**
 * The one CTA every episode surface shows. `links` is the fallback: a show
 * whose episode has no YouTube id still gets a working button, pointing at the
 * channel rather than at nothing.
 */
export function ctaFor(episode: EpisodeMeta, now: number, links: ShowLinks): Cta {
  if (hubLive(episode, now)) {
    return { kind: 'hub', href: `/ep/${episode.id}`, label: siteCopy.openSystemFeed };
  }
  const href =
    episode.youtubeId === '' ? links.youtube : `https://www.youtube.com/watch?v=${episode.youtubeId}`;
  return { kind: 'youtube', href, label: siteCopy.watchOnYouTube };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "2d 4h", "4h 12m", "12m", "now". Two units at most, largest first, and never
 * a unit that reads as zero - a chip is a glance, not a stopwatch.
 */
export function countdown(msUntil: number): string {
  if (!Number.isFinite(msUntil) || msUntil < MINUTE) return 'now';
  if (msUntil >= DAY) {
    const days = Math.floor(msUntil / DAY);
    const hours = Math.floor((msUntil % DAY) / HOUR);
    return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
  }
  if (msUntil >= HOUR) {
    const hours = Math.floor(msUntil / HOUR);
    const minutes = Math.floor((msUntil % HOUR) / MINUTE);
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }
  return `${Math.floor(msUntil / MINUTE)}m`;
}

/**
 * The newest episode the show admits to: the highest id among the ones filed
 * under a floor. An episode in `episodes` but under no floor is not published
 * yet as far as the front door is concerned, exactly as `orderedEpisodeIds`
 * treats it for the hub's ordering.
 */
export function newestEpisode(show: Show): EpisodeMeta | null {
  const filed = new Set<number>();
  for (const season of show.seasons) {
    for (const floor of season.floors) {
      for (const id of floor.episodes) filed.add(id);
    }
  }
  let newest: EpisodeMeta | null = null;
  for (const episode of show.episodes) {
    if (!filed.has(episode.id)) continue;
    if (newest === null || episode.id > newest.id) newest = episode;
  }
  return newest;
}

/**
 * Pictures and running times for the front door (011 §3).
 *
 * Framework-free, so a page, a row and an OG frame all reach the same image for
 * the same episode. The YouTube URLs here are plain image and watch addresses,
 * not the IFrame API: constitution II reserves the *player API* for
 * `src/playback/`, and `gate.ts` already builds a watch link the same way.

 */
import type { CrawlerProfile, EpisodeMeta } from '../data/types';
import { metaCopy } from './meta';

/** The host's own still, which exists for every video without a build step. */
export function youtubeThumb(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

/** The row thumbnail: the authored share image, else the host's still. */
export function episodeThumb(episode: EpisodeMeta): string {
  return episode.ogImage !== undefined && episode.ogImage !== ''
    ? episode.ogImage
    : youtubeThumb(episode.youtubeId);
}

/** Root-relative art resolved against the deploy base; absolute URLs pass through. */
export function asset(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  const base = import.meta.env?.BASE_URL ?? '/';
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return path.startsWith('/') ? `${trimmed}${path}` : path;
}

/** `5:04`, and `1:02:03` once an episode runs past the hour. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The share image `scripts/og.mjs` writes for this episode, unless authored. */
export function episodeOgImage(episode: EpisodeMeta): string {
  return episode.ogImage !== undefined && episode.ogImage !== ''
    ? episode.ogImage
    : metaCopy.ogEpisodeImage(episode.id);
}

/** The same, for a crawler. */
export function crawlerOgImage(profile: CrawlerProfile): string {
  return profile.og !== undefined && profile.og !== ''
    ? profile.og
    : metaCopy.ogCrawlerImage(profile.id);
}

/** The player's own address, for `VideoObject.embedUrl` (011 §7). */
export function youtubeEmbed(youtubeId: string): string {
  return `https://www.youtube.com/embed/${youtubeId}`;
}

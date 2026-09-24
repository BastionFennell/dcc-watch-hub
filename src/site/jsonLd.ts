/**
 * Structured data for the episodes (011 §7: "JSON-LD `VideoObject` on episode
 * pages (optional, cheap)").
 *
 * Built from `show.json` and nothing else, so what a search engine reads and
 * what the page shows can never disagree. The episode page emits one
 * `VideoObject`; `/watch` emits an `ItemList` of the same objects, which is the
 * cheap way to say "this page is the archive" without repeating the head.
 *
 * Framework-free, like the rest of `src/site/*.ts` that is not a component.
 */
import type { EpisodeMeta } from '../data/types';
import { episodeOgImage, youtubeEmbed } from './media';
import { metaCopy } from './meta';
import { absoluteUrl } from './seo';

const CONTEXT = 'https://schema.org';

/** One episode as a `VideoObject`, with no `@context` of its own. */
export function episodeVideoObject(episode: EpisodeMeta): Record<string, unknown> {
  const video: Record<string, unknown> = {
    '@type': 'VideoObject',
    name: episode.title,
    description:
      episode.summary === undefined || episode.summary === ''
        ? metaCopy.defaultDescription
        : episode.summary,
    thumbnailUrl: absoluteUrl(episodeOgImage(episode)),
  };
  // Google wants an upload date; a show that has not dated an episode yet is
  // better off saying nothing than saying "unknown".
  if (episode.premiereAt !== undefined && episode.premiereAt !== '') {
    video.uploadDate = episode.premiereAt;
  }
  if (episode.youtubeId !== '') video.embedUrl = youtubeEmbed(episode.youtubeId);
  return video;
}

/** The episode page's block. */
export function episodeJsonLd(episode: EpisodeMeta): Record<string, unknown> {
  return { '@context': CONTEXT, ...episodeVideoObject(episode) };
}

/** `/watch`: the archive, in the order the page lists it. */
export function episodeListJsonLd(episodes: EpisodeMeta[]): Record<string, unknown> {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    itemListElement: episodes.map((episode, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/ep/${episode.id}`),
      item: episodeVideoObject(episode),
    })),
  };
}

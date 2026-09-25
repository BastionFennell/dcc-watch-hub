/**
 * Structured data (011 §7, T1126). The shapes are small and the rules are all
 * about absence: no summary, no date, no video id - none of which may produce
 * a field claiming to know something.
 */
import { describe, expect, it } from 'vitest';
import { episodeJsonLd, episodeListJsonLd, episodeVideoObject } from './jsonLd';
import { siteCopy } from './copy';
import type { EpisodeMeta } from '../data/types';
import { makeShow } from '../test/fixtures';

const [episode] = makeShow().episodes;

function withFields(extra: Partial<EpisodeMeta>): EpisodeMeta {
  return { ...episode, ...extra };
}

describe('episodeVideoObject', () => {
  it('names the episode, and points at its share image and its player', () => {
    const video = episodeVideoObject(
      withFields({ summary: 'The stairs down are open.', premiereAt: '2026-10-08T17:00:00Z' }),
    );
    expect(video['@type']).toBe('VideoObject');
    expect(video.name).toBe(episode.title);
    expect(video.description).toBe('The stairs down are open.');
    expect(video.thumbnailUrl).toBe('https://dungeoncrawlcast.com/og/ep1.png');
    expect(video.uploadDate).toBe('2026-10-08T17:00:00Z');
    expect(video.embedUrl).toBe(`https://www.youtube.com/embed/${episode.youtubeId}`);
  });

  it('falls back to the site description and claims no date it does not have', () => {
    const video = episodeVideoObject(withFields({ summary: undefined, premiereAt: undefined }));
    expect(video.description).toBe(siteCopy.defaultDescription);
    expect(video).not.toHaveProperty('uploadDate');
  });

  it('carries no embed for an episode with no video yet', () => {
    expect(episodeVideoObject(withFields({ youtubeId: '' }))).not.toHaveProperty('embedUrl');
  });

  it('is prefixed with the schema context only at the top level', () => {
    expect(episodeJsonLd(episode)['@context']).toBe('https://schema.org');
    expect(episodeVideoObject(episode)).not.toHaveProperty('@context');
  });
});

describe('episodeListJsonLd', () => {
  it('is an ordered ItemList in the order it was given', () => {
    const list = episodeListJsonLd(makeShow().episodes);
    expect(list['@type']).toBe('ItemList');
    const items = list.itemListElement as { position: number; url: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[0].url).toBe('https://dungeoncrawlcast.com/ep/1');
  });
});

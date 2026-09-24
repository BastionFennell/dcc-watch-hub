/** Running times and the pictures a row falls back to (011 §3.2). */
import { describe, expect, it } from 'vitest';
import {
  crawlerOgImage,
  episodeOgImage,
  episodeThumb,
  formatDuration,
  youtubeEmbed,
  youtubeThumb,
} from './media';
import { makeCrawlers, makeShow } from '../test/fixtures';

const episode = makeShow().episodes[0];

describe('youtubeEmbed', () => {
  it('is the player URL for a video id', () => {
    expect(youtubeEmbed('abc123')).toBe('https://www.youtube.com/embed/abc123');
  });
});

describe('formatDuration', () => {
  it('is m:ss under the hour and h:mm:ss over it', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(635)).toBe('10:35');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3723)).toBe('1:02:03');
  });

  it('never renders a negative running time', () => {
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('images', () => {
  it('falls back to the host still when no share image is authored', () => {
    expect(episodeThumb(episode)).toBe(youtubeThumb(episode.youtubeId));
    expect(episodeOgImage(episode)).toBe('/og/ep1.png');
  });

  it('prefers an authored share image', () => {
    const authored = { ...episode, ogImage: '/og/custom.png' };
    expect(episodeThumb(authored)).toBe('/og/custom.png');
    expect(episodeOgImage(authored)).toBe('/og/custom.png');
  });

  it('names the crawler card the OG renderer writes', () => {
    const [stuntman] = makeCrawlers().crawlers;
    expect(crawlerOgImage(stuntman)).toBe('/og/crawler-stuntman.png');
    expect(crawlerOgImage({ ...stuntman, og: '/og/hand-made.png' })).toBe('/og/hand-made.png');
  });
});

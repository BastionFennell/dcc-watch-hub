/**
 * The broadcast-delay rule, tested on both sides of the timestamp (011 §8:
 * "Newest-episode CTA correctly flips YouTube -> hub at `hubLiveAt`").
 */
import { describe, expect, it } from 'vitest';
import { countdown, ctaFor, hubLive, msUntilHubLive, newestEpisode } from './gate';
import { siteCopy } from './copy';
import { makeShow } from '../test/fixtures';
import type { EpisodeMeta, ShowLinks } from '../data/types';

const LIVE_AT = '2026-10-10T17:00:00Z';
const gate = Date.parse(LIVE_AT);

const links: ShowLinks = {
  youtube: 'https://www.youtube.com/@DungeonCrawlCast',
  discord: 'https://discord.gg/REPLACE_ME',
};

function episode(overrides: Partial<EpisodeMeta> = {}): EpisodeMeta {
  return {
    id: 4,
    title: 'Episode 4',
    youtubeId: 'aqz-KE-bpKQ',
    floor: 2,
    durationSec: 600,
    dataUrl: '/data/ep4.json',
    premiereAt: '2026-10-08T17:00:00Z',
    hubLiveAt: LIVE_AT,
    ...overrides,
  };
}

describe('hubLive', () => {
  it('is false one millisecond before the gate and true on it', () => {
    expect(hubLive(episode(), gate - 1)).toBe(false);
    expect(hubLive(episode(), gate)).toBe(true);
    expect(hubLive(episode(), gate + 1)).toBe(true);
  });

  it('treats an episode with no gate as live now', () => {
    expect(hubLive(episode({ hubLiveAt: undefined }), 0)).toBe(true);
    expect(hubLive(episode({ hubLiveAt: '' }), 0)).toBe(true);
  });

  it('treats an unparseable gate as live rather than hiding the episode', () => {
    expect(hubLive(episode({ hubLiveAt: 'some friday' }), 0)).toBe(true);
  });
});

describe('msUntilHubLive', () => {
  it('counts down to the gate, then reads zero', () => {
    expect(msUntilHubLive(episode(), gate - 90_000)).toBe(90_000);
    expect(msUntilHubLive(episode(), gate)).toBe(0);
    expect(msUntilHubLive(episode(), gate + 90_000)).toBe(0);
    expect(msUntilHubLive(episode({ hubLiveAt: undefined }), 0)).toBe(0);
  });
});

describe('ctaFor', () => {
  it('points at YouTube before the gate', () => {
    expect(ctaFor(episode(), gate - 1, links)).toEqual({
      kind: 'youtube',
      href: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      label: siteCopy.watchOnYouTube,
    });
  });

  it('points at the System feed on and after the gate', () => {
    expect(ctaFor(episode(), gate, links)).toEqual({
      kind: 'hub',
      href: '/ep/4',
      label: siteCopy.openSystemFeed,
    });
    expect(ctaFor(episode(), gate + 86_400_000, links).kind).toBe('hub');
  });

  it('falls back to the channel when the episode has no video id', () => {
    expect(ctaFor(episode({ youtubeId: '' }), gate - 1, links).href).toBe(links.youtube);
  });
});

describe('countdown', () => {
  it('formats the ladder the chip shows', () => {
    expect(countdown(2 * 86_400_000 + 4 * 3_600_000)).toBe('2d 4h');
    expect(countdown(4 * 3_600_000 + 12 * 60_000)).toBe('4h 12m');
    expect(countdown(12 * 60_000)).toBe('12m');
    expect(countdown(0)).toBe('now');
  });

  it('never prints a zero unit', () => {
    expect(countdown(2 * 86_400_000)).toBe('2d');
    expect(countdown(3 * 3_600_000)).toBe('3h');
    expect(countdown(86_400_000 + 59_000)).toBe('1d');
  });

  it('reads "now" for the last minute, and for time already past', () => {
    expect(countdown(59_999)).toBe('now');
    expect(countdown(-5)).toBe('now');
    expect(countdown(Number.NaN)).toBe('now');
  });

  it('rounds down, so a chip never promises time it does not have', () => {
    expect(countdown(119_999)).toBe('1m');
    expect(countdown(2 * 86_400_000 - 1)).toBe('1d 23h');
  });
});

describe('newestEpisode', () => {
  it('picks the highest id filed under a floor', () => {
    expect(newestEpisode(makeShow())?.id).toBe(3);
  });

  it('ignores an episode that is in the list but under no floor', () => {
    const show = makeShow();
    const unfiled = { ...show.episodes[0], id: 9, title: 'Episode 9', dataUrl: '/data/ep9.json' };
    expect(newestEpisode({ ...show, episodes: [...show.episodes, unfiled] })?.id).toBe(3);
  });

  it('ignores a floor entry with no episode behind it', () => {
    const show = makeShow();
    const seasons = [
      {
        season: 1,
        floors: [{ floor: 3, label: 'Floor 3', episodes: [99] }, ...show.seasons[0].floors],
      },
    ];
    expect(newestEpisode({ ...show, seasons })?.id).toBe(3);
  });

  it('answers null for a show with no episodes at all', () => {
    expect(newestEpisode({ ...makeShow(), episodes: [], seasons: [] })).toBeNull();
  });
});

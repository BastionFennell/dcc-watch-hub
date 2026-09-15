import { describe, expect, it, vi } from 'vitest';
import {
  episodesByFloor,
  findEpisode,
  orderedEpisodeIds,
  orderedEpisodes,
  prevNext,
  seasonOf,
} from './show';
import { makeShow } from '../test/fixtures';

describe('ordering', () => {
  it('orders episodes across two floors', () => {
    expect(orderedEpisodeIds(makeShow())).toEqual([1, 2, 3]);
    expect(orderedEpisodes(makeShow()).map((e) => e.title)).toEqual([
      'Episode 1 — The World Dungeon',
      'Episode 2 — The Meat District',
      'Episode 3 — Descent',
    ]);
  });

  it('finds an episode by id', () => {
    expect(findEpisode(makeShow(), 2)?.floor).toBe(1);
    expect(findEpisode(makeShow(), 999)).toBeUndefined();
  });

  it('has no prev at the first episode and no next at the last', () => {
    const show = makeShow();
    expect(prevNext(show, 1).prev).toBeUndefined();
    expect(prevNext(show, 1).next?.id).toBe(2);
    expect(prevNext(show, 2).prev?.id).toBe(1);
    expect(prevNext(show, 2).next?.id).toBe(3);
    expect(prevNext(show, 3).next).toBeUndefined();
    expect(prevNext(show, 999)).toEqual({});
  });

  it('reports the season for an episode', () => {
    expect(seasonOf(makeShow(), 3)).toBe(1);
  });
});

describe('episodesByFloor', () => {
  it('groups episodes under their floor labels in order', () => {
    const groups = episodesByFloor(makeShow());
    expect(groups.map((g) => g.label)).toEqual(['Floor 1', 'Floor 2']);
    expect(groups[0].episodes.map((e) => e.id)).toEqual([1, 2]);
    expect(groups[1].episodes.map((e) => e.id)).toEqual([3]);
  });

  it('files episodes missing from every floor into a trailing group and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const show = makeShow();
    show.episodes.push({
      id: 4,
      title: 'Episode 4 — Unfiled',
      youtubeId: 'M7lc1UVf-VE',
      floor: 2,
      durationSec: 240,
      dataUrl: '/data/ep4.json',
    });
    const groups = episodesByFloor(show);
    expect(groups.at(-1)?.episodes.map((e) => e.id)).toEqual([4]);
    expect(orderedEpisodeIds(show)).toEqual([1, 2, 3, 4]);
    warn.mockRestore();
  });
});

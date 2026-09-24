/**
 * The spoiler gate, against the real sample episodes: the status file must
 * describe the newest episode a viewer is allowed to have seen, and no other.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildStatus, publishedEpisode } from './status';
import { normalizeEpisode, normalizeShow } from '../src/data/validate';
import type { EpisodeMeta, Show } from '../src/data/types';

const root = resolve(__dirname, '..');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const show: Show = normalizeShow(readJson(resolve(root, 'public/data/show.json')));

function loadEpisode(meta: EpisodeMeta) {
  return normalizeEpisode(readJson(resolve(root, `public${meta.dataUrl}`)));
}

const gate = (id: number) => Date.parse(show.episodes.find((e) => e.id === id)?.hubLiveAt ?? '');

describe('publishedEpisode', () => {
  it('is the newest episode past its gate', () => {
    expect(publishedEpisode(show, gate(3))?.id).toBe(3);
    expect(publishedEpisode(show, gate(3) - 1)?.id).toBe(2);
    expect(publishedEpisode(show, gate(2) - 1)?.id).toBe(1);
  });

  it('is null before anything has unlocked', () => {
    expect(publishedEpisode(show, gate(1) - 1)).toBeNull();
  });

  it('treats an episode with no gate as published', () => {
    const ungated: Show = {
      ...show,
      episodes: show.episodes.map((episode) =>
        episode.id === 3 ? { ...episode, hubLiveAt: undefined } : episode,
      ),
    };
    expect(publishedEpisode(ungated, 0)?.id).toBe(3);
  });
});

describe('buildStatus', () => {
  it('reduces the newest published episode to its end', () => {
    const status = buildStatus(show, loadEpisode, gate(3));
    expect(status.episodeId).toBe(3);
    expect(Object.keys(status.crawlers)).toEqual(['harry', 'mimi', 'ronald', 'xo', 'veil']);
    expect(status.crawlers.xo.lastEpisodeId).toBe(3);
    // Episode 3 is on floor 2, and the map says so.
    expect(status.crawlers.xo.floor).toBe(2);
    expect(status.crawlers.xo.level).toBeGreaterThanOrEqual(1);
    expect(status.crawlers.xo.hp.max).toBeGreaterThan(0);
    expect(status.crawlers.xo.hp.current).toBeLessThanOrEqual(status.crawlers.xo.hp.max);
  });

  it('agrees with the reducer run over the same episode', () => {
    const status = buildStatus(show, loadEpisode, gate(3));
    const episode = loadEpisode(show.episodes[2]);
    const last = episode.events.filter((event) => event.type === 'level_up').at(-1);
    if (last !== undefined && last.type === 'level_up') {
      expect(status.crawlers[last.actor].level).toBe(last.level);
    }
  });

  it('falls back to the previous episode before the newest unlocks', () => {
    const status = buildStatus(show, loadEpisode, gate(3) - 1);
    expect(status.episodeId).toBe(2);
    expect(status.crawlers.harry.lastEpisodeId).toBe(2);
    expect(status.crawlers.harry.floor).toBe(1);
  });

  it('emits an empty file, not a failure, before anything is published', () => {
    const loader = vi.fn(loadEpisode);
    const status = buildStatus(show, loader, gate(1) - 1);
    expect(status).toEqual({
      generatedAt: new Date(gate(1) - 1).toISOString(),
      episodeId: null,
      crawlers: {},
    });
    // Nothing was read: there was nothing to read.
    expect(loader).not.toHaveBeenCalled();
  });

  it('omits a crawler the published episode does not carry', () => {
    const status = buildStatus(
      show,
      (meta) => {
        const episode = loadEpisode(meta);
        return {
          ...episode,
          initialState: {
            ...episode.initialState,
            party: episode.initialState.party.filter((crawler) => crawler.id !== 'veil'),
          },
          events: episode.events.filter(
            (event) => !('actor' in event) || event.actor !== 'veil',
          ),
        };
      },
      gate(3),
    );
    expect(Object.keys(status.crawlers)).not.toContain('veil');
    expect(Object.keys(status.crawlers)).toHaveLength(4);
  });

  it('stamps the file with the time it was built', () => {
    const status = buildStatus(show, loadEpisode, Date.parse('2026-09-20T12:00:00Z'));
    expect(status.generatedAt).toBe('2026-09-20T12:00:00.000Z');
  });
});

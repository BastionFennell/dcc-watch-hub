/**
 * The shipped sample data is the contract's only executable proof. If an editor
 * (or a later wave) breaks public/data/*.json, this fails before the app does.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Show, EpisodeData } from './types';
import { isShow, normalizeEpisode } from './validate';
import { orderedEpisodeIds } from './show';

const root = resolve(__dirname, '../..');
const contracts = resolve(root, 'specs/001-watch-hub-v1/contracts');
// 003 revision 2 extends the v2 episode contract (equip/unequip events, crawler gear and art).
const episodeSchemaPath = resolve(root, 'specs/003-crawler-record/contracts/episode.schema.json');
const dataDir = resolve(root, 'public/data');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validateShow = ajv.compile(readJson(resolve(contracts, 'show.schema.json')) as object);
const validateEpisode = ajv.compile(readJson(episodeSchemaPath) as object);

const showRaw = readJson(resolve(dataDir, 'show.json'));

describe('public/data/show.json', () => {
  it('validates against contracts/show.schema.json', () => {
    const ok = validateShow(showRaw);
    expect(validateShow.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('passes the runtime guard', () => {
    expect(isShow(showRaw)).toBe(true);
  });

  it('lists every episode under a floor', () => {
    const show = showRaw as Show;
    expect(orderedEpisodeIds(show)).toEqual(show.episodes.map((e) => e.id));
  });
});

const show = showRaw as Show;

describe.each(show.episodes.map((meta) => [meta.id, meta] as const))(
  'public/data/ep%i.json',
  (id, meta) => {
    const path = resolve(root, `public${meta.dataUrl}`);

    it('exists at the dataUrl declared in show.json', () => {
      expect(existsSync(path)).toBe(true);
    });

    const raw = readJson(path);

    it('validates against contracts/episode.schema.json', () => {
      const ok = validateEpisode(raw);
      expect(validateEpisode.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
    });

    it('reports the matching episodeId', () => {
      expect((raw as EpisodeData).episodeId).toBe(id);
    });

    it('is rich enough to exercise every story', () => {
      const episode = normalizeEpisode(raw);
      expect(episode.events.length).toBeGreaterThanOrEqual(25);
      // Raised from 60 in 003 revision 2: ep1 carries X.O.'s nine skills and
      // Harry's eleven hotlist marks on top of the v2 log.
      expect(episode.events.length).toBeLessThanOrEqual(80);

      const counts = new Map<string, number>();
      for (const event of episode.events) {
        const type = event.type === 'unknown' ? 'unknown' : event.type;
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
      const known = [
        'system_message',
        'achievement',
        'loot',
        'hp',
        'level_up',
        'rank',
        'map_reveal',
        'sponsor',
        'chapter',
        'status',
        'inventory',
        'note',
        'skill',
        'class',
        'hotlist',
        'equip',
        'unequip',
      ];
      for (const type of known) {
        expect(counts.get(type) ?? 0, `${type} appears at least twice`).toBeGreaterThanOrEqual(2);
      }
      expect(counts.get('unknown') ?? 0, 'forward-compatibility event present').toBe(1);
    });

    it('has ascending t values inside the episode duration', () => {
      const episode = normalizeEpisode(raw);
      const times = episode.events.map((event) => event.t);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...times)).toBeLessThanOrEqual(meta.durationSec);
    });

    it('references only real party ids (the unknown event aside)', () => {
      const episode = normalizeEpisode(raw);
      const ids = new Set(episode.initialState.party.map((crawler) => crawler.id));
      for (const event of episode.events) {
        if (event.type === 'unknown') continue;
        if ('actor' in event && event.actor !== undefined) {
          expect(ids, `actor ${event.actor} at t=${event.t}`).toContain(event.actor);
        }
      }
    });

    it('points every portrait at a file that exists', () => {
      const episode = normalizeEpisode(raw);
      for (const crawler of episode.initialState.party) {
        expect(existsSync(resolve(root, `public${crawler.portrait}`))).toBe(true);
      }
    });

    it('gives every crawler starting gear, and art points at a real file', () => {
      const episode = normalizeEpisode(raw);
      const withArt = episode.initialState.party.filter((crawler) => crawler.art !== undefined);
      expect(withArt.length, 'at least two crawlers carry full-figure art').toBeGreaterThanOrEqual(2);
      for (const crawler of episode.initialState.party) {
        expect(crawler.gear, `${crawler.id} has starting gear`).toBeDefined();
        if (crawler.art !== undefined) {
          expect(existsSync(resolve(root, `public${crawler.art}`))).toBe(true);
        }
      }
    });
  },
);

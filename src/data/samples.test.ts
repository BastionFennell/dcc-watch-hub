/**
 * The shipped sample data is the contract's only executable proof. If an editor
 * (or a later wave) breaks public/data/*.json, this fails before the app does.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { EpisodeData, NpcEvent, Registry, Show } from './types';
import { isRegistry, isShow, normalizeEpisode, normalizeRegistry } from './validate';
import { orderedEpisodeIds } from './show';

const root = resolve(__dirname, '../..');
// 007 extends the 003 contracts: the episode gains the `npc` branch, the show
// gains `registryUrl`, and the registry file has a schema of its own.
const contracts = resolve(root, 'specs/007-npc-registry/contracts');
const episodeSchemaPath = resolve(contracts, 'episode.schema.json');
const dataDir = resolve(root, 'public/data');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validateShow = ajv.compile(readJson(resolve(contracts, 'show.schema.json')) as object);
const validateEpisode = ajv.compile(readJson(episodeSchemaPath) as object);
const validateRegistry = ajv.compile(readJson(resolve(contracts, 'npcs.schema.json')) as object);

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
        'npc',
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

    // 008: the invented five-crawler party is gone. Every episode ships the
    // same four crawlers read off the author's filled sheets, in rail order.
    it('carries the four real crawlers', () => {
      const episode = normalizeEpisode(raw);
      expect(episode.initialState.party.map((crawler) => crawler.id)).toEqual([
        'harry',
        'mimi',
        'ronald',
        'xo',
      ]);
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

/* --------------------------------------------- 007: the entity registry */

const registryRaw = readJson(resolve(root, `public${show.registryUrl ?? '/data/npcs.json'}`));

describe('public/data/npcs.json', () => {
  it('is the file show.json points at', () => {
    expect(show.registryUrl).toBe('/data/npcs.json');
    expect(existsSync(resolve(root, `public${show.registryUrl}`))).toBe(true);
  });

  it('validates against contracts/npcs.schema.json', () => {
    const ok = validateRegistry(registryRaw);
    expect(validateRegistry.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('passes the runtime guard with nothing dropped', () => {
    expect(isRegistry(registryRaw)).toBe(true);
    const registry = normalizeRegistry(registryRaw);
    expect(registry.entities).toHaveLength((registryRaw as Registry).entities.length);
  });

  it('covers every kind, with unique ids and facts to unlock', () => {
    const registry = normalizeRegistry(registryRaw);
    const byKind = new Map<string, number>();
    for (const entity of registry.entities) {
      byKind.set(entity.kind, (byKind.get(entity.kind) ?? 0) + 1);
      expect(entity.facts.length, `${entity.id} has facts`).toBeGreaterThanOrEqual(2);
      expect(entity.facts.length).toBeLessThanOrEqual(4);
    }
    expect(registry.entities.length).toBeGreaterThanOrEqual(8);
    expect(byKind.get('boss') ?? 0).toBeGreaterThanOrEqual(3);
    expect(byKind.get('vendor') ?? 0).toBeGreaterThanOrEqual(2);
    expect(byKind.get('ally') ?? 0).toBeGreaterThanOrEqual(3);

    const ids = registry.entities.map((entity) => entity.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every portrait at a file that exists', () => {
    const registry = normalizeRegistry(registryRaw);
    const withPortrait = registry.entities.filter((entity) => entity.portrait !== undefined);
    expect(withPortrait.length).toBeGreaterThanOrEqual(2);
    for (const entity of withPortrait) {
      expect(existsSync(resolve(root, `public${entity.portrait}`)), entity.id).toBe(true);
    }
  });
});

describe('npc events across the sample episodes', () => {
  const registry = normalizeRegistry(registryRaw);
  const ids = new Set(registry.entities.map((entity) => entity.id));

  /** Every `npc` event in every sample episode, tagged with its episode. */
  const npcEvents = show.episodes.flatMap((meta) => {
    const episode = normalizeEpisode(readJson(resolve(root, `public${meta.dataUrl}`)));
    return episode.events
      .filter((event) => event.type === 'npc')
      .map((event) => ({ episodeId: meta.id, event: event as NpcEvent }));
  });

  it('gives every episode at least four, covering every action', () => {
    for (const meta of show.episodes) {
      const mine = npcEvents.filter((entry) => entry.episodeId === meta.id);
      expect(mine.length, `ep${meta.id}`).toBeGreaterThanOrEqual(4);
      const actions = new Set(mine.map((entry) => entry.event.action));
      for (const action of ['met', 'seen', 'update', 'defeated']) {
        expect(actions, `ep${meta.id} covers ${action}`).toContain(action);
      }
      expect(
        mine.some((entry) => (entry.event.unlock ?? []).length > 0),
        `ep${meta.id} unlocks a fact`,
      ).toBe(true);
    }
  });

  it('names exactly one entity the registry has never heard of, in episode 1', () => {
    const unknown = npcEvents.filter((entry) => !ids.has(entry.event.id));
    expect(unknown.map((entry) => entry.event.id)).toEqual(['the-listener-below']);
    expect(unknown[0].episodeId).toBe(1);
  });

  it('unlocks only facts the named entity actually carries', () => {
    for (const { episodeId, event } of npcEvents) {
      for (const fact of event.unlock ?? []) {
        const entity = registry.entities.find((candidate) => candidate.id === event.id);
        expect(entity, `ep${episodeId} t=${event.t} entity ${event.id}`).toBeDefined();
        expect(
          entity?.facts.map((candidate) => candidate.id),
          `ep${episodeId} t=${event.t} fact ${fact}`,
        ).toContain(fact);
      }
    }
  });

  it('carries one entity across two episodes, and amends an earlier one later', () => {
    const episodesOf = (id: string) =>
      new Set(npcEvents.filter((entry) => entry.event.id === id).map((entry) => entry.episodeId));
    expect([...episodesOf('grull-rep')].sort()).toEqual([1, 2]);

    // Episode 2 releases a fact about an entity episode 1 introduced.
    const late = npcEvents.find(
      (entry) =>
        entry.episodeId === 2 &&
        entry.event.action === 'update' &&
        (entry.event.unlock ?? []).length > 0 &&
        episodesOf(entry.event.id).has(1),
    );
    expect(late?.event.id).toBe('the-hoarder');
    expect(late?.event.unlock).toEqual(['ledger']);
  });
});

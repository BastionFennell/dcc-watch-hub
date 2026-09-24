/**
 * T1011 - the export is the contract.
 *
 * Two claims are load-bearing here: what the Studio writes validates against
 * the 009 episode schema (the same Ajv check `src/data/samples.test.ts` runs),
 * and importing a published episode then exporting it changes nothing the
 * viewer can see - same normalized data, same `reduceTo` at every probe.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { Show } from '../data/types';
import { normalizeEpisode } from '../data/validate';
import { reduceTo } from '../engine/reducer';
import { makeEpisodeRaw } from '../test/fixtures';
import { buildEvent } from './buildEvent';
import type { DraftMeta } from './draft';
import { draftFromEpisode, newDraft } from './draft';
import { episodeFileName, orderEventKeys, toEpisodeJson, toShowEntry, toShowEntryJson } from './exporter';
import { fromEpisodeJson } from './importer';
import { crawlerFromState, partyFromFinalState, partyFromInitial } from './partySource';

const root = resolve(__dirname, '../..');
const episodeSchemaPath = resolve(root, 'specs/009-mana/contracts/episode.schema.json');
const dataDir = resolve(root, 'public/data');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateEpisode = ajv.compile(readJson(episodeSchemaPath) as object);

const show = readJson(resolve(dataDir, 'show.json')) as Show;

const META: DraftMeta = {
  id: 1,
  title: 'Episode 1',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 1,
  durationSec: 240,
};

describe('orderEventKeys', () => {
  it('writes t, type, actor, then the table order', () => {
    const event = { desc: 'x', rank: 2, actor: 'xo', type: 'skill', name: 'Tail Whip', t: 10 };
    expect(Object.keys(orderEventKeys(event))).toEqual([
      't',
      'type',
      'actor',
      'name',
      'rank',
      'desc',
    ]);
  });

  it('keeps a later schema field rather than dropping it', () => {
    const event = { t: 10, type: 'future_type', headline: 'later', tier: 3 };
    expect(orderEventKeys(event)).toEqual(event);
  });

  it('changes no value', () => {
    const event = buildEvent('map_reveal', 10, { cells: [[1, 2]], label: 'The Rot Market' });
    expect(orderEventKeys(event)).toEqual(event);
  });
});

describe('toEpisodeJson', () => {
  const draft = draftFromEpisode(META, makeEpisodeRaw());

  it('is two-space indented with a trailing newline', () => {
    const text = toEpisodeJson(draft);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "episodeId": 1,');
    expect(text).not.toContain('\t');
  });

  it('parses back to the draft, events sorted', () => {
    const parsed = JSON.parse(toEpisodeJson(draft)) as { events: { t: number }[] };
    const times = parsed.events.map((event) => event.t);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('validates against the 009 episode schema', () => {
    const ok = validateEpisode(JSON.parse(toEpisodeJson(draft)));
    expect(validateEpisode.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('validates with one event of every type, built through the form table', () => {
    const base = draftFromEpisode(META, makeEpisodeRaw());
    const events = [
      buildEvent('system_message', 1, { text: 'live' }),
      buildEvent('note', 2, { text: 'note' }),
      buildEvent('chapter', 3, { label: 'Boss', kind: 'boss' }),
      buildEvent('sponsor', 4, { text: 'Grull', durationSec: 20 }),
      buildEvent('hp', 5, { actor: 'harry', current: 4, max: 22 }),
      buildEvent('mana', 6, { actor: 'psychic', current: 2 }),
      buildEvent('level_up', 7, { actor: 'xo', level: 2 }),
      buildEvent('rank', 8, { actor: 'harry', rank: 12 }),
      buildEvent('achievement', 9, { actor: 'harry', title: 'Gate Crasher', desc: 'One door.' }),
      buildEvent('class', 10, { actor: 'harry', class: 'Anarchist' }),
      buildEvent('status', 11, { actor: 'harry', add: ['Poisoned'], remove: [] }),
      buildEvent('loot', 12, { actor: 'harry', item: 'Torch', source: 'Box' }),
      buildEvent('inventory', 13, { actor: 'harry', add: ['Torch'], remove: [] }),
      buildEvent('equip', 14, { actor: 'harry', slot: 'hands', item: 'Torch' }),
      buildEvent('unequip', 15, { actor: 'harry', slot: 'hands' }),
      buildEvent('skill', 16, { actor: 'xo', name: 'Tail Whip', rank: 4 }),
      buildEvent('spell', 17, { actor: 'psychic', ref: 'mending-light', rank: 2 }),
      buildEvent('hotlist', 18, { actor: 'harry', add: ['Door'], remove: [] }),
      buildEvent('map_reveal', 19, { cells: [[1, 2]], label: 'Quadrant C' }),
      buildEvent('npc', 20, { id: 'hoarder', action: 'met', unlock: ['lair'], actor: 'harry' }),
    ];
    const draft = {
      ...base,
      events: events.map((event, index) => ({ uid: `u${index}`, event })),
    };
    const ok = validateEpisode(JSON.parse(toEpisodeJson(draft)));
    expect(validateEpisode.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe('toShowEntry', () => {
  it('is the show.json row, with the dataUrl derived from the id', () => {
    expect(toShowEntry(draftFromEpisode({ ...META, id: 4 }, makeEpisodeRaw()))).toEqual({
      id: 4,
      title: 'Episode 1',
      youtubeId: 'aqz-KE-bpKQ',
      floor: 1,
      durationSec: 240,
      dataUrl: '/data/ep4.json',
    });
    expect(episodeFileName(newDraft({ ...META, id: 4 }))).toBe('ep4.json');
    expect(toShowEntryJson(newDraft({ ...META, id: 4 })).endsWith('}\n')).toBe(true);
  });
});

/* ------------------------------------------------- the published episodes */

const PROBES = [0, 30, 120, 300, 600, 1200];

describe.each(show.episodes.map((meta) => [meta.id, meta] as const))(
  'public/data/ep%i.json round-trips through the Studio',
  (id, meta) => {
    const path = resolve(root, `public${meta.dataUrl}`);
    const raw = readJson(path);
    const { draft, warnings } = fromEpisodeJson(readFileSync(path, 'utf8'), {
      id: meta.id,
      title: meta.title,
      youtubeId: meta.youtubeId,
      floor: meta.floor,
      durationSec: meta.durationSec,
    });
    const exported = JSON.parse(toEpisodeJson(draft)) as unknown;

    it('imports with no warning beyond the deliberate future-schema row', () => {
      expect(warnings.every((warning) => warning.includes('this build does not know'))).toBe(true);
    });

    it('still validates against the schema', () => {
      const ok = validateEpisode(exported);
      expect(validateEpisode.errors ?? []).toEqual([]);
      expect(ok).toBe(true);
    });

    it('normalizes to exactly the same episode data', () => {
      expect(normalizeEpisode(exported)).toEqual(normalizeEpisode(raw));
      expect((exported as { episodeId: number }).episodeId).toBe(id);
    });

    it('reduces to the same overlay state at every probe', () => {
      const before = normalizeEpisode(raw);
      const after = normalizeEpisode(exported);
      for (const t of PROBES) {
        expect(reduceTo(after, t), `t = ${t}`).toEqual(reduceTo(before, t));
      }
    });
  },
);

/* --------------------------------------------------------- party sources */

describe('partyFromInitial', () => {
  const raw = readJson(resolve(dataDir, 'ep1.json'));

  it('copies the starting party without aliasing the file', () => {
    const party = partyFromInitial(raw) as { id: string }[];
    expect(party.map((crawler) => crawler.id)).toEqual(['harry', 'mimi', 'ronald', 'xo', 'veil']);
    party[0].id = 'changed';
    expect((partyFromInitial(raw) as { id: string }[])[0].id).toBe('harry');
  });

  it('is empty for anything that is not an episode', () => {
    expect(partyFromInitial(null)).toEqual([]);
    expect(partyFromInitial({ initialState: {} })).toEqual([]);
  });
});

describe('partyFromFinalState', () => {
  const raw = readJson(resolve(dataDir, 'ep1.json'));
  const episode = normalizeEpisode(raw);
  const final = reduceTo(episode, Number.POSITIVE_INFINITY);

  it('carries the end-of-episode sheet into a valid next episode', () => {
    const party = partyFromFinalState(raw);
    expect(party.map((crawler) => crawler.id)).toEqual(final.party.map((crawler) => crawler.id));

    const next = {
      episodeId: 2,
      initialState: { party, map: { floor: 2, grid: { cols: 12, rows: 8 }, revealed: [] } },
      events: [],
    };
    const ok = validateEpisode(next);
    expect(validateEpisode.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('reproduces hp, mana, level, class, rank, inventory, gear and spells', () => {
    const party = partyFromFinalState(raw);
    const seeded = reduceTo(
      normalizeEpisode({
        episodeId: 2,
        initialState: { party, map: { floor: 2, grid: { cols: 12, rows: 8 }, revealed: [] } },
        events: [],
      }),
      0,
    );
    for (const [index, crawler] of seeded.party.entries()) {
      const before = final.party[index];
      expect(crawler.hp, crawler.id).toEqual(before.hp);
      expect(crawler.mana, crawler.id).toEqual(before.mana);
      expect(crawler.level, crawler.id).toBe(before.level);
      expect(crawler.class, crawler.id).toBe(before.class);
      expect(crawler.rank, crawler.id).toBe(before.rank);
      expect(crawler.inventory, crawler.id).toEqual(before.inventory);
      expect(crawler.hotlist, crawler.id).toEqual(before.hotlist);
      expect(crawler.skills, crawler.id).toEqual(before.skills);
      expect(crawler.spells, crawler.id).toEqual(before.spells);
      expect(crawler.gear, crawler.id).toEqual(before.gear);
    }
  });

  it('drops statuses and achievements, which a sheet has no room for', () => {
    const withStatus = final.party.find((crawler) => crawler.statuses.length > 0);
    const sheet = crawlerFromState(withStatus ?? final.party[0]);
    expect('statuses' in sheet).toBe(false);
    expect('achievements' in sheet).toBe(false);
  });

  it('writes a bare entry as the string shorthand and keeps a structured one', () => {
    const sheet = crawlerFromState({
      ...final.party[0],
      inventory: [{ name: 'Torch' }, { name: 'Rations', qty: 3, desc: 'Grey.' }],
      hotlist: [{ ref: 'heal' }],
    });
    expect(sheet.inventory).toEqual(['Torch', { name: 'Rations', qty: 3, desc: 'Grey.' }]);
    expect(sheet.hotlist).toEqual([{ ref: 'heal' }]);
  });

  it('is empty when the source episode cannot be normalized', () => {
    expect(partyFromFinalState({ episodeId: 1 })).toEqual([]);
    expect(partyFromFinalState('nonsense')).toEqual([]);
  });
});

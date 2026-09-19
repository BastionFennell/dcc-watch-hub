/**
 * The converter is the editor's only tool, so its samples are its contract
 * (constitution VI: a sample CSV and an automated check proving it flags a
 * deliberately broken row).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { InitialState, Registry, SpellRegistry } from '../src/data/types';
import {
  convert,
  initialStateSpellWarnings,
  parseArgs,
  parseTimecode,
  rowToEvent,
  spellField1,
} from './sheet-to-json';
import type { RowContext, SheetRow } from './sheet-to-json';
import { normalizeRegistry, validateSpells } from '../src/data/validate';

const root = resolve(__dirname, '..');
const samples = resolve(root, 'scripts/samples');
const schemaPath = resolve(root, 'specs/009-mana/contracts/episode.schema.json');

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateEpisode = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')) as object);

const initialState = JSON.parse(
  readFileSync(resolve(samples, 'ep1.initial.json'), 'utf8'),
) as InitialState;

function read(name: string): string {
  return readFileSync(resolve(samples, name), 'utf8');
}

function ctx() {
  return { episodeId: 1, durationSec: 240, initialState };
}

/**
 * The shipped registry, which is what `--registry public/data/npcs.json` loads -
 * the same file the sample rows name (007 R6).
 */
const sampleRegistry: Registry = normalizeRegistry(
  JSON.parse(readFileSync(resolve(root, 'public/data/npcs.json'), 'utf8')) as unknown,
);

/** The same context, plus the registry `--registry` would have loaded. */
function ctxWithRegistry() {
  return { ...ctx(), registry: sampleRegistry };
}

/** The shipped spell registry - what `--spells public/data/spells.json` loads. */
const sampleSpells: SpellRegistry = validateSpells(
  JSON.parse(readFileSync(resolve(root, 'public/data/spells.json'), 'utf8')) as unknown,
);

/** 1-based data row (header excluded) of the first line containing `needle`. */
function dataRow(csv: string, needle: string): number {
  const lines = csv.trimEnd().split('\n').slice(1);
  const index = lines.findIndex((line) => line.includes(needle));
  expect(index, `sample row containing ${needle}`).toBeGreaterThanOrEqual(0);
  return index + 1;
}

function warningFor(warnings: string[], row: number, needle: string): string | undefined {
  return warnings.find((w) => w.startsWith(`row ${row}:`) && w.includes(needle));
}

function rowCtx(registry?: Registry, spells?: SpellRegistry): RowContext {
  return {
    ...(registry === undefined ? {} : { registry }),
    ...(spells === undefined ? {} : { spells }),
    partyIds: new Set(initialState.party.map((crawler) => crawler.id)),
    durationSec: 240,
    hpState: new Map(
      initialState.party.map((crawler) => [
        crawler.id,
        { current: crawler.hp.current, max: crawler.hp.max },
      ]),
    ),
  };
}

function sheetRow(partial: Partial<SheetRow>): SheetRow {
  return { timecode: '0:10', type: 'note', actor: '', field1: '', field2: '', field3: '', ...partial };
}

/* --------------------------------------------------------- parseTimecode */

describe('parseTimecode', () => {
  it.each([
    ['0:06', 6],
    ['00:14', 14],
    ['1:30', 90],
    ['90:00', 5400],
    ['0:00:22', 22],
    ['1:02:03', 3723],
    ['01:30:00', 5400],
    ['28', 28],
    ['238.5', 238.5],
    ['0', 0],
    [' 2:04 ', 124],
    ['1:02.5', 62.5],
  ])('reads %s as %d seconds', (raw, seconds) => {
    expect(parseTimecode(raw)).toBe(seconds);
  });

  it.each([['abc'], [''], ['   '], ['1:2:3:4'], ['-30'], ['1:75'], ['12:99:00'], ['1,30'], ['1:30m']])(
    'rejects %j',
    (raw) => {
      expect(parseTimecode(raw)).toBeNull();
    },
  );
});

/* ---------------------------------------------------------- clean sample */

describe('convert(scripts/samples/ep1.csv)', () => {
  const result = convert(read('ep1.csv'), ctx());

  it('reports no errors and no warnings', () => {
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('produces an episode with one event per data row', () => {
    const rows = read('ep1.csv').trimEnd().split('\n').length - 1;
    expect(result.episode).toBeDefined();
    expect(result.episode?.episodeId).toBe(1);
    expect(result.episode?.events).toHaveLength(rows);
  });

  it('sorts events by t even though the sheet is out of order', () => {
    const times = result.episode?.events.map((event) => event.t) ?? [];
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.length).toBeGreaterThan(0);
  });

  it('validates against contracts/episode.schema.json', () => {
    const ok = validateEpisode(result.episode);
    expect(validateEpisode.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('covers every documented event type', () => {
    const types = new Set(result.episode?.events.map((event) => event.type));
    for (const type of [
      'system_message',
      'achievement',
      'loot',
      'hp',
      'mana',
      'level_up',
      'rank',
      'map_reveal',
      'sponsor',
      'chapter',
      'status',
      'inventory',
      'note',
      'skill',
      'spell',
      'class',
      'hotlist',
      'equip',
      'unequip',
      'npc',
    ]) {
      expect(types, `${type} appears in the sample`).toContain(type);
    }
  });

  // Individual rank only, and the rank itself lives in field1 (T334).
  it('maps a rank row to one crawler, with no scope', () => {
    const ranks = result.episode?.events.filter((event) => event.type === 'rank') ?? [];
    expect(ranks).toHaveLength(2);
    expect(ranks[0]).toEqual({ t: 124, type: 'rank', actor: 'harry', rank: 8890 });
    expect(ranks[1]).toEqual({ t: 190, type: 'rank', actor: 'xo', rank: 4188 });
    for (const rank of ranks) expect(rank).not.toHaveProperty('scope');
  });

  it('maps the v2 rows: skill, class and hotlist', () => {
    const skill = result.episode?.events.find(
      (event) => event.type === 'skill' && event.actor === 'harry',
    );
    expect(skill).toMatchObject({
      type: 'skill',
      actor: 'harry',
      name: 'Powerful Strike',
      rank: 1,
      desc: 'Learned on a doorframe.',
    });

    const classed = result.episode?.events.find((event) => event.type === 'class');
    expect(classed).toMatchObject({ type: 'class', actor: 'harry', class: 'Compensated Anarchist' });

    const hotlists = result.episode?.events.filter((event) => event.type === 'hotlist') ?? [];
    expect(hotlists).toHaveLength(2);
    expect(hotlists[0]).toMatchObject({ actor: 'harry', add: ['The Hoarder'], remove: [] });
    expect(hotlists[1]).toMatchObject({
      actor: 'harry',
      add: ['Bronze Box Runner'],
      remove: ['The Hoarder'],
    });
  });

  it('maps the gear rows: equip and unequip (R2-FR-220)', () => {
    const equips = result.episode?.events.filter((event) => event.type === 'equip') ?? [];
    expect(equips).toHaveLength(3);
    expect(equips[0]).toMatchObject({
      type: 'equip',
      actor: 'harry',
      slot: 'hands',
      item: 'Enchanted Crowbar',
    });
    expect(equips[1]).toMatchObject({ slot: 'accessory', item: 'Lucky Rabbit Foot' });

    const unequips = result.episode?.events.filter((event) => event.type === 'unequip') ?? [];
    expect(unequips).toHaveLength(1);
    expect(unequips[0]).toMatchObject({
      type: 'unequip',
      actor: 'harry',
      slot: 'hands',
      item: 'Enchanted Crowbar',
    });
  });

  it('passes the optional crawler sheet fields through untouched', () => {
    const harry = result.episode?.initialState.party.find((crawler) => crawler.id === 'harry');
    expect(harry).toMatchObject({
      race: 'Human-ish',
      pronouns: 'he/them',
      crawlerNumber: '1651655',
      stats: { str: 3, int: 6, con: 5, dex: 2, cha: 4 },
      hotlist: [],
    });
    // 008: the sheet's full skills table rides along unchanged.
    expect(harry?.skills).toContainEqual({ name: 'Soul Collector (Fabricate Ending)', rank: 3 });
  });

  it('maps the npc rows, parsing action[:fact,fact] out of field2 (FR-601)', () => {
    const npcs = result.episode?.events.filter((event) => event.type === 'npc') ?? [];
    expect(npcs).toHaveLength(3);
    expect(npcs[0]).toEqual({
      t: 128,
      type: 'npc',
      id: 'the-hoarder',
      action: 'met',
      note: 'Something is stacking crates in Quadrant C.',
    });
    expect(npcs[1]).toEqual({
      t: 150,
      type: 'npc',
      id: 'the-hoarder',
      action: 'update',
      unlock: ['lair'],
      note: 'It nests behind the wall it builds.',
    });
    expect(npcs[2]).toMatchObject({ id: 'grull-rep', action: 'seen' });
    for (const npc of npcs) expect(npc).not.toHaveProperty('actor');
  });

  it('stays clean when the registry is supplied too', () => {
    const checked = convert(read('ep1.csv'), ctxWithRegistry());
    expect(checked.errors).toEqual([]);
    expect(checked.warnings).toEqual([]);
  });

  it('keeps a comma inside a quoted cell and splits map cells', () => {
    const achievement = result.episode?.events.find(
      (event) => event.type === 'achievement' && event.title === 'Gate Crasher',
    );
    expect(achievement).toMatchObject({
      actor: 'harry',
      desc: 'Killed 10 mobs with a door, and once with the frame.',
    });
    const reveal = result.episode?.events.find((event) => event.type === 'map_reveal');
    expect(reveal).toMatchObject({ cells: [[3, 2], [3, 3], [4, 2]], label: 'The Meat District' });
  });
});

/* --------------------------------------------------------- broken sample */

describe('convert(scripts/samples/ep1-broken.csv)', () => {
  const csv = read('ep1-broken.csv');
  const result = convert(csv, ctx());

  it('still writes output and reports no errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.episode).toBeDefined();
    expect(result.episode?.events.length).toBeGreaterThan(0);
  });

  it('names the row of the unknown actor', () => {
    expect(warningFor(result.warnings, dataRow(csv, ',ghost,'), 'ghost')).toBeDefined();
  });

  it('names the row past the episode duration', () => {
    expect(warningFor(result.warnings, dataRow(csv, '01:30:00'), 'past the duration')).toBeDefined();
  });

  it('names the impossible hp row', () => {
    expect(warningFor(result.warnings, dataRow(csv, ',999,'), 'above max')).toBeDefined();
  });

  it('names the unknown event type and passes the row through', () => {
    const row = dataRow(csv, 'mystery_type');
    expect(warningFor(result.warnings, row, 'mystery_type')).toBeDefined();
    const passed = result.episode?.events.find((event) => event.type === 'unknown');
    expect(passed).toBeDefined();
    expect((passed as { raw: Record<string, unknown> }).raw).toMatchObject({
      type: 'mystery_type',
      actor: 'harry',
      field1: 'glimmer',
      field2: '3',
    });
  });

  it('names the accessory unequip that carries no item', () => {
    expect(
      warningFor(result.warnings, dataRow(csv, 'unequip'), 'accessory with no item'),
    ).toBeDefined();
  });

  it('names the legacy rank row and still reads the rank out of field2', () => {
    expect(warningFor(result.warnings, dataRow(csv, ',crawler,'), 'legacy rank row')).toBeDefined();
    const rank = result.episode?.events.find((event) => event.type === 'rank');
    expect(rank).toMatchObject({ type: 'rank', actor: 'xo', rank: 4188 });
    expect(rank).not.toHaveProperty('scope');
  });

  it('warns exactly six times', () => {
    expect(result.warnings).toHaveLength(6);
  });

  // 007 R6: with no registry there is nothing to check an id against, so the
  // two deliberately wrong npc rows pass in silence.
  it('says nothing about the npc ids without --registry', () => {
    expect(result.warnings.filter((w) => w.includes('entity'))).toEqual([]);
    expect(result.warnings.filter((w) => w.includes('fact'))).toEqual([]);
  });

  it('names the unknown entity and the unknown fact once --registry is given', () => {
    const checked = convert(csv, ctxWithRegistry());
    expect(checked.errors).toEqual([]);
    expect(
      warningFor(checked.warnings, dataRow(csv, 'the-listener-below'), 'unknown entity'),
    ).toBeDefined();
    expect(
      warningFor(checked.warnings, dataRow(csv, 'lantern'), '"lantern"'),
    ).toBeDefined();
    // The known fact on the same row is not a finding; only `lantern` is.
    expect(checked.warnings.filter((w) => w.includes('ledger'))).toEqual([]);
    expect(checked.warnings).toHaveLength(8);
  });
});

/* ---------------------------------------------------------- error sample */

describe('convert(scripts/samples/ep1-error.csv)', () => {
  const csv = read('ep1-error.csv');
  const result = convert(csv, ctx());

  it('reports the unparseable timecode and produces no episode', () => {
    expect(result.episode).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toBe(`row ${dataRow(csv, 'abc,')}: unparseable timecode "abc"`);
  });

  it('reports the non-integer skill rank as the second error', () => {
    expect(result.errors).toHaveLength(5);
    expect(result.errors[1]).toBe(
      `row ${dataRow(csv, ',high,')}: skill rank (field2) must be a non-negative integer, got "high"`,
    );
  });

  it('reports the unknown gear slot as the third error', () => {
    expect(result.errors[2]).toBe(
      `row ${dataRow(csv, ',cape,')}: equip slot (field1) must be one of head, torso, arms, hands, legs, feet, accessory, got "cape"`,
    );
  });

  // DCC has individual rank only (T334): a party rank row is malformed input.
  it('reports a party rank row as the fourth error', () => {
    expect(result.errors[3]).toBe(
      `row ${dataRow(csv, ',party,')}: party rank is not a thing in DCC: a rank row names one crawler and their rank (field1)`,
    );
  });

  // 007: an action outside met/seen/update/defeated is malformed, not a warning.
  it('reports the unknown npc action as the fifth error', () => {
    expect(result.errors[4]).toBe(
      `row ${dataRow(csv, 'befriended')}: npc action (field2) must be one of met, seen, update, defeated, got "befriended"`,
    );
  });
});

/* -------------------------------------------------------- header + rows */

describe('convert edge cases', () => {
  it('errors when a required column is missing', () => {
    const result = convert('timecode,type,actor,field1,field2\n0:05,note,,hello,\n', ctx());
    expect(result.episode).toBeUndefined();
    expect(result.errors).toEqual(['header: missing required column(s): field3']);
  });

  it('errors on a non-numeric numeric field', () => {
    const result = convert(
      'timecode,type,actor,field1,field2,field3\n0:05,hp,harry,lots,22,\n',
      ctx(),
    );
    expect(result.episode).toBeUndefined();
    expect(result.errors).toEqual(['row 1: current (field1) is not numeric: "lots"']);
  });

  it('errors on an empty required field', () => {
    const result = convert(
      'timecode,type,actor,field1,field2,field3\n0:05,achievement,harry,,nothing,\n',
      ctx(),
    );
    expect(result.episode).toBeUndefined();
    expect(result.errors).toEqual([
      'row 1: empty required field: title (field1) on achievement',
    ]);
  });
});

describe('rowToEvent', () => {
  it('treats a first hp row for a party member as normal', () => {
    const result = rowToEvent(
      sheetRow({ type: 'hp', actor: 'mimi', field1: '14', field2: '18' }),
      rowCtx(),
    );
    expect(result.warnings).toEqual([]);
    expect(result.event).toEqual({ t: 10, type: 'hp', actor: 'mimi', current: 14, max: 18 });
  });

  it('warns about an hp row for an actor with no party entry', () => {
    const result = rowToEvent(
      sheetRow({ type: 'hp', actor: 'ghost', field1: '5', field2: '10' }),
      rowCtx(),
    );
    expect(result.warnings.some((w) => w.includes('no prior state'))).toBe(true);
    expect(result.event).not.toBeNull();
  });

  it('warns about an impossible one-step drop', () => {
    const context = rowCtx();
    rowToEvent(sheetRow({ type: 'hp', actor: 'harry', field1: '22', field2: '2' }), context);
    const result = rowToEvent(
      sheetRow({ type: 'hp', actor: 'harry', field1: '0', field2: '2' }),
      context,
    );
    expect(result.warnings.some((w) => w.includes('more than max'))).toBe(true);
  });

  it('warns when an actor event has no actor', () => {
    const result = rowToEvent(sheetRow({ type: 'loot', field1: 'Torch' }), rowCtx());
    expect(result.warnings).toContain('loot row has no actor');
  });

  it('errors on a skill row with no name', () => {
    const result = rowToEvent(sheetRow({ type: 'skill', actor: 'harry', field2: '2' }), rowCtx());
    expect(result.errors).toEqual(['empty required field: name (field1) on skill']);
    expect(result.event).toBeNull();
  });

  it('accepts a skill row without a rank', () => {
    const result = rowToEvent(
      sheetRow({ type: 'skill', actor: 'harry', field1: 'Crowbar Work' }),
      rowCtx(),
    );
    expect(result.errors).toEqual([]);
    expect(result.event).toEqual({ t: 10, type: 'skill', actor: 'harry', name: 'Crowbar Work' });
  });

  it('errors on a class row with no class', () => {
    const result = rowToEvent(sheetRow({ type: 'class', actor: 'harry' }), rowCtx());
    expect(result.errors).toEqual(['empty required field: class (field1) on class']);
    expect(result.event).toBeNull();
  });

  it('splits both hotlist lists', () => {
    const result = rowToEvent(
      sheetRow({ type: 'hotlist', actor: 'harry', field1: 'A; B', field2: 'C' }),
      rowCtx(),
    );
    expect(result.event).toEqual({
      t: 10,
      type: 'hotlist',
      actor: 'harry',
      add: ['A', 'B'],
      remove: ['C'],
    });
  });

  it('warns when a v2 row has no actor', () => {
    expect(
      rowToEvent(sheetRow({ type: 'skill', field1: 'Powerful Strike' }), rowCtx()).warnings,
    ).toContain('skill row has no actor');
  });

  it('maps an equip row and errors without an item', () => {
    expect(
      rowToEvent(
        sheetRow({ type: 'equip', actor: 'harry', field1: 'torso', field2: 'Patched Jacket' }),
        rowCtx(),
      ),
    ).toMatchObject({
      event: { t: 10, type: 'equip', actor: 'harry', slot: 'torso', item: 'Patched Jacket' },
      errors: [],
    });
    const missing = rowToEvent(
      sheetRow({ type: 'equip', actor: 'harry', field1: 'torso' }),
      rowCtx(),
    );
    expect(missing.errors).toEqual(['empty required field: item (field2) on equip']);
    expect(missing.event).toBeNull();
  });

  it('maps an unequip row with and without its item', () => {
    expect(
      rowToEvent(sheetRow({ type: 'unequip', actor: 'harry', field1: 'hands' }), rowCtx()).event,
    ).toEqual({ t: 10, type: 'unequip', actor: 'harry', slot: 'hands' });
    expect(
      rowToEvent(
        sheetRow({ type: 'unequip', actor: 'harry', field1: 'accessory', field2: 'Lucky Rabbit Foot' }),
        rowCtx(),
      ).event,
    ).toEqual({
      t: 10,
      type: 'unequip',
      actor: 'harry',
      slot: 'accessory',
      item: 'Lucky Rabbit Foot',
    });
  });

  it('warns when an accessory unequip names no item, and still maps the row', () => {
    const result = rowToEvent(
      sheetRow({ type: 'unequip', actor: 'harry', field1: 'accessory' }),
      rowCtx(),
    );
    expect(result.warnings.some((w) => w.includes('accessory with no item'))).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.event).toEqual({ t: 10, type: 'unequip', actor: 'harry', slot: 'accessory' });
  });

  it('errors on an unknown gear slot in either direction', () => {
    for (const type of ['equip', 'unequip']) {
      const result = rowToEvent(
        sheetRow({ type, actor: 'harry', field1: 'cape', field2: 'Velvet Cloak' }),
        rowCtx(),
      );
      expect(result.errors).toEqual([
        `${type} slot (field1) must be one of head, torso, arms, hands, legs, feet, accessory, got "cape"`,
      ]);
      expect(result.event).toBeNull();
    }
  });

  it('warns when a gear row has no actor', () => {
    expect(
      rowToEvent(sheetRow({ type: 'equip', field1: 'torso', field2: 'Jacket' }), rowCtx()).warnings,
    ).toContain('equip row has no actor');
  });

  it('maps an npc row, with and without unlocked facts', () => {
    expect(
      rowToEvent(sheetRow({ type: 'npc', field1: 'the-hoarder', field2: 'met' }), rowCtx()).event,
    ).toEqual({ t: 10, type: 'npc', id: 'the-hoarder', action: 'met' });
    expect(
      rowToEvent(
        sheetRow({
          type: 'npc',
          actor: 'harry',
          field1: 'the-hoarder',
          field2: 'update: lair , weakness',
          field3: 'It cannot see red.',
        }),
        rowCtx(),
      ).event,
    ).toEqual({
      t: 10,
      type: 'npc',
      id: 'the-hoarder',
      action: 'update',
      unlock: ['lair', 'weakness'],
      note: 'It cannot see red.',
      actor: 'harry',
    });
  });

  it('errors on an npc row with no id, no action, or an unknown action', () => {
    expect(rowToEvent(sheetRow({ type: 'npc', field2: 'met' }), rowCtx()).errors).toEqual([
      'empty required field: id (field1) on npc',
    ]);
    expect(rowToEvent(sheetRow({ type: 'npc', field1: 'the-hoarder' }), rowCtx()).errors).toEqual([
      'empty required field: action (field2) on npc',
    ]);
    const unknown = rowToEvent(
      sheetRow({ type: 'npc', field1: 'the-hoarder', field2: 'befriended:lair' }),
      rowCtx(),
    );
    expect(unknown.errors).toEqual([
      'npc action (field2) must be one of met, seen, update, defeated, got "befriended"',
    ]);
    expect(unknown.event).toBeNull();
  });

  it('warns about an unknown entity or fact only when a registry is at hand', () => {
    const silent = rowToEvent(
      sheetRow({ type: 'npc', field1: 'nobody', field2: 'update:ghost' }),
      rowCtx(),
    );
    expect(silent.warnings).toEqual([]);
    expect(silent.event).not.toBeNull();

    const checked = rowToEvent(
      sheetRow({ type: 'npc', field1: 'nobody', field2: 'met' }),
      rowCtx(sampleRegistry),
    );
    expect(checked.warnings).toEqual(['unknown entity "nobody" (not in the registry)']);
    // A known entity with a fact it does not carry is warned about per fact.
    expect(
      rowToEvent(
        sheetRow({ type: 'npc', field1: 'the-hoarder', field2: 'update:lair,ghost' }),
        rowCtx(sampleRegistry),
      ).warnings,
    ).toEqual(['unknown fact "ghost" on entity "the-hoarder"']);
  });

  it('warns about an unknown chapter kind', () => {
    const result = rowToEvent(
      sheetRow({ type: 'chapter', field1: 'The Hoarder', field2: 'interlude' }),
      rowCtx(),
    );
    expect(result.warnings.some((w) => w.includes('unknown chapter kind'))).toBe(true);
    expect(result.event).toMatchObject({ label: 'The Hoarder', kind: 'interlude' });
  });
});

/* ------------------------------------------------------------ arg parsing */

describe('parseArgs', () => {
  const ok = ['in.csv', '--episode', '1', '--duration', '240', '--initial-state', 's.json', '--out', 'o.json'];

  it('accepts the documented command line', () => {
    expect(parseArgs(ok)).toEqual({
      options: { csv: 'in.csv', episode: 1, duration: 240, initialState: 's.json', out: 'o.json' },
    });
  });

  it('accepts --flag=value form', () => {
    expect(parseArgs(['in.csv', '--episode=2', '--duration=10', '--initial-state=s', '--out=o'])).toEqual(
      { options: { csv: 'in.csv', episode: 2, duration: 10, initialState: 's', out: 'o' } },
    );
  });

  it('accepts the optional --registry flag and omits it otherwise', () => {
    expect(parseArgs([...ok, '--registry', 'public/data/npcs.json'])).toEqual({
      options: {
        csv: 'in.csv',
        episode: 1,
        duration: 240,
        initialState: 's.json',
        out: 'o.json',
        registry: 'public/data/npcs.json',
      },
    });
    expect(parseArgs(ok)).not.toHaveProperty('options.registry');
  });

  it('reports --help', () => {
    expect(parseArgs(['--help'])).toEqual({ help: true });
  });

  it.each([
    [[] as string[]],
    [ok.slice(1)],
    [['in.csv', '--duration', '240', '--initial-state', 's', '--out', 'o']],
    [['in.csv', '--episode', '1', '--initial-state', 's', '--out', 'o']],
    [['in.csv', '--episode', '1', '--duration', '240', '--out', 'o']],
    [['in.csv', '--episode', '1', '--duration', '240', '--initial-state', 's']],
  ])('rejects %j', (argv) => {
    expect(parseArgs(argv)).toHaveProperty('error');
  });
});

/* -------------------------------------------------------------------- cli */

describe('cli', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sheet-to-json-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it(
    'exits 1 and writes nothing for the error sample',
    () => {
      const out = join(dir, 'never.json');
      let status: number | undefined;
      let stderr = '';
      try {
        execFileSync(
          resolve(root, 'node_modules/.bin/tsx'),
          [
            resolve(root, 'scripts/sheet-to-json.ts'),
            resolve(samples, 'ep1-error.csv'),
            '--episode',
            '1',
            '--duration',
            '240',
            '--initial-state',
            resolve(samples, 'ep1.initial.json'),
            '--out',
            out,
          ],
          { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        );
        status = 0;
      } catch (error) {
        const failure = error as { status?: number; stderr?: string };
        status = failure.status;
        stderr = failure.stderr ?? '';
      }

      expect(status).toBe(1);
      expect(stderr).toMatch(/^ERROR row \d+: unparseable timecode "abc"$/m);
      expect(existsSync(out)).toBe(false);
    },
    30_000,
  );
});

/* ----------------------------------- 008 revision 2: the spell row (R2) */

describe('rowToEvent - spell (008 revision 2)', () => {
  it('maps name, rank and mana cost', () => {
    const result = rowToEvent(
      sheetRow({ type: 'spell', actor: 'mimi', field1: 'Heal', field2: '1', field3: '2' }),
      rowCtx(),
    );
    expect(result.errors).toEqual([]);
    expect(result.event).toEqual({
      t: 10,
      type: 'spell',
      actor: 'mimi',
      name: 'Heal',
      rank: 1,
      mana: 2,
    });
  });

  it('omits rank and cost the sheet leaves blank', () => {
    const result = rowToEvent(sheetRow({ type: 'spell', actor: 'mimi', field1: 'Heal' }), rowCtx());
    expect(result.event).toEqual({ t: 10, type: 'spell', actor: 'mimi', name: 'Heal' });
  });

  it('errors on a missing name', () => {
    const result = rowToEvent(sheetRow({ type: 'spell', actor: 'mimi' }), rowCtx());
    expect(result.errors).toEqual(['empty required field: name (field1) on spell']);
    expect(result.event).toBeNull();
  });

  it('errors on a rank or cost that is not a non-negative integer', () => {
    const result = rowToEvent(
      sheetRow({ type: 'spell', actor: 'mimi', field1: 'Heal', field2: 'two', field3: '-1' }),
      rowCtx(),
    );
    expect(result.errors).toEqual([
      'spell rank (field2) must be a non-negative integer, got "two"',
      'spell mana (field3) must be a non-negative integer, got "-1"',
    ]);
    expect(result.event).toBeNull();
  });

  it('warns when a spell row has no actor', () => {
    expect(
      rowToEvent(sheetRow({ type: 'spell', field1: 'Heal' }), rowCtx()).warnings,
    ).toContain('spell row has no actor');
  });
});

/* ------------------------- 008 revision 4: spell refs and `--spells` (R4) */

describe('spellField1 (008 revision 4)', () => {
  it('reads a kebab-case cell as a registry id when --spells is given', () => {
    expect(spellField1('heal', rowCtx(undefined, sampleSpells))).toEqual({
      key: { ref: 'heal' },
      warnings: [],
    });
  });

  it('reads a display name as a name, even with --spells', () => {
    expect(spellField1('Heal', rowCtx(undefined, sampleSpells))).toEqual({
      key: { name: 'Heal' },
      warnings: [],
    });
  });

  it('reads every cell as a name without --spells, kebab-case included', () => {
    expect(spellField1('heal', rowCtx())).toEqual({ key: { name: 'heal' }, warnings: [] });
  });

  it('warns about an id the registry does not carry, and keeps the row', () => {
    const result = spellField1('no-such-spell', rowCtx(undefined, sampleSpells));
    expect(result.key).toEqual({ name: 'no-such-spell' });
    expect(result.warnings).toEqual([
      'unknown spell "no-such-spell" (not in the spell registry)',
    ]);
  });
});

describe('rowToEvent - spell refs (008 revision 4)', () => {
  it('emits a ref instead of a name, keeping rank and cost', () => {
    const result = rowToEvent(
      sheetRow({ type: 'spell', actor: 'mimi', field1: 'heal', field2: '1', field3: '2' }),
      rowCtx(undefined, sampleSpells),
    );
    expect(result.errors).toEqual([]);
    expect(result.event).toEqual({ t: 10, type: 'spell', actor: 'mimi', ref: 'heal', rank: 1, mana: 2 });
  });

  it('still emits a name for an unknown id, and says so', () => {
    const result = rowToEvent(
      sheetRow({ type: 'spell', actor: 'mimi', field1: 'no-such-spell' }),
      rowCtx(undefined, sampleSpells),
    );
    expect(result.event).toEqual({ t: 10, type: 'spell', actor: 'mimi', name: 'no-such-spell' });
    expect(result.warnings).toContain('unknown spell "no-such-spell" (not in the spell registry)');
  });

  it('leaves an existing CSV that writes a display name alone', () => {
    const result = rowToEvent(
      sheetRow({ type: 'spell', actor: 'mimi', field1: 'Heal' }),
      rowCtx(undefined, sampleSpells),
    );
    expect(result.event).toEqual({ t: 10, type: 'spell', actor: 'mimi', name: 'Heal' });
  });
});

describe('initialStateSpellWarnings (008 revision 4)', () => {
  it('finds nothing to say about the shipped initial state', () => {
    expect(initialStateSpellWarnings(initialState, sampleSpells)).toEqual([]);
  });

  it('flags a ref in the party the registry does not carry', () => {
    const broken: InitialState = {
      ...initialState,
      party: initialState.party.map((crawler) =>
        crawler.id === 'mimi'
          ? { ...crawler, spells: [{ ref: 'no-such-spell' }], hotlist: [{ ref: 'also-missing' }] }
          : crawler,
      ),
    };
    expect(initialStateSpellWarnings(broken, sampleSpells)).toEqual([
      'initial state: mimi points at unknown spell "no-such-spell"',
      'initial state: mimi points at unknown spell "also-missing"',
    ]);
  });

  it('says nothing at all without --spells', () => {
    expect(initialStateSpellWarnings(initialState, null)).toEqual([]);
  });
});

describe('convert with --spells (008 revision 4)', () => {
  it("turns the sample sheet spell row into a ref and validates", () => {
    const result = convert(read('ep1.csv'), { ...ctxWithRegistry(), spells: sampleSpells });
    expect(result.errors).toEqual([]);
    const spellEvents = (result.episode?.events ?? []).filter((event) => event.type === 'spell');
    expect(spellEvents.length).toBeGreaterThanOrEqual(1);
    for (const event of spellEvents) {
      expect(event).toMatchObject({ ref: 'heal' });
    }
    expect(validateEpisode(result.episode)).toBe(true);
  });

  it('keeps the same sheet as a name-only conversion without the flag', () => {
    const result = convert(read('ep1.csv'), ctxWithRegistry());
    const spellEvents = (result.episode?.events ?? []).filter((event) => event.type === 'spell');
    for (const event of spellEvents) {
      expect(event).toMatchObject({ name: 'heal' });
    }
  });
});

describe('parseArgs --spells (008 revision 4)', () => {
  const base = ['in.csv', '--episode', '1', '--duration', '240', '--initial-state', 'i.json', '--out', 'o.json'];

  it('is absent unless asked for', () => {
    const parsed = parseArgs(base);
    expect('options' in parsed && parsed.options.spells).toBeUndefined();
  });

  it('carries the path when given', () => {
    const parsed = parseArgs([...base, '--spells', 'public/data/spells.json']);
    expect('options' in parsed && parsed.options.spells).toBe('public/data/spells.json');
  });

  it('rejects an empty path', () => {
    expect(parseArgs([...base, '--spells='])).toEqual({ error: '--spells <path> must name a file' });
  });
});

/* ------------------------------------------------------------ 009: mana */

describe('the mana row (009)', () => {
  it('reads field1 as the current pool and field2 as the max', () => {
    const result = rowToEvent(
      sheetRow({ type: 'mana', actor: 'mimi', field1: '3', field2: '5' }),
      rowCtx(),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.event).toEqual({ t: 10, type: 'mana', actor: 'mimi', current: 3, max: 5 });
  });

  it('leaves the max out when field2 is empty', () => {
    const result = rowToEvent(sheetRow({ type: 'mana', actor: 'mimi', field1: '3' }), rowCtx());
    expect(result.errors).toEqual([]);
    expect(result.event).toEqual({ t: 10, type: 'mana', actor: 'mimi', current: 3 });
  });

  it('errors on a missing or non-numeric reading', () => {
    expect(rowToEvent(sheetRow({ type: 'mana', actor: 'mimi' }), rowCtx()).errors).toEqual([
      'empty required field: current (field1)',
    ]);
    const bad = rowToEvent(
      sheetRow({ type: 'mana', actor: 'mimi', field1: 'lots' }),
      rowCtx(),
    );
    expect(bad.errors).toEqual(['current (field1) is not numeric: "lots"']);
    expect(bad.event).toBeNull();
  });

  it('errors on a non-numeric max', () => {
    const result = rowToEvent(
      sheetRow({ type: 'mana', actor: 'mimi', field1: '3', field2: 'plenty' }),
      rowCtx(),
    );
    expect(result.errors).toEqual(['max (field2) is not numeric: "plenty"']);
    expect(result.event).toBeNull();
  });

  it('warns when the row names nobody', () => {
    const result = rowToEvent(sheetRow({ type: 'mana', field1: '3' }), rowCtx());
    expect(result.warnings).toContain('mana row has no actor');
  });
});

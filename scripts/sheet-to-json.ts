/**
 * Editor sheet CSV → `ep{N}.json` (constitution: Author-Friendly Data Pipeline).
 *
 * Contract: specs/001-watch-hub-v1/contracts/sheet-csv.md, extended by
 * specs/002-watch-hub-v2/contracts/sheet-csv.md (skill / class / hotlist rows) and by
 * specs/003-crawler-record/data-model.md (equip / unequip rows: field1 slot, field2 item) and by
 * specs/007-npc-registry/contracts/npc.md (npc row: field1 id, field2 action[:fact,fact], field3 note)
 * and by specs/008-real-crawlers (spell row: field1 name - or, with `--spells`, a registry id -
 * field2 rank, field3 mana; hotlist and inventory rows still name entries by their short name
 * alone, and the structure an entry carries - quantity, description - lives in `--initial-state`).
 *
 *   npm run sheet-to-json -- scripts/samples/ep1.csv --episode 1 --duration 240 \
 *     --initial-state scripts/samples/ep1.initial.json --out public/data/ep1.json
 *
 * Warnings (unknown actor, impossible HP, timecode past the duration, unknown type or
 * chapter kind, an accessory unequip with no item, and - only with `--registry` / `--spells` - an
 * unknown entity, fact or spell id) are reported and the file is still written. Only malformed
 * input (unparseable timecode, missing column, non-numeric numeric, empty required field,
 * an unknown gear slot, an unknown npc action) is an error, and then nothing is written.
 *
 * Everything here is a pure exported function except `main()`, which runs only when
 * this file is executed directly.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import type {
  Cell,
  EpisodeData,
  Hp,
  InitialState,
  Registry,
  SpellRegistry,
} from '../src/data/types';
import { CHAPTER_KINDS, GEAR_SLOTS, NPC_ACTIONS } from '../src/data/types';
import {
  SPELL_REF_RE,
  normalizeEpisode,
  normalizeRegistry,
  toNumber,
  validateSpells,
} from '../src/data/validate';

/* ----------------------------------------------------------------- shapes */

export const REQUIRED_COLUMNS = [
  'timecode',
  'type',
  'actor',
  'field1',
  'field2',
  'field3',
] as const;

/** One row of the editor's sheet, every cell already a (possibly empty) string. */
export interface SheetRow {
  timecode: string;
  type: string;
  actor: string;
  field1: string;
  field2: string;
  field3: string;
}

/** A pre-normalization event object, exactly as it will be written to JSON. */
export type RawEvent = Record<string, unknown>;

/** Converter state a single row is judged against (data-model.md §5). */
export interface RowContext {
  partyIds: ReadonlySet<string>;
  durationSec: number;
  /** Seeded from `initialState.party`, updated by each `hp` row. */
  hpState: Map<string, Hp>;
  /**
   * The show's entity registry, when the editor passed `--registry` (007 R6).
   * Absent means no id checking at all: the registry is show-level data an
   * episode conversion is not required to have on hand.
   */
  registry?: Registry | null;
  /**
   * The show's spell registry, when the editor passed `--spells` (008 R4).
   * Absent means a `spell` row's field1 is always a display name: without the
   * book on hand there is no id to point at.
   */
  spells?: SpellRegistry | null;
}

export interface RowResult {
  event: RawEvent | null;
  warnings: string[];
  errors: string[];
}

export interface ConvertContext {
  episodeId: number;
  durationSec: number;
  initialState: InitialState;
  /** Optional: enables the `npc` row's id and fact-id warnings (007 R6). */
  registry?: Registry | null;
  /** Optional: turns a kebab-case `spell` field1 into a `ref` (008 R4). */
  spells?: SpellRegistry | null;
}

export interface ConvertResult {
  /** Absent when `errors` is non-empty - nothing should be written. */
  episode?: EpisodeData;
  warnings: string[];
  errors: string[];
}

/** Types whose row is meaningless without an actor (`rank` included since T334). */
const ACTOR_EVENT_TYPES = new Set([
  'achievement',
  'loot',
  'hp',
  'mana',
  'level_up',
  'rank',
  'status',
  'inventory',
  'skill',
  'spell',
  'class',
  'hotlist',
  'equip',
  'unequip',
]);

/* -------------------------------------------------------------- timecodes */

const SECONDS_RE = /^\d+(?:\.\d+)?$/;
const MM_SS_RE = /^(\d{1,3}):([0-5]?\d(?:\.\d+)?)$/;
const HH_MM_SS_RE = /^(\d{1,3}):([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/;

/** `hh:mm:ss`, `h:mm:ss`, `mm:ss`, or plain seconds. `null` when unreadable. */
export function parseTimecode(raw: string): number | null {
  const value = raw.trim();
  if (value === '') return null;
  if (SECONDS_RE.test(value)) return Number(value);

  const hms = HH_MM_SS_RE.exec(value);
  if (hms !== null) {
    return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  }
  const ms = MM_SS_RE.exec(value);
  if (ms !== null) {
    return Number(ms[1]) * 60 + Number(ms[2]);
  }
  return null;
}

/* ------------------------------------------------------------ cell helpers */

/** `a;b;c` → `['a', 'b', 'c']`, empty entries dropped. */
function splitList(cell: string): string[] {
  return cell
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** `r,c;r,c` → `[[r, c], [r, c]]`. `null` when any pair is unreadable. */
function parseCells(cell: string): Cell[] | null {
  const cells: Cell[] = [];
  for (const pair of cell.split(';')) {
    const trimmed = pair.trim();
    if (trimmed === '') continue;
    const parts = trimmed.split(',');
    if (parts.length !== 2) return null;
    const row = toNumber(parts[0]);
    const col = toNumber(parts[1]);
    if (row === null || col === null) return null;
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0) return null;
    cells.push([row, col]);
  }
  return cells.length > 0 ? cells : null;
}

function numericField(
  raw: string,
  name: string,
  column: string,
  errors: string[],
): number | null {
  if (raw === '') {
    errors.push(`empty required field: ${name} (${column})`);
    return null;
  }
  const value = toNumber(raw);
  if (value === null) {
    errors.push(`${name} (${column}) is not numeric: ${JSON.stringify(raw)}`);
    return null;
  }
  return value;
}

/**
 * The three HP checks the contract makes detectable from rows alone: above max,
 * an impossible one-step drop, and a row for an actor with no prior state.
 */
function hpWarnings(actor: string, current: number, max: number, ctx: RowContext): string[] {
  const warnings: string[] = [];
  const who = actor === '' ? '(no actor)' : actor;
  if (current > max) {
    warnings.push(`hp for ${who} is ${current}, above max ${max}`);
  }
  const prior = ctx.hpState.get(actor);
  if (prior === undefined) {
    warnings.push(`hp for ${who} with no prior state (not in initialState.party)`);
  } else if (prior.current - current > max) {
    warnings.push(
      `hp for ${who} dropped ${prior.current} → ${current}, more than max ${max} in one step`,
    );
  }
  return warnings;
}

/**
 * Id checks the converter can only make with `--registry` (007 R6). Without one
 * there is nothing to check against, so an unchecked row is not a finding.
 */
function npcWarnings(id: string, unlock: readonly string[], ctx: RowContext): string[] {
  const registry = ctx.registry;
  if (!registry) return [];
  const warnings: string[] = [];
  const entity = registry.entities.find((candidate) => candidate.id === id);
  if (entity === undefined) {
    warnings.push(`unknown entity ${JSON.stringify(id)} (not in the registry)`);
    return warnings;
  }
  for (const fact of unlock) {
    if (!entity.facts.some((candidate) => candidate.id === fact)) {
      warnings.push(`unknown fact ${JSON.stringify(fact)} on entity ${JSON.stringify(id)}`);
    }
  }
  return warnings;
}

/**
 * How a `spell` row's field1 is read (008 R4). With `--spells` on hand, a
 * kebab-case cell is a registry id and becomes `ref`; anything else - and every
 * cell at all without the flag - is the spell's display name, so an existing CSV
 * that writes "Heal" keeps meaning "Heal".
 */
export function spellField1(
  field1: string,
  ctx: RowContext,
): { key: { name?: string; ref?: string }; warnings: string[] } {
  const spells = ctx.spells;
  if (!spells || !SPELL_REF_RE.test(field1)) return { key: { name: field1 }, warnings: [] };
  const known = spells.spells.some((spell) => spell.id === field1);
  return known
    ? { key: { ref: field1 }, warnings: [] }
    : {
        // Falls back to a name so the row still converts; the editor gets told.
        key: { name: field1 },
        warnings: [`unknown spell ${JSON.stringify(field1)} (not in the spell registry)`],
      };
}

/**
 * Every `ref` the initial state points at, checked against `--spells` (008 R4).
 * The crawler sheets are where a typo is most expensive - it would render as the
 * raw id on every episode - so the converter reads them even though it never
 * rewrites them.
 */
export function initialStateSpellWarnings(
  initialState: InitialState,
  spells: SpellRegistry | null | undefined,
): string[] {
  if (!spells) return [];
  const ids = new Set(spells.spells.map((spell) => spell.id));
  const warnings: string[] = [];
  for (const crawler of initialState.party ?? []) {
    const refs: string[] = [];
    for (const entry of crawler.spells ?? []) {
      if (entry.ref !== undefined) refs.push(entry.ref);
    }
    for (const entry of crawler.hotlist ?? []) {
      if (typeof entry !== 'string' && entry.ref !== undefined) refs.push(entry.ref);
    }
    for (const ref of refs) {
      if (ids.has(ref)) continue;
      warnings.push(
        `initial state: ${crawler.id} points at unknown spell ${JSON.stringify(ref)}`,
      );
    }
  }
  return warnings;
}

/* ------------------------------------------------------------ row → event */

/**
 * Maps one sheet row to one event object per contracts/sheet-csv.md. Pure apart
 * from the HP ledger in `ctx`, which later rows are judged against.
 */
export function rowToEvent(row: SheetRow, ctx: RowContext): RowResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const t = parseTimecode(row.timecode);
  if (t === null) {
    errors.push(`unparseable timecode ${JSON.stringify(row.timecode.trim())}`);
    return { event: null, warnings, errors };
  }
  if (t > ctx.durationSec) {
    warnings.push(`timecode ${row.timecode.trim()} (${t}s) is past the duration ${ctx.durationSec}s`);
  }

  const type = row.type.trim();
  if (type === '') {
    errors.push('empty required field: type');
    return { event: null, warnings, errors };
  }

  const actor = row.actor.trim();
  const field1 = row.field1.trim();
  const field2 = row.field2.trim();
  const field3 = row.field3.trim();

  if (actor !== '' && !ctx.partyIds.has(actor)) {
    warnings.push(`unknown actor ${JSON.stringify(actor)} (not in initialState.party)`);
  }
  if (ACTOR_EVENT_TYPES.has(type) && actor === '') {
    warnings.push(`${type} row has no actor`);
  }

  let event: RawEvent | null = null;

  switch (type) {
    case 'system_message':
    case 'note': {
      if (field1 === '') errors.push(`empty required field: text (field1) on ${type}`);
      else event = { t, type, text: field1 };
      break;
    }
    case 'achievement': {
      if (field1 === '') errors.push('empty required field: title (field1) on achievement');
      else if (field2 === '') event = { t, type, actor, title: field1 };
      else event = { t, type, actor, title: field1, desc: field2 };
      break;
    }
    case 'loot': {
      if (field1 === '') errors.push('empty required field: item (field1) on loot');
      else if (field2 === '') event = { t, type, actor, item: field1 };
      else event = { t, type, actor, item: field1, source: field2 };
      break;
    }
    case 'hp': {
      const current = numericField(field1, 'current', 'field1', errors);
      const max = numericField(field2, 'max', 'field2', errors);
      if (current !== null && max !== null) {
        warnings.push(...hpWarnings(actor, current, max, ctx));
        ctx.hpState.set(actor, { current, max });
        event = { t, type, actor, current, max };
      }
      break;
    }
    /*
     * Mana (009): field1 is the reading, field2 the pool and it is optional -
     * a row that only spends mana leaves the max to the crawler's sheet. There
     * are no cross-row warnings to make: unlike hp there is no "impossible
     * drop" to detect, because a full pool can be emptied in one action.
     */
    case 'mana': {
      const current = numericField(field1, 'current', 'field1', errors);
      if (current === null) break;
      if (field2 === '') {
        event = { t, type, actor, current };
        break;
      }
      const max = numericField(field2, 'max', 'field2', errors);
      if (max !== null) event = { t, type, actor, current, max };
      break;
    }
    case 'level_up': {
      const level = numericField(field1, 'level', 'field1', errors);
      if (level !== null) event = { t, type, actor, level };
      break;
    }
    case 'rank': {
      // DCC has individual rank only (T334): field1 is the rank itself.
      if (field1 === 'party') {
        errors.push(
          'party rank is not a thing in DCC: a rank row names one crawler and their rank (field1)',
        );
        break;
      }
      if (field1 === 'crawler') {
        // The pre-T334 sheet put the scope in field1 and the rank in field2.
        warnings.push('legacy rank row: the scope column is gone, put the rank in field1');
        const legacyRank = numericField(field2, 'rank', 'field2', errors);
        if (legacyRank !== null) event = { t, type, rank: legacyRank, actor };
        break;
      }
      const rank = numericField(field1, 'rank', 'field1', errors);
      if (rank !== null) event = { t, type, rank, actor };
      break;
    }
    case 'map_reveal': {
      const cells = parseCells(field1);
      if (cells === null) {
        errors.push(
          `map_reveal cells (field1) must look like "r,c;r,c", got ${JSON.stringify(field1)}`,
        );
      } else if (field2 === '') {
        event = { t, type, cells };
      } else {
        event = { t, type, cells, label: field2 };
      }
      break;
    }
    case 'sponsor': {
      if (field1 === '') errors.push('empty required field: text (field1) on sponsor');
      const durationSec = numericField(field2, 'durationSec', 'field2', errors);
      if (field1 !== '' && durationSec !== null) {
        event = { t, type, text: field1, durationSec };
      }
      break;
    }
    case 'chapter': {
      if (field1 === '') errors.push('empty required field: label (field1) on chapter');
      if (field2 === '') {
        errors.push('empty required field: kind (field2) on chapter');
      } else if (!(CHAPTER_KINDS as readonly string[]).includes(field2)) {
        warnings.push(
          `unknown chapter kind ${JSON.stringify(field2)} (expected ${CHAPTER_KINDS.join(', ')})`,
        );
      }
      if (field1 !== '' && field2 !== '') event = { t, type, label: field1, kind: field2 };
      break;
    }
    case 'status':
    case 'inventory':
    case 'hotlist': {
      event = { t, type, actor, add: splitList(field1), remove: splitList(field2) };
      break;
    }
    case 'skill': {
      if (field1 === '') {
        errors.push('empty required field: name (field1) on skill');
        break;
      }
      let rank: number | null = null;
      if (field2 !== '') {
        rank = toNumber(field2);
        if (rank === null || !Number.isInteger(rank) || rank < 0) {
          errors.push(
            `skill rank (field2) must be a non-negative integer, got ${JSON.stringify(field2)}`,
          );
          break;
        }
      }
      event = {
        t,
        type,
        actor,
        name: field1,
        ...(rank === null ? {} : { rank }),
        ...(field3 === '' ? {} : { desc: field3 }),
      };
      break;
    }
    case 'spell': {
      /*
       * 008 revision 2: field1 name, field2 rank, field3 mana cost. The spell's
       * full text is not a CSV cell - a paragraph does not belong in a sheet
       * column, so it lives in `--initial-state` (or an earlier file) and the
       * event only ever amends the numbers. Since revision 4 field1 may instead
       * be a registry id, and then the name comes from the book.
       */
      if (field1 === '') {
        errors.push('empty required field: name (field1) on spell');
        break;
      }
      const spell = spellField1(field1, ctx);
      warnings.push(...spell.warnings);
      const numbers: Record<string, number> = {};
      let bad = false;
      for (const [key, raw, column] of [
        ['rank', field2, 'field2'],
        ['mana', field3, 'field3'],
      ] as const) {
        if (raw === '') continue;
        const value = toNumber(raw);
        if (value === null || !Number.isInteger(value) || value < 0) {
          errors.push(
            `spell ${key} (${column}) must be a non-negative integer, got ${JSON.stringify(raw)}`,
          );
          bad = true;
          continue;
        }
        numbers[key] = value;
      }
      if (bad) break;
      event = { t, type, actor, ...spell.key, ...numbers };
      break;
    }
    case 'equip':
    case 'unequip': {
      if (!(GEAR_SLOTS as readonly string[]).includes(field1)) {
        errors.push(
          `${type} slot (field1) must be one of ${GEAR_SLOTS.join(', ')}, got ${JSON.stringify(field1)}`,
        );
        break;
      }
      if (type === 'equip') {
        if (field2 === '') errors.push('empty required field: item (field2) on equip');
        else event = { t, type, actor, slot: field1, item: field2 };
        break;
      }
      if (field1 === 'accessory' && field2 === '') {
        warnings.push('unequip of an accessory with no item (field2): the last one is removed');
      }
      event =
        field2 === ''
          ? { t, type, actor, slot: field1 }
          : { t, type, actor, slot: field1, item: field2 };
      break;
    }
    case 'class': {
      if (field1 === '') errors.push('empty required field: class (field1) on class');
      else event = { t, type, actor, class: field1 };
      break;
    }
    case 'npc': {
      // field2 is `action` or `action:fact-id,fact-id` (contracts/npc.md).
      if (field1 === '') {
        errors.push('empty required field: id (field1) on npc');
        break;
      }
      if (field2 === '') {
        errors.push('empty required field: action (field2) on npc');
        break;
      }
      const colon = field2.indexOf(':');
      const action = (colon === -1 ? field2 : field2.slice(0, colon)).trim();
      const unlock =
        colon === -1
          ? []
          : field2
              .slice(colon + 1)
              .split(',')
              .map((entry) => entry.trim())
              .filter((entry) => entry !== '');
      if (!(NPC_ACTIONS as readonly string[]).includes(action)) {
        errors.push(
          `npc action (field2) must be one of ${NPC_ACTIONS.join(', ')}, got ${JSON.stringify(action)}`,
        );
        break;
      }
      warnings.push(...npcWarnings(field1, unlock, ctx));
      event = {
        t,
        type,
        id: field1,
        action,
        ...(unlock.length === 0 ? {} : { unlock }),
        ...(field3 === '' ? {} : { note: field3 }),
        ...(actor === '' ? {} : { actor }),
      };
      break;
    }
    default: {
      warnings.push(`unknown event type ${JSON.stringify(type)} (row passed through verbatim)`);
      event =
        actor === ''
          ? { t, type, field1, field2, field3 }
          : { t, type, actor, field1, field2, field3 };
      break;
    }
  }

  return { event, warnings, errors };
}

/* ------------------------------------------------------------- conversion */

/** Ascending by `t`, file order wins for ties (same rule as `sortEvents`). */
function stableSortByT(events: RawEvent[]): RawEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => Number(a.event.t) - Number(b.event.t) || a.index - b.index)
    .map((entry) => entry.event);
}

/**
 * CSV text → an episode file, plus every diagnostic. `episode` is present only
 * when `errors` is empty. Never throws.
 */
export function convert(csvText: string, ctx: ConvertContext): ConvertResult {
  const warnings: string[] = [];

  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: true,
      trim: true,
      skip_empty_lines: true,
      bom: true,
    }) as Record<string, string>[];
  } catch (error) {
    return { warnings, errors: [`csv could not be parsed: ${(error as Error).message}`] };
  }

  if (records.length === 0) {
    return { warnings, errors: ['csv has no data rows (a header row plus at least one row)'] };
  }

  const header = Object.keys(records[0]);
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { warnings, errors: [`header: missing required column(s): ${missing.join(', ')}`] };
  }

  const party = Array.isArray(ctx.initialState?.party) ? ctx.initialState.party : [];
  const rowCtx: RowContext = {
    partyIds: new Set(party.map((crawler) => crawler.id)),
    durationSec: ctx.durationSec,
    hpState: new Map(
      party.map((crawler) => [
        crawler.id,
        { current: crawler.hp.current, max: crawler.hp.max } satisfies Hp,
      ]),
    ),
    ...(ctx.registry === undefined ? {} : { registry: ctx.registry }),
    ...(ctx.spells === undefined ? {} : { spells: ctx.spells }),
  };
  warnings.push(...initialStateSpellWarnings(ctx.initialState, ctx.spells));

  const errors: string[] = [];
  const events: RawEvent[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 1; // 1-based data row; the header is not counted.
    const row: SheetRow = {
      timecode: record.timecode ?? '',
      type: record.type ?? '',
      actor: record.actor ?? '',
      field1: record.field1 ?? '',
      field2: record.field2 ?? '',
      field3: record.field3 ?? '',
    };
    const result = rowToEvent(row, rowCtx);
    for (const warning of result.warnings) warnings.push(`row ${rowNumber}: ${warning}`);
    for (const error of result.errors) errors.push(`row ${rowNumber}: ${error}`);
    if (result.event !== null) events.push(result.event);
  });

  if (errors.length > 0) return { warnings, errors };

  try {
    const episode = normalizeEpisode({
      episodeId: ctx.episodeId,
      initialState: ctx.initialState,
      events: stableSortByT(events),
    });
    return { episode, warnings, errors };
  } catch (error) {
    return { warnings, errors: [`output rejected: ${(error as Error).message}`] };
  }
}

/* -------------------------------------------------------------------- cli */

export interface CliOptions {
  csv: string;
  episode: number;
  duration: number;
  initialState: string;
  out: string;
  /** Optional path to the show's registry; enables the `npc` id warnings. */
  registry?: string;
  /** Optional path to spells.json; enables `ref` in `spell` rows (008 R4). */
  spells?: string;
}

export type ArgsResult = { help: true } | { options: CliOptions } | { error: string };

export const USAGE = `usage: npm run sheet-to-json -- <csv> --episode <n> --duration <seconds> \\
  --initial-state <path> --out <path>

  <csv>                   sheet export; header row ${REQUIRED_COLUMNS.join(',')}
  --episode <n>           episode id written into the output
  --duration <seconds>    episode duration; rows past it are warned about
  --initial-state <path>  JSON file holding { party, map }
  --out <path>            where to write ep{N}.json
  --registry <path>       optional npcs.json; npc rows naming an entity or fact
                          it does not carry are warned about
  --spells <path>         optional spells.json; a kebab-case spell field1 is
                          then a registry id, and every ref in the rows and in
                          --initial-state is checked against it
  --help                  print this message`;

export function parseArgs(argv: string[]): ArgsResult {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };

  const positional: string[] = [];
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) return { error: `missing value for ${arg}` };
    flags.set(arg.slice(2), value);
    i += 1;
  }

  if (positional.length === 0) return { error: 'missing the <csv> argument' };
  if (positional.length > 1) {
    return { error: `expected one <csv> argument, got ${positional.length}` };
  }

  const episodeRaw = flags.get('episode');
  const episode = episodeRaw === undefined ? null : toNumber(episodeRaw);
  if (episode === null || !Number.isInteger(episode) || episode < 1) {
    return { error: '--episode <n> must be a positive integer' };
  }

  const durationRaw = flags.get('duration');
  const duration = durationRaw === undefined ? null : toNumber(durationRaw);
  if (duration === null || duration <= 0) {
    return { error: '--duration <seconds> must be a positive number' };
  }

  const initialState = flags.get('initial-state');
  if (initialState === undefined || initialState === '') {
    return { error: '--initial-state <path> is required' };
  }

  const out = flags.get('out');
  if (out === undefined || out === '') return { error: '--out <path> is required' };

  const registry = flags.get('registry');
  if (registry !== undefined && registry === '') {
    return { error: '--registry <path> must name a file' };
  }

  const spells = flags.get('spells');
  if (spells !== undefined && spells === '') {
    return { error: '--spells <path> must name a file' };
  }

  return {
    options: {
      csv: positional[0],
      episode,
      duration,
      initialState,
      out,
      // Absent unless asked for, so "no registry" and "an empty one" stay distinct.
      ...(registry === undefined ? {} : { registry }),
      ...(spells === undefined ? {} : { spells }),
    },
  };
}

/** Returns the process exit code; does not exit itself. */
export function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if ('error' in parsed) {
    process.stderr.write(`${USAGE}\n\nerror: ${parsed.error}\n`);
    return 2;
  }
  const { options } = parsed;

  let csvText: string;
  try {
    csvText = readFileSync(resolve(options.csv), 'utf8');
  } catch (error) {
    process.stderr.write(`error: cannot read csv ${options.csv}: ${(error as Error).message}\n`);
    return 2;
  }

  let initialState: InitialState;
  try {
    initialState = JSON.parse(readFileSync(resolve(options.initialState), 'utf8')) as InitialState;
  } catch (error) {
    process.stderr.write(
      `error: cannot read --initial-state ${options.initialState}: ${(error as Error).message}\n`,
    );
    return 2;
  }

  let registry: Registry | null = null;
  if (options.registry !== undefined) {
    try {
      registry = normalizeRegistry(
        JSON.parse(readFileSync(resolve(options.registry), 'utf8')) as unknown,
      );
    } catch (error) {
      process.stderr.write(
        `error: cannot read --registry ${options.registry}: ${(error as Error).message}\n`,
      );
      return 2;
    }
  }

  let spells: SpellRegistry | null = null;
  if (options.spells !== undefined) {
    try {
      spells = validateSpells(
        JSON.parse(readFileSync(resolve(options.spells), 'utf8')) as unknown,
      );
    } catch (error) {
      process.stderr.write(
        `error: cannot read --spells ${options.spells}: ${(error as Error).message}\n`,
      );
      return 2;
    }
  }

  const result = convert(csvText, {
    episodeId: options.episode,
    durationSec: options.duration,
    initialState,
    ...(options.registry === undefined ? {} : { registry }),
    ...(options.spells === undefined ? {} : { spells }),
  });

  for (const warning of result.warnings) process.stderr.write(`WARN ${warning}\n`);
  for (const error of result.errors) process.stderr.write(`ERROR ${error}\n`);

  if (result.errors.length > 0 || result.episode === undefined) {
    const count = result.errors.length;
    process.stderr.write(`nothing written (${count} error${count === 1 ? '' : 's'})\n`);
    return 1;
  }

  const outPath = resolve(options.out);
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(result.episode, null, 2)}\n`, 'utf8');
  } catch (error) {
    process.stderr.write(`error: cannot write ${options.out}: ${(error as Error).message}\n`);
    return 1;
  }

  process.stdout.write(
    `wrote ${options.out} (${result.episode.events.length} events, ${result.warnings.length} warnings)\n`,
  );
  return 0;
}

/** True only when this file is the process entry point, so tests can import it. */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = main(process.argv.slice(2));
}

/**
 * Editor sheet CSV → `ep{N}.json` (constitution: Author-Friendly Data Pipeline).
 *
 * Contract: specs/001-watch-hub-v1/contracts/sheet-csv.md, extended by
 * specs/002-watch-hub-v2/contracts/sheet-csv.md (skill / class / hotlist rows).
 *
 *   npm run sheet-to-json -- scripts/samples/ep1.csv --episode 1 --duration 240 \
 *     --initial-state scripts/samples/ep1.initial.json --out public/data/ep1.json
 *
 * Warnings (unknown actor, impossible HP, timecode past the duration, unknown type or
 * chapter kind) are reported and the file is still written. Only malformed input
 * (unparseable timecode, missing column, non-numeric numeric, empty required field)
 * is an error, and then nothing is written.
 *
 * Everything here is a pure exported function except `main()`, which runs only when
 * this file is executed directly.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import type { Cell, EpisodeData, Hp, InitialState } from '../src/data/types';
import { CHAPTER_KINDS } from '../src/data/types';
import { normalizeEpisode, toNumber } from '../src/data/validate';

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
}

export interface ConvertResult {
  /** Absent when `errors` is non-empty — nothing should be written. */
  episode?: EpisodeData;
  warnings: string[];
  errors: string[];
}

/** Types whose row is meaningless without an actor. `rank` depends on its scope. */
const ACTOR_EVENT_TYPES = new Set([
  'achievement',
  'loot',
  'hp',
  'level_up',
  'status',
  'inventory',
  'skill',
  'class',
  'hotlist',
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
  const needsActor = ACTOR_EVENT_TYPES.has(type) || (type === 'rank' && field1 === 'crawler');
  if (needsActor && actor === '') {
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
    case 'level_up': {
      const level = numericField(field1, 'level', 'field1', errors);
      if (level !== null) event = { t, type, actor, level };
      break;
    }
    case 'rank': {
      if (field1 !== 'party' && field1 !== 'crawler') {
        errors.push(
          `rank scope (field1) must be "party" or "crawler", got ${JSON.stringify(field1)}`,
        );
        break;
      }
      const rank = numericField(field2, 'rank', 'field2', errors);
      if (rank === null) break;
      event =
        field1 === 'crawler'
          ? { t, type, scope: field1, rank, actor }
          : { t, type, scope: field1, rank };
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
    case 'class': {
      if (field1 === '') errors.push('empty required field: class (field1) on class');
      else event = { t, type, actor, class: field1 };
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
  };

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
}

export type ArgsResult = { help: true } | { options: CliOptions } | { error: string };

export const USAGE = `usage: npm run sheet-to-json -- <csv> --episode <n> --duration <seconds> \\
  --initial-state <path> --out <path>

  <csv>                   sheet export; header row ${REQUIRED_COLUMNS.join(',')}
  --episode <n>           episode id written into the output
  --duration <seconds>    episode duration; rows past it are warned about
  --initial-state <path>  JSON file holding { party, partyRank, map }
  --out <path>            where to write ep{N}.json
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

  return { options: { csv: positional[0], episode, duration, initialState, out } };
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

  const result = convert(csvText, {
    episodeId: options.episode,
    durationSec: options.duration,
    initialState,
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

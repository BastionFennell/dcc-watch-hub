/**
 * Writes `dist/data/status.json` (011 §5). Run by `scripts/postbuild.mjs`:
 *
 *   npx tsx scripts/build-status.ts [--now <iso|ms>] [--out <path>]
 *
 * `--now` moves the spoiler gate, which is how a test (or the author) sees what
 * the file will look like before an episode unlocks. The decision itself lives
 * in `scripts/status.ts`; everything here is paths and bytes.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EpisodeMeta, Show } from '../src/data/types';
import { normalizeEpisode, normalizeShow } from '../src/data/validate';
import { buildStatus } from './status';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `usage: tsx scripts/build-status.ts [--now <iso-date|ms>] [--out <path>]

  --now   pretend the build is running at this time (default: right now)
  --out   where to write the file (default: dist/data/status.json)`;

export interface Options {
  now: number;
  out: string;
}

export function parseArgs(argv: string[]): Options | { error: string } {
  const options: Options = { now: Date.now(), out: resolve(root, 'dist/data/status.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--now') {
      if (value === undefined) return { error: '--now needs a value' };
      const parsed = /^\d+$/.test(value) ? Number(value) : Date.parse(value);
      if (Number.isNaN(parsed)) return { error: `--now: "${value}" is not a date` };
      options.now = parsed;
      i += 1;
    } else if (flag === '--out') {
      if (value === undefined) return { error: '--out needs a value' };
      options.out = resolve(root, value);
      i += 1;
    } else {
      return { error: `unknown argument "${flag}"` };
    }
  }
  return options;
}

function readShow(): Show {
  return normalizeShow(JSON.parse(readFileSync(resolve(root, 'public/data/show.json'), 'utf8')));
}

function loadEpisode(meta: EpisodeMeta) {
  return normalizeEpisode(JSON.parse(readFileSync(resolve(root, `public${meta.dataUrl}`), 'utf8')));
}

export function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    process.stderr.write(`${USAGE}\n\nerror: ${parsed.error}\n`);
    return 2;
  }
  const status = buildStatus(readShow(), loadEpisode, parsed.now);
  mkdirSync(dirname(parsed.out), { recursive: true });
  writeFileSync(parsed.out, `${JSON.stringify(status, null, 2)}\n`);
  const count = Object.keys(status.crawlers).length;
  process.stdout.write(
    status.episodeId === null
      ? `build-status: no episode is past its hubLiveAt yet; wrote an empty ${parsed.out}\n`
      : `build-status: episode ${status.episodeId}, ${count} crawler(s) -> ${parsed.out}\n`,
  );
  return 0;
}

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

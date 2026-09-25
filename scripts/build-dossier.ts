/**
 * Writes `public/data/dossier/<id>.json`, one per crawler (012):
 *
 *   npx tsx scripts/build-dossier.ts [--now <iso|ms>] [--out <dir>]
 *
 * It runs from `prebuild` and `predev`, before Vite copies `public/` into
 * `dist/` - which is why the output lands in `public/data/`, gitignored, rather
 * than in `dist/` the way `status.json` does. The prerenderer reads it from
 * there a step later and embeds each crawler's file into their page.
 *
 * `--now` moves the aired gate, which is how the author sees what next week's
 * build will publish. The decisions all live in `scripts/dossier.ts`; this file
 * is paths, bytes and one reducer run per episode.
 */
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CrawlerProfile, EpisodeMeta, Show } from '../src/data/types';
import { normalizeEpisode, normalizeShow } from '../src/data/validate';
import { validateCrawlers } from '../src/data/roster';
import { reduceTo } from '../src/engine/reducer';
import { airedEpisodes, compileDossier, lintUpdates, parseAuthored } from './dossier';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const USAGE = `usage: tsx scripts/build-dossier.ts [--now <iso-date|ms>] [--out <dir>]

  --now   pretend the build is running at this time (default: right now)
  --out   where to write the files (default: public/data/dossier)`;

export interface Options {
  now: number;
  out: string;
}

export function parseArgs(argv: string[]): Options | { error: string } {
  const options: Options = { now: Date.now(), out: resolve(root, 'public/data/dossier') };
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
      if (value === undefined) return { error: '--out needs a directory' };
      options.out = resolve(root, value);
      i += 1;
    } else {
      return { error: `unknown argument "${flag}"` };
    }
  }
  return options;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function readShow(): Show {
  return normalizeShow(readJson(resolve(root, 'public/data/show.json')));
}

function readCrawlers(): CrawlerProfile[] {
  return validateCrawlers(readJson(resolve(root, 'public/data/crawlers.json'))).crawlers;
}

/** The authored file, or an empty one: a crawler nobody has written about yet is normal. */
function readAuthored(id: string): unknown {
  try {
    return readJson(resolve(root, `content/status/${id}.json`));
  } catch {
    return { id, updates: [] };
  }
}

/**
 * Crawler id -> level at the end of every aired episode, from the same
 * `reduceTo(episode, Infinity)` the viewer runs. One read and one reduction per
 * episode, not per crawler: the reducer hands back the whole party at once.
 *
 * An episode whose file cannot be read costs that episode's levels and nothing
 * else - the authored numbers still stand, and an unauthored card falls back to
 * the last level the crawler was known to have.
 */
export function levelsByEpisode(episodes: EpisodeMeta[]): Map<number, Map<string, number>> {
  const levels = new Map<number, Map<string, number>>();
  for (const meta of episodes) {
    let party;
    try {
      const episode = normalizeEpisode(readJson(resolve(root, `public${meta.dataUrl}`)));
      party = reduceTo(episode, Number.POSITIVE_INFINITY).party;
    } catch (cause) {
      process.stdout.write(
        `build-dossier: episode ${String(meta.id)} could not be read (${String(cause)}); deriving no levels from it.\n`,
      );
      continue;
    }
    const byCrawler = new Map<string, number>();
    for (const crawler of party) byCrawler.set(crawler.id, crawler.level);
    levels.set(meta.id, byCrawler);
  }
  return levels;
}

export function main(argv: string[]): number {
  const parsed = parseArgs(argv);
  if ('error' in parsed) {
    process.stderr.write(`${USAGE}\n\nerror: ${parsed.error}\n`);
    return 2;
  }
  const { now, out } = parsed;

  const show = readShow();
  const crawlers = readCrawlers();
  const aired = airedEpisodes(show, now);
  const airedIds = aired.map((episode) => episode.id);
  const allIds = show.episodes.map((episode) => episode.id);
  const levels = levelsByEpisode(aired);

  let errors = 0;
  mkdirSync(out, { recursive: true });

  for (const crawler of crawlers) {
    const parsedFile = parseAuthored(readAuthored(crawler.id), crawler.id);
    const lint = lintUpdates(parsedFile.updates, airedIds, allIds);
    for (const warning of lint.warnings) {
      process.stdout.write(`build-dossier: ${crawler.id}: warning: ${warning}\n`);
    }
    for (const error of [...parsedFile.errors, ...lint.errors]) {
      process.stderr.write(`build-dossier: ${crawler.id}: error: ${error}\n`);
      errors += 1;
    }

    const dossier = compileDossier({
      crawler,
      show,
      authored: parsedFile.updates,
      levelAt: (episodeId) => levels.get(episodeId)?.get(crawler.id) ?? null,
      now,
    });
    writeFileSync(resolve(out, `${crawler.id}.json`), `${JSON.stringify(dossier, null, 2)}\n`);

    // Authored cards for unaired episodes do not ship, so they do not count.
    const airedSet = new Set(airedIds);
    const shipped = parsedFile.updates.filter((card) => airedSet.has(card.episode)).length;
    process.stdout.write(
      `build-dossier: ${crawler.id}: ${String(dossier.updates.length)} card(s) across ${String(airedIds.length)} aired episode(s), ${String(shipped)} authored, ${String(dossier.updates.length - shipped)} generated\n`,
    );
  }

  if (errors > 0) {
    process.stderr.write(
      `build-dossier: ${String(errors)} content error(s); no build ships with a broken dossier.\n`,
    );
    return 1;
  }
  process.stdout.write(
    `build-dossier: ${String(crawlers.length)} crawler(s) -> ${out}${airedIds.length === 0 ? ' (no episode has aired yet)' : ''}\n`,
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

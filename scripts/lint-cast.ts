/**
 * Checks `public/data/cast.json` against `crawlers.json` and the photos on disk
 * (014):
 *
 *   npx tsx scripts/lint-cast.ts
 *
 * It runs from `prebuild`, after the dossier, so no build ships with a cast
 * member who names a missing crawler, a crawler nobody plays, or a photo that
 * is missing or over budget. The rules all live in `scripts/cast.ts`; this file
 * is paths and bytes.
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintCast } from './cast';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    // The lint reports "not a cast file"; the parse error itself helps nobody.
    return null;
  }
}

/** A leading-slash photo path -> its size under `public/`, or `null` when absent. */
export function publicFileSize(path: string): number | null {
  try {
    const stat = statSync(resolve(root, 'public', `.${path}`));
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}

export function main(): number {
  const cast = readJson(resolve(root, 'public/data/cast.json'));
  const crawlers = readJson(resolve(root, 'public/data/crawlers.json'));
  const errors = lintCast(cast, crawlers, publicFileSize);
  for (const error of errors) process.stderr.write(`lint-cast: error: ${error}\n`);
  if (errors.length > 0) {
    process.stderr.write(
      `lint-cast: ${String(errors.length)} error(s) in public/data/cast.json; no build ships with a broken cast.\n`,
    );
    return 1;
  }
  const count = Array.isArray((cast as { cast?: unknown }).cast)
    ? (cast as { cast: unknown[] }).cast.length
    : 0;
  process.stdout.write(`lint-cast: ${String(count)} cast member(s), all good\n`);
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
  process.exit(main());
}

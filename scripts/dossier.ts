/**
 * The dossier's pure half (012): read authored cards, complain about them,
 * compile them into what ships. No disk, no clock, no React - the I/O lives in
 * `scripts/build-dossier.ts`, which is what makes every rule below testable
 * against a literal.
 *
 * The one invariant the whole feature exists to keep: **absence is never a
 * signal**. `compileDossier` emits exactly one card per aired episode, always,
 * filling the gaps the author left with a quiet card in fixed words. A crawler
 * who dies in Episode 9 keeps getting cards; a crawler who missed Episode 4
 * gets the same card a dead one would. Nothing a reader can count tells them
 * anything.
 *
 * The other half of that invariant is the aired filter: a card for an episode
 * whose `hubLiveAt` is still in the future is dropped here, so it never reaches
 * the served file, the prerendered payload or a devtools tab.
 */
import type {
  AuthoredUpdate,
  CrawlerCondition,
  DossierCard,
  DossierFile,
  DossierKind,
  EpisodeMeta,
  Show,
} from '../src/data/types';
import { CRAWLER_CONDITIONS, DOSSIER_KINDS } from '../src/data/types';
import { hubLive } from '../src/site/gate';
import { quietBody, quietTitle } from '../src/site/dossier/quiet';

/** The authoring limits from the spec. Both are lint errors, not truncations. */
export const MAX_TITLE_LENGTH = 60;
export const MAX_CHIPS = 3;

export interface LintResult {
  /** Any one of these fails the build. */
  errors: string[];
  /** Printed and ignored: the build still writes a file. */
  warnings: string[];
}

/* --------------------------------------------------------------- parsing */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export interface ParseResult {
  updates: AuthoredUpdate[];
  errors: string[];
}

/**
 * `content/status/<id>.json` as it sits on disk -> the typed cards, plus every
 * structural complaint. Strict where `validateDossier` (the client's reader) is
 * lenient: this runs at build time, where a typo in a field name should stop
 * the build rather than quietly cost a card.
 *
 * @param id the crawler the file is supposed to be about (its basename).
 */
export function parseAuthored(raw: unknown, id: string): ParseResult {
  const where = `content/status/${id}.json`;
  if (!isRecord(raw)) return { updates: [], errors: [`${where}: not a JSON object.`] };

  const errors: string[] = [];
  if (raw.id !== id) {
    errors.push(`${where}: "id" is ${JSON.stringify(raw.id)}, expected "${id}".`);
  }
  if (!Array.isArray(raw.updates)) {
    errors.push(`${where}: "updates" is missing or not an array.`);
    return { updates: [], errors };
  }

  const updates: AuthoredUpdate[] = [];
  (raw.updates as unknown[]).forEach((entry, index) => {
    const at = `${where} [${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${at}: not an object.`);
      return;
    }
    const before = errors.length;
    const episode = entry.episode;
    if (typeof episode !== 'number' || !Number.isInteger(episode)) {
      errors.push(`${at}: "episode" must be an integer.`);
    }
    if (!(DOSSIER_KINDS as readonly unknown[]).includes(entry.kind)) {
      errors.push(`${at}: "kind" must be "update" or "quiet".`);
    }
    if (typeof entry.onCamera !== 'boolean') {
      errors.push(`${at}: "onCamera" must be true or false.`);
    }
    if (typeof entry.title !== 'string') errors.push(`${at}: "title" must be a string.`);
    if (typeof entry.body !== 'string') errors.push(`${at}: "body" must be a string.`);
    if (!Array.isArray(entry.chips) || entry.chips.some((chip) => typeof chip !== 'string')) {
      errors.push(`${at}: "chips" must be an array of strings.`);
    }
    if (entry.level !== null && (typeof entry.level !== 'number' || !Number.isInteger(entry.level))) {
      errors.push(`${at}: "level" must be an integer or null.`);
    }
    if (!(CRAWLER_CONDITIONS as readonly unknown[]).includes(entry.condition)) {
      errors.push(`${at}: "condition" must be "alive" or "deceased".`);
    }
    if (errors.length !== before) return;

    updates.push({
      episode: episode as number,
      kind: entry.kind as DossierKind,
      onCamera: entry.onCamera as boolean,
      title: entry.title as string,
      body: entry.body as string,
      chips: entry.chips as string[],
      level: entry.level as number | null,
      condition: entry.condition as CrawlerCondition,
    });
  });

  return { updates, errors };
}

/* ---------------------------------------------------------------- linting */

/**
 * Every rule the spec makes the build enforce.
 *
 * Errors (the build stops):
 *  - a card for an episode `show.json` has never heard of;
 *  - two cards for the same episode;
 *  - cards out of ascending order;
 *  - an empty title or body, a title over 60 characters, more than 3 chips,
 *    an empty chip;
 *  - a level below 1;
 *  - condition going back to `alive` after a card reported `deceased`.
 *
 * Warnings (printed, the build continues):
 *  - a card for an episode that has not aired yet - legal to write ahead, and
 *    dropped at compile time so it cannot ship;
 *  - a `quiet` card that also claims `onCamera: true`, which is a contradiction
 *    the reader would see.
 *
 * Note what is *not* here: a missing card for an aired episode. That is the
 * normal case, and the compiler fills it with a quiet card.
 *
 * @param airedEpisodes ids past their `hubLiveAt`, in any order.
 * @param allEpisodeIds every id in `show.json`, aired or not.
 */
export function lintUpdates(
  authored: readonly AuthoredUpdate[],
  airedEpisodes: readonly number[],
  allEpisodeIds: readonly number[],
): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const known = new Set(allEpisodeIds);
  const aired = new Set(airedEpisodes);
  const seen = new Set<number>();

  let previousEpisode = Number.NEGATIVE_INFINITY;
  let deceasedAt: number | null = null;

  for (const card of authored) {
    const at = `episode ${card.episode}`;

    if (!known.has(card.episode)) {
      errors.push(`${at}: no such episode in show.json.`);
    } else if (!aired.has(card.episode)) {
      warnings.push(`${at}: has not aired yet; the card is written but will not ship.`);
    }

    if (seen.has(card.episode)) errors.push(`${at}: a second card for the same episode.`);
    seen.add(card.episode);

    if (card.episode <= previousEpisode) {
      errors.push(`${at}: out of order; cards must ascend by episode.`);
    }
    previousEpisode = card.episode;

    if (card.title.trim() === '') errors.push(`${at}: the title is empty.`);
    if (card.title.length > MAX_TITLE_LENGTH) {
      errors.push(
        `${at}: the title is ${String(card.title.length)} characters (max ${String(MAX_TITLE_LENGTH)}).`,
      );
    }
    if (card.body.trim() === '') errors.push(`${at}: the body is empty.`);
    if (card.chips.length > MAX_CHIPS) {
      errors.push(`${at}: ${String(card.chips.length)} chips (max ${String(MAX_CHIPS)}).`);
    }
    if (card.chips.some((chip) => chip.trim() === '')) errors.push(`${at}: an empty chip.`);
    if (card.level !== null && card.level < 1) {
      errors.push(`${at}: level ${String(card.level)} is below 1.`);
    }

    if (card.condition === 'deceased') {
      deceasedAt ??= card.episode;
    } else if (deceasedAt !== null) {
      errors.push(
        `${at}: condition returns to "alive" after episode ${String(deceasedAt)} reported "deceased". Condition is sticky.`,
      );
    }

    if (card.kind === 'quiet' && card.onCamera) {
      warnings.push(`${at}: a quiet card marked onCamera; a reader would see the contradiction.`);
    }
  }

  return { errors, warnings };
}

/* -------------------------------------------------------------- compiling */

/** Every episode a reader is allowed to have seen, oldest first. */
export function airedEpisodes(show: Show, now: number): EpisodeMeta[] {
  return show.episodes.filter((episode) => hubLive(episode, now)).sort((a, b) => a.id - b.id);
}

export interface CompileInput {
  /** The roster entry: its `id` names the file, its `characterName` is in the quiet body. */
  crawler: { id: string; characterName: string };
  show: Show;
  authored: readonly AuthoredUpdate[];
  /** The hub reducer's answer at the end of that episode; `null` when it has none. */
  levelAt: (episodeId: number) => number | null;
  now: number;
}

/**
 * One card per aired episode, ascending, with nothing left to derive.
 *
 * Three things get filled in here rather than authored:
 *  - **floor**, from `show.json`, so the two can never drift apart;
 *  - **level**, when the author wrote `null`: the reducer's level at the end of
 *    that episode, and failing that the previous card's (a crawler's level
 *    never goes down just because a file is missing);
 *  - **condition**, which is sticky. The lint has already refused an authored
 *    `alive` after a `deceased`; this re-applies the rule to the generated
 *    cards, which inherit the condition they follow.
 */
export function compileDossier(input: CompileInput): DossierFile {
  const { crawler, show, authored, levelAt, now } = input;
  const byEpisode = new Map<number, AuthoredUpdate>();
  for (const card of authored) {
    if (!byEpisode.has(card.episode)) byEpisode.set(card.episode, card);
  }

  const updates: DossierCard[] = [];
  let condition: CrawlerCondition = 'alive';
  let level = 1;

  for (const episode of airedEpisodes(show, now)) {
    const card = byEpisode.get(episode.id);
    /*
     * A derived level is a high-water mark, not a reading. Each episode file
     * opens its party at its own `initialState`, so a later episode can report
     * a smaller number without anything having happened to the crawler; "last
     * known level" must never go down on its own. An authored level wins
     * outright - the author is allowed to say something the log does not.
     */
    const derived = levelAt(episode.id);
    level = card?.level ?? (derived === null ? level : Math.max(derived, level));
    if (card !== undefined && card.condition === 'deceased') condition = 'deceased';

    updates.push({
      episode: episode.id,
      floor: episode.floor,
      kind: card?.kind ?? 'quiet',
      onCamera: card?.onCamera ?? false,
      title: card?.title ?? quietTitle,
      body: card?.body ?? quietBody(crawler.characterName),
      chips: card === undefined ? [] : [...card.chips],
      level,
      condition,
    });
  }

  return { id: crawler.id, generatedAt: new Date(now).toISOString(), updates };
}

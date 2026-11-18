/**
 * The cast's build lint (014): every rule of spec FR-011, as a pure function.
 * No disk - the one thing it needs to know about files, how big a photo is,
 * arrives as a probe - so each rule is testable against a literal, and the I/O
 * lives in `scripts/lint-cast.ts`.
 *
 * Strict where `validateCast` (the client's reader) is lenient, on the split
 * the dossier uses (012): at runtime a typo costs one card, at build time it
 * stops the build, so a typo never ships and the page never white-screens.
 *
 * The cross-file rules are the reason this exists rather than the schema alone:
 * every `crawlerId` names a real crawler, every crawler has exactly one player,
 * and every photo is on disk and inside its budget (SC-005), so a later photo
 * swap cannot quietly double the page's weight.
 */
import { CAST_LINK_KINDS } from '../src/data/types';

/** Byte budgets for the two photo sizes (spec FR-013): 45 kB and 8 kB. */
export const CARD_PHOTO_BUDGET = 45_000;
export const CREDIT_PHOTO_BUDGET = 8_000;

const SLUG = /^[a-z0-9-]+$/;
const PRONOUNS = /^[a-z]+(\/[a-z]+)+$/;

/** A photo's size in bytes, or `null` when there is no such file under `public/`. */
export type FileSize = (path: string) => number | null;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x !== '';
}

/** The ids `crawlers.json` declares, read raw: the lint trusts no validator. */
function crawlerIds(crawlersRaw: unknown): string[] | null {
  if (!isRecord(crawlersRaw) || !Array.isArray(crawlersRaw.crawlers)) return null;
  return (crawlersRaw.crawlers as unknown[])
    .map((crawler) => (isRecord(crawler) ? crawler.id : undefined))
    .filter(isNonEmptyString);
}

/** One photo field: present, a leading-slash path, on disk and inside its budget. */
function lintPhoto(
  who: string,
  field: 'card' | 'credit',
  value: unknown,
  budget: number,
  fileSize: FileSize,
): string[] {
  if (!isNonEmptyString(value) || !value.startsWith('/')) {
    return [`${who}: photo.${field} must be a path starting with "/".`];
  }
  const size = fileSize(value);
  if (size === null) return [`${who}: photo.${field} "${value}" does not exist under public/.`];
  if (size > budget) {
    return [
      `${who}: photo.${field} "${value}" is ${String(size)} bytes; the budget is ${String(budget)}.`,
    ];
  }
  return [];
}

/** Every complaint about one member. `who` is their id, or their index when it is unusable. */
function lintMember(
  member: Record<string, unknown>,
  who: string,
  crawlers: Set<string> | null,
  fileSize: FileSize,
): string[] {
  const errors: string[] = [];

  if (!isNonEmptyString(member.name)) errors.push(`${who}: "name" must be a non-empty string.`);

  if (member.pronouns !== undefined) {
    if (typeof member.pronouns !== 'string' || !PRONOUNS.test(member.pronouns)) {
      errors.push(
        `${who}: pronouns ${JSON.stringify(member.pronouns)} are not in slash form ("she/they").`,
      );
    }
  }

  const hasCrawler = member.crawlerId !== undefined;
  const hasRole = member.role !== undefined;
  if (hasCrawler === hasRole) {
    errors.push(`${who}: set exactly one of "crawlerId" and "role".`);
  }
  if (hasRole && !isNonEmptyString(member.role)) {
    errors.push(`${who}: "role" must be a non-empty string.`);
  }
  if (hasCrawler) {
    if (!isNonEmptyString(member.crawlerId)) {
      errors.push(`${who}: "crawlerId" must be a non-empty string.`);
    } else if (crawlers !== null && !crawlers.has(member.crawlerId)) {
      errors.push(`${who}: crawlerId "${member.crawlerId}" is not a crawler in crawlers.json.`);
    }
  }

  if (!Array.isArray(member.bio)) {
    errors.push(`${who}: "bio" must be an array of paragraphs ([] when not written yet).`);
  } else {
    (member.bio as unknown[]).forEach((paragraph, index) => {
      if (!isNonEmptyString(paragraph)) {
        errors.push(`${who}: bio[${String(index)}] must be a non-empty string.`);
      }
    });
  }

  const photo = isRecord(member.photo) ? member.photo : {};
  errors.push(...lintPhoto(who, 'card', photo.card, CARD_PHOTO_BUDGET, fileSize));
  errors.push(...lintPhoto(who, 'credit', photo.credit, CREDIT_PHOTO_BUDGET, fileSize));

  if (!Array.isArray(member.links)) {
    errors.push(`${who}: "links" must be an array ([] when there are none).`);
  } else {
    (member.links as unknown[]).forEach((link, index) => {
      const at = `${who}: links[${String(index)}]`;
      if (!isRecord(link)) {
        errors.push(`${at} must be an object { kind, url }.`);
        return;
      }
      const known = (CAST_LINK_KINDS as readonly unknown[]).includes(link.kind);
      if (!known) {
        errors.push(
          `${at}: kind ${JSON.stringify(link.kind)} is not one of ${CAST_LINK_KINDS.join(', ')}.`,
        );
      }
      if (typeof link.url !== 'string' || !/^https:\/\/.+/.test(link.url)) {
        errors.push(`${at}: url ${JSON.stringify(link.url)} is not an https:// address.`);
      }
    });
  }

  return errors;
}

/**
 * Every problem with `cast.json`, given `crawlers.json` beside it. `[]` means
 * the build may ship. Each message starts with the member's id - or, for the
 * two roster rules, the crawler's - so the author knows which entry to open.
 */
export function lintCast(castRaw: unknown, crawlersRaw: unknown, fileSize: FileSize): string[] {
  if (!isRecord(castRaw) || !Array.isArray(castRaw.cast)) {
    return ['cast.json: the file must be an object with a "cast" array.'];
  }
  const ids = crawlerIds(crawlersRaw);
  const errors: string[] =
    ids === null ? ['crawlers.json: the file must be an object with a "crawlers" array.'] : [];
  const crawlers = ids === null ? null : new Set(ids);

  const seen = new Set<string>();
  const players = new Map<string, number>();
  (castRaw.cast as unknown[]).forEach((member, index) => {
    if (!isRecord(member)) {
      errors.push(`cast[${String(index)}]: not an object.`);
      return;
    }
    let who = `cast[${String(index)}]`;
    if (typeof member.id !== 'string' || !SLUG.test(member.id)) {
      errors.push(`${who}: id ${JSON.stringify(member.id)} is not a lowercase slug.`);
    } else {
      who = member.id;
      if (seen.has(member.id)) errors.push(`${who}: the id is used by more than one member.`);
      seen.add(member.id);
    }
    if (isNonEmptyString(member.crawlerId)) {
      players.set(member.crawlerId, (players.get(member.crawlerId) ?? 0) + 1);
    }
    errors.push(...lintMember(member, who, crawlers, fileSize));
  });

  for (const id of ids ?? []) {
    const count = players.get(id) ?? 0;
    if (count === 0) errors.push(`${id}: has no player in cast.json.`);
    if (count > 1) errors.push(`${id}: has more than one player in cast.json.`);
  }

  return errors;
}

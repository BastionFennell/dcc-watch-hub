/**
 * The front door's data layer (011): `crawlers.json` and the generated
 * `status.json`, validated and fetched.
 *
 * Its own module rather than a section of `validate.ts` and `load.ts` for one
 * reason worth stating: the hub ships as one entry chunk and the marketing
 * pages as lazy ones, and any module both sides import is hoisted into the
 * entry chunk. Only `CrawlersContext` imports this file, and only the front
 * door mounts that - so a viewer who opens `/ep/3` never downloads a line of it.
 *
 * Lenient like every loader here, and never throws: a malformed profile costs
 * that crawler, an unusable file costs the roster, and a missing status file
 * costs the live line.
 */
import type {
  CrawlerEntryAchievement,
  CrawlerLiveStatus,
  CrawlerPlayer,
  CrawlerProfile,
  CrawlerRoster,
  CrawlerStatus,
  Hp,
  StatusFile,
} from './types';
import { CRAWLER_LIVE_STATUSES } from './types';
import { isRecord, toNonEmptyStringList, toNumber, toString_ } from './validate';
import { fetchJson, joinBase, siteBaseUrl } from './load';

const CRAWLERS_URL = '/data/crawlers.json';
const STATUS_URL = '/data/status.json';

function toLiveStatus(x: unknown): CrawlerLiveStatus | null {
  const s = toString_(x);
  return s !== null && (CRAWLER_LIVE_STATUSES as readonly string[]).includes(s)
    ? (s as CrawlerLiveStatus)
    : null;
}

/** `{ name, ... }`. A player with no name is not a player, so the crawler falls. */
function toPlayer(x: unknown, crawlerId: string): CrawlerPlayer | null {
  if (!isRecord(x)) return null;
  const name = toString_(x.name);
  if (name === null || name === '') return null;

  const pronouns = toString_(x.pronouns);
  const bio = toString_(x.bio);
  const bust = toString_(x.bust);

  let links: Record<string, string> | undefined;
  if (isRecord(x.links)) {
    const pairs: Record<string, string> = {};
    for (const [key, value] of Object.entries(x.links)) {
      const href = toString_(value);
      if (href === null || href === '') {
        console.warn(`Crawler "${crawlerId}": dropping malformed player link "${key}".`);
        continue;
      }
      pairs[key] = href;
    }
    if (Object.keys(pairs).length > 0) links = pairs;
  } else if (x.links !== undefined) {
    console.warn(`Crawler "${crawlerId}": dropping malformed player "links".`);
  }

  return {
    name,
    ...(pronouns === null || pronouns === '' ? {} : { pronouns }),
    ...(bio === null || bio === '' ? {} : { bio }),
    ...(bust === null || bust === '' ? {} : { bust }),
    ...(links === undefined ? {} : { links }),
  };
}

/** The whole block is dropped when the title or the text is missing. */
function toEntryAchievement(x: unknown, crawlerId: string): CrawlerEntryAchievement | undefined {
  if (x === undefined) return undefined;
  if (!isRecord(x)) {
    console.warn(`Crawler "${crawlerId}": dropping malformed "entryAchievement".`);
    return undefined;
  }
  const title = toString_(x.title);
  const text = toString_(x.text);
  if (title === null || title === '' || text === null || text === '') {
    console.warn(`Crawler "${crawlerId}": dropping an "entryAchievement" with no title or text.`);
    return undefined;
  }
  const box = toString_(x.box);
  const item = toString_(x.item);
  const reward = toString_(x.reward);
  return {
    title,
    text,
    ...(box === null || box === '' ? {} : { box }),
    ...(item === null || item === '' ? {} : { item }),
    ...(reward === null || reward === '' ? {} : { reward }),
  };
}

/** One profile, or `null` when it is missing something no page can invent. */
function toCrawlerProfile(raw: unknown): CrawlerProfile | null {
  if (!isRecord(raw)) return null;
  const id = toString_(raw.id);
  if (id === null || id === '') return null;

  const name = toString_(raw.name);
  const characterName = toString_(raw.characterName);
  const handle = toString_(raw.handle);
  /*
   * An unwritten concept is a real state, not a broken row (011 R2): the page
   * renders nothing where it would have gone rather than a placeholder, so
   * empty - and absent, which reads the same - is normal, not a reason to drop
   * the crawler.
   */
  const concept = toString_(raw.concept) ?? '';
  const status = toLiveStatus(raw.status);
  const player = toPlayer(raw.player, id);
  const bust = isRecord(raw.art) ? toString_(raw.art.bust) : null;

  if (name === null || name === '') return null;
  if (characterName === null || characterName === '') return null;
  if (handle === null || handle === '') return null;
  if (status === null || player === null) return null;
  if (bust === null || bust === '') return null;

  const full = isRecord(raw.art) ? toString_(raw.art.full) : null;
  const og = toString_(raw.og);
  const entryAchievement = toEntryAchievement(raw.entryAchievement, id);

  return {
    id,
    name,
    characterName,
    handle,
    player,
    concept,
    pockets: toNonEmptyStringList(raw.pockets),
    ...(entryAchievement === undefined ? {} : { entryAchievement }),
    art: { bust, ...(full === null || full === '' ? {} : { full }) },
    ...(og === null || og === '' ? {} : { og }),
    status,
  };
}

/**
 * `crawlers.json` (011). Lenient like every other loader here: a malformed
 * profile costs that crawler and nothing else, and an unusable file costs the
 * roster rather than the page. This function never throws.
 */
export function validateCrawlers(raw: unknown): CrawlerRoster {
  if (!isRecord(raw) || !Array.isArray(raw.crawlers)) {
    console.warn('Crawlers: the roster file does not match the schema; using an empty roster.');
    return { crawlers: [] };
  }
  const crawlers: CrawlerProfile[] = [];
  const seen = new Set<string>();
  for (const item of raw.crawlers as unknown[]) {
    const profile = toCrawlerProfile(item);
    if (profile === null) {
      console.warn('Crawlers: dropping a malformed crawler.');
      continue;
    }
    if (seen.has(profile.id)) {
      console.warn(`Crawlers: dropping duplicate crawler "${profile.id}".`);
      continue;
    }
    seen.add(profile.id);
    crawlers.push(profile);
  }
  const todo = toNonEmptyStringList(raw.todo);
  return { crawlers, ...(todo.length === 0 ? {} : { todo }) };
}

function toHp(x: unknown): Hp | null {
  if (!isRecord(x)) return null;
  const current = toNumber(x.current);
  const max = toNumber(x.max);
  return current === null || max === null ? null : { current, max };
}

function toCrawlerStatus(x: unknown): CrawlerStatus | null {
  if (!isRecord(x)) return null;
  const level = toNumber(x.level);
  const floor = toNumber(x.floor);
  const lastEpisodeId = toNumber(x.lastEpisodeId);
  const hp = toHp(x.hp);
  if (level === null || floor === null || lastEpisodeId === null || hp === null) return null;
  return { level, hp, floor, lastEpisodeId };
}

/**
 * The generated `status.json` (011). `null` for a file that is not one - the
 * live line simply does not render, which is the same as no file at all.
 * This function never throws.
 */
export function validateStatus(raw: unknown): StatusFile | null {
  if (!isRecord(raw) || !isRecord(raw.crawlers)) {
    console.warn('Status: the status file does not match the schema; ignoring it.');
    return null;
  }
  const crawlers: Record<string, CrawlerStatus> = {};
  for (const [id, value] of Object.entries(raw.crawlers)) {
    const status = toCrawlerStatus(value);
    if (status === null) {
      console.warn(`Status: dropping a malformed entry for "${id}".`);
      continue;
    }
    crawlers[id] = status;
  }
  const episodeId = toNumber(raw.episodeId);
  const generatedAt = toString_(raw.generatedAt);
  return {
    generatedAt: generatedAt ?? '',
    episodeId,
    crawlers,
    ...(isRecord(raw.appearances) ? { appearances: toAppearances(raw.appearances) } : {}),
  };
}

/**
 * The precomputed "appears in" map. Absent is meaningful - it tells the crawler
 * page to derive the list itself - so an unreadable entry is dropped rather
 * than defaulted, and a file with no map at all keeps none.
 */
function toAppearances(raw: Record<string, unknown>): Record<string, number[]> {
  const appearances: Record<string, number[]> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const ids: number[] = [];
    for (const item of value) {
      const id_ = toNumber(item);
      if (id_ !== null) ids.push(id_);
    }
    appearances[id] = ids;
  }
  return appearances;
}

/**
 * The authored crawler roster. Lenient: a file that is not a roster costs the
 * roster and nothing else, so `/crawlers` renders empty rather than failing.
 */
export async function fetchCrawlers(): Promise<CrawlerRoster> {
  return validateCrawlers(await fetchJson(joinBase(siteBaseUrl(), CRAWLERS_URL)));
}

/**
 * The build-time live status, or `null` when there is none. A 404 is the normal
 * case in `npm run dev` (the file only exists in `dist/`), so it is not an
 * error: the crawler pages simply show no live line (011 §5).
 */
export async function fetchStatus(): Promise<StatusFile | null> {
  const url = joinBase(siteBaseUrl(), STATUS_URL);
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    return validateStatus((await response.json()) as unknown);
  } catch {
    return null;
  }
}

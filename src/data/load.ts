/**
 * Static JSON loading. No server, no cache layer: two fetches per episode page
 * (constitution IV). `dataUrl` values keep the leading slash the handoff schema
 * shows and are resolved against the deploy base at fetch time (research R3).
 */
import type {
  Embedded,
  EpisodeData,
  EpisodeMeta,
  Registry,
  Show,
  SpellRegistry,
} from './types';
import {
  DataError,
  normalizeEpisode,
  normalizeRegistry,
  normalizeShow,
  validateSpells,
} from './validate';

const SHOW_URL = '/data/show.json';
/** 011: the prerenderer's payload, parsed once at boot. */
export const EMBEDDED_ID = '__DCC__';

/** `joinBase('/dcc-watch-hub/', '/data/ep1.json') === '/dcc-watch-hub/data/ep1.json'`. */
export function joinBase(base: string, url: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  if (normalizedBase === '' || normalizedBase === '.') return url;
  return `${normalizedBase}${url}`;
}

export function siteBaseUrl(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

/** Shared with `roster.ts`, the front door's half of this module. */
export async function fetchJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new DataError(`Could not reach ${url}: ${String(cause)}`);
  }
  if (!response.ok) {
    throw new DataError(`Could not read ${url}: ${response.status} ${response.statusText}`);
  }
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    throw new DataError(`Malformed JSON at ${url}: ${String(cause)}`);
  }
}

export async function fetchShow(): Promise<Show> {
  return normalizeShow(await fetchJson(joinBase(siteBaseUrl(), SHOW_URL)));
}

/**
 * The show's entity registry (007, FR-600), or `null` when the show declares no
 * `registryUrl` - that is not a failure, it is a show without a registry, and
 * every piece of NPC chrome stays hidden. A declared file that cannot be read or
 * parsed *is* a failure and throws `DataError`.
 */
export async function fetchRegistry(show: Show): Promise<Registry | null> {
  const url = show.registryUrl;
  if (url === undefined || url === '') return null;
  return normalizeRegistry(await fetchJson(joinBase(siteBaseUrl(), url)));
}

/**
 * The show's spell registry (008 revision 4), or `null` when the show declares
 * no `spellsUrl`. Same contract as `fetchRegistry`: a show without one is not a
 * failure, a declared file that cannot be read is.
 */
export async function fetchSpells(show: Show): Promise<SpellRegistry | null> {
  const url = show.spellsUrl;
  if (url === undefined || url === '') return null;
  return validateSpells(await fetchJson(joinBase(siteBaseUrl(), url)));
}

export async function fetchEpisode(meta: EpisodeMeta): Promise<EpisodeData> {
  const episode = normalizeEpisode(await fetchJson(joinBase(siteBaseUrl(), meta.dataUrl)));
  if (episode.episodeId !== meta.id) {
    throw new DataError(
      `Episode data at ${meta.dataUrl} reports episodeId ${episode.episodeId}, expected ${meta.id}.`,
    );
  }
  return episode;
}

/* ------------------------------------------------- front door (011) */

/**
 * The `<script id="__DCC__" type="application/json">` a prerendered page
 * carries, or `null` on a page that has none (the hub, `npm run dev`, the
 * 404 shell). Never throws: a malformed blob is the same as no blob.
 */
export function readEmbedded(): Embedded | null {
  if (typeof document === 'undefined') return null;
  const text = document.getElementById(EMBEDDED_ID)?.textContent;
  if (text === null || text === undefined || text.trim() === '') return null;
  let record: Record<string, unknown>;
  try {
    // Anything that is not an object with a route is not ours - an array and a
    // string both fail the route test - so the providers fetch instead. Silently:
    // the page still works, and this runs before anything can listen.
    record = JSON.parse(text) as Record<string, unknown>;
    if (record === null || typeof record.route !== 'string') return null;
  } catch {
    return null;
  }
  /*
   * `show`, `crawlers` and `status` are handed on unread. Every consumer runs
   * them through the same validator a fetched file gets - `normalizeShow` in
   * `ShowContext`, `validateCrawlers` and `validateStatus` in
   * `CrawlersContext` - so validating here as well would only put the roster
   * validators in the viewer's entry chunk, which no hub page ever needs.
   */
  return {
    route: record.route,
    show: record.show,
    crawlers: record.crawlers,
    status: (record.status ?? null) as Embedded['status'],
  };
}

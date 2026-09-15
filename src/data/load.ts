/**
 * Static JSON loading. No server, no cache layer: two fetches per episode page
 * (constitution IV). `dataUrl` values keep the leading slash the handoff schema
 * shows and are resolved against the deploy base at fetch time (research R3).
 */
import type { EpisodeData, EpisodeMeta, Show } from './types';
import { DataError, normalizeEpisode, normalizeShow } from './validate';

const SHOW_URL = '/data/show.json';

/** `joinBase('/dcc-watch-hub/', '/data/ep1.json') === '/dcc-watch-hub/data/ep1.json'`. */
export function joinBase(base: string, url: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  if (!url.startsWith('/')) return url;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  if (normalizedBase === '' || normalizedBase === '.') return url;
  return `${normalizedBase}${url}`;
}

function baseUrl(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

async function fetchJson(url: string): Promise<unknown> {
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
  return normalizeShow(await fetchJson(joinBase(baseUrl(), SHOW_URL)));
}

export async function fetchEpisode(meta: EpisodeMeta): Promise<EpisodeData> {
  const episode = normalizeEpisode(await fetchJson(joinBase(baseUrl(), meta.dataUrl)));
  if (episode.episodeId !== meta.id) {
    throw new DataError(
      `Episode data at ${meta.dataUrl} reports episodeId ${episode.episodeId}, expected ${meta.id}.`,
    );
  }
  return episode;
}

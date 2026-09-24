/**
 * Reading a *published* episode back into the Studio (010, FR-1010 / FR-1011).
 *
 * `src/data/load.ts` normalizes everything it fetches, which is right for the
 * viewer and wrong here: the author may want to edit a file this build would
 * reject, and `partyFromInitial` / `partyFromFinalState` both want the raw
 * envelope. So this fetches the same URL through the same base-path rule and
 * hands back exactly what the file says.
 *
 * React-free; the only I/O in `src/studio/**`, and it only ever reads.
 */
import type { EpisodeMeta } from '../data/types';
import { joinBase } from '../data/load';

function baseUrl(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

/** The raw JSON at `meta.dataUrl`. Throws with a readable message on failure. */
export async function fetchRawEpisode(meta: Pick<EpisodeMeta, 'dataUrl'>): Promise<unknown> {
  const url = joinBase(baseUrl(), meta.dataUrl);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(`Could not reach ${url}: ${String(cause)}`);
  }
  if (!response.ok) {
    throw new Error(`Could not read ${url}: ${response.status} ${response.statusText}`);
  }
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    throw new Error(`Malformed JSON at ${url}: ${String(cause)}`);
  }
}

export default fetchRawEpisode;

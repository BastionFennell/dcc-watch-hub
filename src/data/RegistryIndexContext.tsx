/**
 * The cross-episode registry index, loaded once per visit (007 R3, R3-FR-644).
 *
 * The index is what `/registry` and the episode page's Registry panel both
 * read, and building it costs every published episode file. Doing that on the
 * episode page the moment it mounts would spend the viewer's bandwidth on a
 * glossary they may never open, so nothing happens until someone calls
 * `load()` — the page on mount, the panel when it first opens. After that the
 * result is cached for the visit: a second `load()` is a no-op, and switching
 * between the page and the panel re-uses the same fetches.
 *
 * Like `ShowContext.tsx` and `RegistryContext.tsx`, this is a React seam in
 * `src/data`: the `.tsx` files bind, the `.ts` files stay framework-free.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EpisodeData } from './types';
import { fetchEpisode } from './load';
import { orderedEpisodes } from './show';
import type { RegistryIndexResult } from '../engine/registry';
import { registryIndex } from '../engine/registry';
import { useShow } from './ShowContext';
import { useRegistry } from './RegistryContext';

export interface RegistryIndexContextValue {
  /** `null` until `load()` has been called and every file has settled. */
  index: RegistryIndexResult | null;
  /** True between the first `load()` and the index landing. */
  loading: boolean;
  error: Error | null;
  /** Idempotent: the first call starts the fetches, later calls do nothing. */
  load(): void;
}

const RegistryIndexContext = createContext<RegistryIndexContextValue>({
  index: null,
  loading: false,
  error: null,
  load: () => {},
});

export function RegistryIndexProvider({ children }: { children: ReactNode }) {
  const { show } = useShow();
  const { registry, loading: registryLoading, error: registryError } = useRegistry();
  const [requested, setRequested] = useState(false);
  const [episodes, setEpisodes] = useState<ReadonlyMap<number, EpisodeData | null> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  /** The idempotence guard: the fetches start exactly once per visit. */
  const started = useRef(false);

  const load = useCallback(() => setRequested(true), []);

  /*
   * Every published episode at once. A rejected fetch lands as `null` rather
   * than taking the index down with it — `registryIndex` files that episode
   * under `missingEpisodes` and indexes the rest (US2 scenario 6).
   *
   * Deliberately without a cleanup flag: under StrictMode the effect runs,
   * unmounts and runs again, and the second run is refused by the ref guard, so
   * discarding the first run's result would leave the index empty forever.
   */
  useEffect(() => {
    if (!requested || show === null || started.current) return;
    started.current = true;
    const metas = orderedEpisodes(show);
    void Promise.allSettled(metas.map((meta) => fetchEpisode(meta)))
      .then((results) => {
        const next = new Map<number, EpisodeData | null>();
        results.forEach((result, position) => {
          const meta = metas[position];
          if (meta === undefined) return;
          next.set(meta.id, result.status === 'fulfilled' ? result.value : null);
        });
        setEpisodes(next);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      });
  }, [requested, show]);

  /*
   * Recomputed from whatever has landed, so a registry that arrives *after* the
   * episode files (the panel opening on a cold page) simply produces the index
   * on the next render rather than needing its own effect.
   */
  const index =
    show !== null && episodes !== null && !registryLoading
      ? registryIndex(show, registry, episodes)
      : null;

  return (
    <RegistryIndexContext.Provider
      value={{
        index,
        loading: requested && index === null && error === null,
        error: error ?? registryError,
        load,
      }}
    >
      {children}
    </RegistryIndexContext.Provider>
  );
}

export function useRegistryIndex(): RegistryIndexContextValue {
  return useContext(RegistryIndexContext);
}

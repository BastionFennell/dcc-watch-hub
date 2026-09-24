/**
 * The one React binding in `src/data`: everything else here is framework-free
 * TypeScript the authoring script can import. This file exists at the path
 * tasks.md T018 specifies; the ESLint `no-restricted-imports` guard covers the
 * pure `src/data/**\/*.ts` modules.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Embedded, Show } from './types';
import { fetchShow, readEmbedded } from './load';
import { normalizeShow } from './validate';

/**
 * 011: a prerendered page carries the show in its `__DCC__` script, so the
 * first paint needs no fetch and hydration cannot disagree with the server.
 * The blob goes through the same validator a fetched file does - embedded data
 * is not more trusted - and a bad one simply falls back to fetching.
 */
function seedShow(embedded: Embedded | null): Show | null {
  if (embedded === null || embedded.show === undefined || embedded.show === null) return null;
  try {
    return normalizeShow(embedded.show);
  } catch (cause) {
    console.warn(`Show: ignoring embedded data (${String(cause)}).`);
    return null;
  }
}

export interface ShowContextValue {
  show: Show | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

const ShowContext = createContext<ShowContextValue>({
  show: null,
  error: null,
  loading: true,
  reload: () => {},
});

export interface ShowProviderProps {
  children: ReactNode;
  /**
   * The payload to seed from. The browser reads it off the page itself; the
   * server has no DOM to read, so `entry-server` passes it in (011).
   */
  embedded?: Embedded | null;
}

export function ShowProvider({ children, embedded }: ShowProviderProps) {
  // Read once, at mount: the DOM node never changes under us.
  const [seeded] = useState<Show | null>(() =>
    seedShow(embedded === undefined ? readEmbedded() : embedded),
  );
  const [show, setShow] = useState<Show | null>(seeded);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(seeded === null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    // Seeded and never asked to reload: the page already has its show.
    if (seeded !== null && attempt === 0) return;
    let live = true;
    setLoading(true);
    setError(null);
    fetchShow()
      .then((next) => {
        if (!live) return;
        setShow(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt, seeded]);

  return (
    <ShowContext.Provider value={{ show, error, loading, reload }}>{children}</ShowContext.Provider>
  );
}

export function useShow(): ShowContextValue {
  return useContext(ShowContext);
}

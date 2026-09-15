/**
 * The one React binding in `src/data`: everything else here is framework-free
 * TypeScript the authoring script can import. This file exists at the path
 * tasks.md T018 specifies; the ESLint `no-restricted-imports` guard covers the
 * pure `src/data/**\/*.ts` modules.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Show } from './types';
import { fetchShow } from './load';

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

export function ShowProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState<Show | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
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
  }, [attempt]);

  return (
    <ShowContext.Provider value={{ show, error, loading, reload }}>{children}</ShowContext.Provider>
  );
}

export function useShow(): ShowContextValue {
  return useContext(ShowContext);
}

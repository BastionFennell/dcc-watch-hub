/**
 * The show's entity registry, loaded once beside the show (research R1) so the
 * episode page and the registry page read the same copy.
 *
 * The second React binding in `src/data`, for the same reason `ShowContext.tsx`
 * is the first: the ESLint `no-restricted-imports` guard covers the pure
 * `src/data/**\/*.ts` modules, and these two `.tsx` files are the seam.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Registry, SpellRegistry } from './types';
import { fetchRegistry, fetchSpells } from './load';
import { useShow } from './ShowContext';

export interface RegistryContextValue {
  /** `null` until it lands, and for a show that declares no `registryUrl`. */
  registry: Registry | null;
  /**
   * The book's spells (008 revision 4). It rides along with the entity registry
   * because it is the same kind of thing - one show-level file, fetched once,
   * read by every episode - and a second provider would only duplicate this one.
   * `null` until it lands, for a show with no `spellsUrl`, and for a file that
   * failed: a sheet entry then falls back to whatever it says itself.
   */
  spells: SpellRegistry | null;
  error: Error | null;
  loading: boolean;
}

const RegistryContext = createContext<RegistryContextValue>({
  registry: null,
  spells: null,
  error: null,
  loading: true,
});

/**
 * Waits for the show (the registry's URL lives on it), then fetches once. A
 * registry that fails to load costs the NPC chrome and nothing else: `registry`
 * stays `null` and the page renders as if the show had no registry at all
 * (spec edge case, constitution IV).
 */
export function RegistryProvider({ children }: { children: ReactNode }) {
  const { show, loading: showLoading } = useShow();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [spells, setSpells] = useState<SpellRegistry | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (show === null) return;
    let live = true;
    setLoading(true);
    setError(null);
    /*
     * The spell registry is loaded beside the entity registry but never blocks
     * it: a missing or malformed spells.json costs the book's text on a few
     * tooltips, so it is warned about and swallowed rather than surfaced as the
     * page's error (spec R4: "degrades to an empty registry, never a blank page").
     */
    fetchSpells(show)
      .then((next) => {
        if (live) setSpells(next);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setSpells(null);
        console.warn(`Spells: could not load the spell registry (${String(cause)}).`);
      });

    fetchRegistry(show)
      .then((next) => {
        if (!live) return;
        setRegistry(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setRegistry(null);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [show]);

  return (
    <RegistryContext.Provider
      value={{ registry, spells, error, loading: loading && (showLoading || show !== null) }}
    >
      {children}
    </RegistryContext.Provider>
  );
}

export function useRegistry(): RegistryContextValue {
  return useContext(RegistryContext);
}

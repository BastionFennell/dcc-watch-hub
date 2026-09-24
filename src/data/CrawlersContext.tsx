/**
 * The front door's roster (011): the authored `crawlers.json` and the
 * build-time `status.json`, loaded once for every marketing page.
 *
 * The third React binding in `src/data`, on the same terms as the other two:
 * the ESLint `no-restricted-imports` guard covers the pure `src/data/**\/*.ts`
 * modules, and these `.tsx` files are the seam.
 *
 * A prerendered page carries both files in its `__DCC__` script, so the first
 * paint fetches nothing and hydration cannot disagree with the server. On a hub
 * page, in `npm run dev`, or after a client-side navigation into a marketing
 * route, the provider fetches instead.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { CrawlerProfile, Embedded, StatusFile } from './types';
import { fetchCrawlers, fetchStatus, readEmbedded } from './load';
import { validateCrawlers, validateStatus } from './validate';

export interface CrawlersContextValue {
  /** Empty until the roster lands, and for a deploy that ships none. */
  profiles: CrawlerProfile[];
  /**
   * The live line's numbers, or `null` when no build has generated them (dev,
   * or a show with no published episode yet). Never fatal: no file, no line.
   */
  status: StatusFile | null;
  loading: boolean;
  /** Set only when the roster itself could not be read. */
  error: Error | null;
}

const CrawlersContext = createContext<CrawlersContextValue>({
  profiles: [],
  status: null,
  loading: true,
  error: null,
});

interface Seed {
  profiles: CrawlerProfile[];
  status: StatusFile | null;
}

/** The embedded roster, or `null` when this page carries none. */
function seedCrawlers(embedded: Embedded | null): Seed | null {
  if (embedded === null || embedded.crawlers === undefined || embedded.crawlers === null) {
    return null;
  }
  /*
   * Embedded data gets exactly the treatment a fetched file gets: `readEmbedded`
   * hands the blobs over unread, and both validators run here. Neither throws -
   * an empty roster is a legal (if sad) answer, and so is a missing status.
   */
  return {
    profiles: validateCrawlers(embedded.crawlers).crawlers,
    status: embedded.status === null ? null : validateStatus(embedded.status),
  };
}

export interface CrawlersProviderProps {
  children: ReactNode;
  /** As `ShowProvider`: the browser reads the page, the server is told. */
  embedded?: Embedded | null;
}

export function CrawlersProvider({ children, embedded }: CrawlersProviderProps) {
  // Read once, at mount: the DOM node never changes under us.
  const [seeded] = useState<Seed | null>(() =>
    seedCrawlers(embedded === undefined ? readEmbedded() : embedded),
  );
  const [profiles, setProfiles] = useState<CrawlerProfile[]>(seeded?.profiles ?? []);
  const [status, setStatus] = useState<StatusFile | null>(seeded?.status ?? null);
  const [loading, setLoading] = useState(seeded === null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (seeded !== null) return;
    let live = true;
    setLoading(true);
    setError(null);

    /*
     * The status file is generated into `dist/` at build time, so it is simply
     * absent in dev: `fetchStatus` answers `null` rather than failing, and the
     * crawler pages render without a live line (011 §5).
     */
    fetchStatus()
      .then((next) => {
        if (live) setStatus(next);
      })
      .catch(() => {
        if (live) setStatus(null);
      });

    fetchCrawlers()
      .then((roster) => {
        if (!live) return;
        setProfiles(roster.crawlers);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setProfiles([]);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [seeded]);

  return (
    <CrawlersContext.Provider value={{ profiles, status, loading, error }}>
      {children}
    </CrawlersContext.Provider>
  );
}

export function useCrawlers(): CrawlersContextValue {
  return useContext(CrawlersContext);
}

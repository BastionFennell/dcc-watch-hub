/**
 * The front door's five pages, one lazy chunk each (011 T1125).
 *
 * Two consumers want the same pages on different terms:
 *
 * - **The browser** must not carry them in the viewer's entry chunk. Somebody
 *   who opens `/ep/3` from a shared link should never download the roster, so
 *   every marketing page is a `React.lazy` behind its route's `<Suspense>`.
 * - **The prerenderer** needs them *synchronously*. `renderToString` gives a
 *   component that suspends its fallback and never comes back, which would
 *   leave every marketing page an empty `<div id="root">` - the exact opposite
 *   of the point of prerendering it.
 *
 * So each page is a two-state wrapper: the lazy component until `preload()`
 * hands the module over, the module itself afterwards. `preload.ts` is who
 * calls that, and nothing in the browser imports `preload.ts` - so a visitor
 * only ever meets the lazy half.
 */
import { lazy } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { HubHeadProps } from '../HubHead';
import type { SiteLayoutProps } from '../SiteLayout';

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;

export interface SitePage<P> {
  (props: P): ReactNode;
  /** Resolves the chunk and switches this page to rendering it directly. */
  preload: () => Promise<void>;
}

function sitePage<P extends object = Record<string, never>>(load: Loader<P>): SitePage<P> {
  const Lazy = lazy(load);
  let Loaded: ComponentType<P> | null = null;

  function Page(props: P) {
    const Ready = Loaded;
    return Ready === null ? <Lazy {...props} /> : <Ready {...props} />;
  }

  Page.preload = async (): Promise<void> => {
    Loaded = (await load()).default;
  };

  return Page;
}

export const SiteLayout = sitePage<SiteLayoutProps>(() => import('../SiteLayout'));
/** Not a page: the hub's own <Seo>, out here for the same chunk reason. */
export const HubHead = sitePage<HubHeadProps>(() => import('../HubHead'));
export const HomePage = sitePage(() => import('./HomePage'));
export const WatchPage = sitePage(() => import('./WatchPage'));
export const CrawlersPage = sitePage(() => import('./CrawlersPage'));
export const CrawlerPage = sitePage(() => import('./CrawlerPage'));
export const CommunityPage = sitePage(() => import('./CommunityPage'));
/** Never prerendered, so never preloaded: only a headless browser opens it. */
export const OgRoutes = sitePage(() => import('./og/OgRoutes'));

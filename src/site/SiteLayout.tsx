/**
 * The front door's own layout route (011 T1125): everything the marketing
 * pages need and the hub does not.
 *
 * Today that is the roster - `crawlers.json` and the build's `status.json`.
 * It lives here rather than beside `ShowProvider` in `App` so that a viewer who
 * only ever opens `/ep/3` neither downloads the provider nor fetches the two
 * files: this module is a lazy chunk, loaded with the first marketing page.
 * A click from the hub into `/crawlers` mounts it then, and it stays mounted.
 */
import { Outlet } from 'react-router';
import { CrawlersProvider } from '../data/CrawlersContext';
import type { Embedded } from '../data/types';

export interface SiteLayoutProps {
  /** As everywhere else: the browser reads the page, the server is told. */
  embedded?: Embedded | null;
}

export function SiteLayout({ embedded }: SiteLayoutProps) {
  return (
    <CrawlersProvider embedded={embedded}>
      <Outlet />
    </CrawlersProvider>
  );
}

export default SiteLayout;

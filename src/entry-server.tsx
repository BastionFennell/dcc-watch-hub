/**
 * The prerenderer's half of the app (011). Built separately
 * (`vite build --ssr src/entry-server.tsx --outDir dist/server`) and run by
 * `scripts/prerender.mjs` at build time; not one byte of it reaches a browser.
 *
 * `render()` returns the app's markup and the route's head tags as two strings,
 * because `renderToString` puts hoistable elements (`<title>`, `<meta>`,
 * `<link>`) at the FRONT of the markup rather than in a head of its own. Those
 * leading tags are stripped here and the collector's copy is returned instead,
 * so the prerenderer can put them where they belong.
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App } from './App';
import { CrawlersProvider } from './data/CrawlersContext';
import type { Embedded } from './data/types';
import { HeadCollector, HeadCollectorProvider } from './site/seo';
import { siteCopy } from './site/copy';

/**
 * The head every route starts with, read off the show itself. A page that
 * renders its own `<Seo>` overwrites these values (the collector is keyed, and
 * the last write wins); a page that has not been written yet still ships a
 * title and a description rather than the template's.
 */
function seedHead(collector: HeadCollector, url: string, data: Embedded): void {
  const show = typeof data.show === 'object' && data.show !== null ? (data.show as Record<string, unknown>) : {};
  const title = typeof show.title === 'string' && show.title !== '' ? show.title : siteCopy.defaultTitle;
  const tagline = typeof show.tagline === 'string' ? show.tagline : '';
  const pitch = typeof show.pitch === 'string' && show.pitch !== '' ? show.pitch : '';
  collector.collect({
    title: tagline === '' ? title : `${title} - ${tagline}`,
    description: pitch === '' ? siteCopy.defaultDescription : pitch,
    canonicalPath: url,
  });
}

/**
 * A leading run of the elements React hoists. Deliberately anchored: only the
 * prefix is touched, so a `<meta>` the page renders on purpose further down
 * (there is none today) would survive.
 */
const HOISTED = /^(?:<title>[\s\S]*?<\/title>|<meta\b[^>]*?\/?>|<link\b[^>]*?\/?>)+/;

export function stripHoistedHead(markup: string): string {
  return markup.replace(HOISTED, '');
}

export interface RenderResult {
  /** The app's markup, for `<div id="root">`. */
  html: string;
  /** The route's head tags, one per line, for `<head>`. */
  head: string;
}

export function render(url: string, data: Embedded): RenderResult {
  const collector = new HeadCollector();
  seedHead(collector, url, data);
  /*
   * The roster provider sits outside `<App>` because the app does not mount one
   * yet (Wave B lands the pages that need it). Once it does, the inner provider
   * simply wins and this wrapper becomes a no-op.
   */
  const markup = renderToString(
    <HeadCollectorProvider collector={collector}>
      <StaticRouter location={url}>
        <CrawlersProvider embedded={data}>
          <App embedded={data} />
        </CrawlersProvider>
      </StaticRouter>
    </HeadCollectorProvider>,
  );
  return { html: stripHoistedHead(markup), head: collector.toString() };
}

export default render;

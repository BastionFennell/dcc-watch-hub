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
import type { Embedded } from './data/types';
import { joinBase } from './data/load';
import { HeadCollector, HeadCollectorProvider } from './site/seo';
import { preloadSitePages } from './site/pages/preload';
import { siteCopy } from './site/copy';

/**
 * `renderToString` never retries a component that suspends: it writes the
 * Suspense fallback and moves on. The marketing pages are lazy chunks, so
 * without this the prerenderer would emit an empty `<div id="root">` for every
 * one of them.
 *
 * A top-level await would be tidier, but the SSR bundle is transpiled to the
 * same target the client is. So the promise is started at import and exported:
 * every caller of `render()` awaits this first (see `scripts/prerender.mjs`).
 */
export const ready: Promise<void> = preloadSitePages();

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
   * The deploy base, on both sides of hydration. The browser's router is
   * created with `basename={import.meta.env.BASE_URL}`, so every `<Link>` it
   * renders carries the prefix; without the same basename here a Pages build
   * would prerender `/watch` where the browser expects `/dcc-watch-hub/watch`,
   * and every link in the page would be a hydration mismatch.
   */
  const base = import.meta.env.BASE_URL;
  // `<App>` mounts the roster provider itself now (T1125), seeded from `data`.
  const markup = renderToString(
    <HeadCollectorProvider collector={collector}>
      <StaticRouter basename={base} location={joinBase(base, url)}>
        <App embedded={data} />
      </StaticRouter>
    </HeadCollectorProvider>,
  );
  return { html: stripHoistedHead(markup), head: collector.toString() };
}

export default render;

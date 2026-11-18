/**
 * Static HTML for the marketing routes (011 §7, plan "Prerender mechanics").
 *
 * Reads the client build's `dist/index.html` as a template, renders each route
 * with the SSR bundle, and writes `dist/<route>/index.html`. The data the page
 * was rendered from rides along in a `<script id="__DCC__">` so the browser
 * hydrates without a single fetch.
 *
 *   node scripts/prerender.mjs
 *
 * `dist/404.html` must already be a copy of the ORIGINAL shell before this
 * runs - see `scripts/postbuild.mjs` - because a hub deep link has to boot from
 * an empty page, not from someone else's markup.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The static routes every build prerenders, in sitemap order. */
export const STATIC_ROUTES = ['/', '/watch', '/crawlers', '/cast', '/community'];

/** `/crawlers/mimi` -> `mimi`; anything else -> `null`. */
export function crawlerIdIn(route) {
  const match = /^\/crawlers\/([^/]+)$/.exec(route);
  return match === null ? null : match[1];
}

/** Every route to prerender: the static ones, then one page per crawler. */
export function routesFor(crawlers) {
  const ids = Array.isArray(crawlers?.crawlers)
    ? crawlers.crawlers.map((crawler) => crawler?.id).filter((id) => typeof id === 'string' && id !== '')
    : [];
  return [...STATIC_ROUTES, ...ids.map((id) => `/crawlers/${id}`)];
}

/** The layout chunk every marketing route mounts under. */
const LAYOUT_MODULE = 'src/site/SiteLayout.tsx';

/** Each static route's page module, as the Vite manifest keys it. */
export const PAGE_MODULES = {
  '/': 'src/site/pages/HomePage.tsx',
  '/watch': 'src/site/pages/WatchPage.tsx',
  '/crawlers': 'src/site/pages/CrawlersPage.tsx',
  '/cast': 'src/site/pages/CastPage.tsx',
  '/community': 'src/site/pages/CommunityPage.tsx',
};
const CRAWLER_PAGE_MODULE = 'src/site/pages/CrawlerPage.tsx';

/** The source modules one route is made of: the layout, then its page. */
export function modulesFor(route) {
  const page = PAGE_MODULES[route] ?? (crawlerIdIn(route) === null ? null : CRAWLER_PAGE_MODULE);
  return page === null ? [] : [LAYOUT_MODULE, page];
}

/**
 * The stylesheets and chunks one route needs beyond the entry's own, read off
 * the Vite manifest (`dist/.vite/manifest.json`).
 *
 * The marketing pages are lazy chunks, and a lazy chunk's CSS is only linked
 * when its script runs. Left alone, a prerendered page paints unstyled until
 * hydration - and stays unstyled for a reader with scripts off. Walking the
 * chunk's static imports here lets `injectPage` link all of it in the HTML.
 *
 * Dependencies first, so the page's own rules come last, as they do when Vite
 * loads the chunk itself. The entry is skipped: the template already links it.
 * No manifest, or a module it does not know, is no extra assets - the page
 * then behaves as it did before this existed.
 */
export function assetsFor(manifest, route) {
  const styles = [];
  const scripts = [];
  if (manifest === null || typeof manifest !== 'object') return { styles, scripts };
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (chunk === undefined || chunk.isEntry === true) return;
    for (const dependency of chunk.imports ?? []) visit(dependency);
    for (const css of chunk.css ?? []) if (!styles.includes(css)) styles.push(css);
    if (typeof chunk.file === 'string' && chunk.file.endsWith('.js')) scripts.push(chunk.file);
  };
  for (const module of modulesFor(route)) visit(module);
  return { styles, scripts };
}

/**
 * The deploy base, read off the template's own entry stylesheet, so the links
 * `injectPage` adds are spelled exactly as Vite spells its own - which is also
 * what lets Vite's chunk loader recognise them and not link the CSS twice.
 */
export function assetPrefix(template) {
  const match = /<link\b[^>]*href="([^"]*)assets\/[^"]+\.css"/i.exec(template);
  return match === null ? '/' : match[1];
}

/**
 * The payload, as a `<script>` element. Only `<` has to go: that is what makes
 * `</script>` and `<!--` dangerous, and a JSON reader puts it straight back.
 */
export function embedScript(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script id="__DCC__" type="application/json">${json}</script>`;
}

/**
 * One page: the template with this route's head, markup and payload in it.
 * Pure, so the interesting half of this script is testable without a build.
 */
export function injectPage(template, { head, html, data, assets }) {
  let page = template;

  /*
   * The route's own stylesheets, and a preload for each of its chunks, at the
   * end of the head: after the entry's stylesheet, as they would land if the
   * chunk linked them itself (see `assetsFor`).
   */
  const prefix = assetPrefix(template);
  const links = [
    ...(assets?.styles ?? []).map(
      (file) => `<link rel="stylesheet" crossorigin href="${prefix}${file}">`,
    ),
    ...(assets?.scripts ?? []).map(
      (file) => `<link rel="modulepreload" crossorigin href="${prefix}${file}">`,
    ),
  ];
  if (links.length > 0) {
    page = page.replace('</head>', () => `${links.map((link) => `  ${link}\n`).join('')}  </head>`);
  }

  /*
   * The template's own title and description are the shell's placeholders (they
   * carry `data-dcc-shell`); a prerendered route replaces them with its own
   * head outright, so the page never carries two of either. Both patterns
   * tolerate attributes, because that is exactly what the markers are.
   */
  page = page.replace(/[ \t]*<meta\b[^>]*name="description"[^>]*>\n?/i, '');
  if (head !== '') {
    page = page.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => head);
  }

  page = page.replace('<div id="root"></div>', () => `<div id="root">${html}</div>`);
  page = page.replace('</body>', () => `  ${embedScript(data)}\n  </body>`);
  return page;
}

/** `/` -> `dist/index.html`, `/watch` -> `dist/watch/index.html`. */
export function outputPath(distDir, route) {
  return route === '/' ? resolve(distDir, 'index.html') : resolve(distDir, `.${route}/index.html`);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (cause) {
    if (fallback === undefined) throw cause;
    return fallback;
  }
}

async function main() {
  const dist = resolve(root, 'dist');
  const entry = resolve(dist, 'server/entry-server.js');
  const { render, ready } = await import(pathToFileURL(entry).href);
  // The marketing pages are lazy chunks; `ready` is the bundle having them all
  // in hand, without which `render` would emit Suspense fallbacks.
  await ready;

  const template = await readFile(resolve(dist, 'index.html'), 'utf8');
  const show = await readJson(resolve(root, 'public/data/show.json'));
  const crawlers = await readJson(resolve(root, 'public/data/crawlers.json'), { crawlers: [] });
  // Generated a step earlier; `null` is legal (no episode is published yet).
  const status = await readJson(resolve(dist, 'data/status.json'), null);
  /*
   * 014: the cast rides on every route, whole - the cast page needs all of it
   * and each crawler page its player's credit, and at about 2.5 kB splitting
   * it per route is not worth a second code path. No file is an empty cast.
   */
  const cast = await readJson(resolve(root, 'public/data/cast.json'), { cast: [] });
  // Written by the client build (`build.manifest`); without it the pages are
  // still correct, only styled a moment later.
  const manifest = await readJson(resolve(dist, '.vite/manifest.json'), null);
  if (manifest === null) console.warn('prerender: no Vite manifest; page stylesheets are not linked.');

  const routes = routesFor(crawlers);
  for (const route of routes) {
    /*
     * 012: a crawler page carries its own dossier and nobody else's, so the
     * locked rows prerender at the right count and the client fetches nothing.
     * Written by `scripts/build-dossier.ts` during `prebuild`, before Vite
     * copied `public/` into `dist/`; `null` is legal (no build step ran), and
     * the panel falls back to fetching.
     */
    const id = crawlerIdIn(route);
    const dossier =
      id === null ? null : await readJson(resolve(root, `public/data/dossier/${id}.json`), null);
    const data = { route, show, crawlers, status, dossier, cast };
    const { html, head } = render(route, data);
    const page = injectPage(template, { head, html, data, assets: assetsFor(manifest, route) });
    const out = outputPath(dist, route);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, page);
  }
  console.log(`prerender: wrote ${routes.length} page(s): ${routes.join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}

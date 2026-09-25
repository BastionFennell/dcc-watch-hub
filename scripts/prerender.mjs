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
export const STATIC_ROUTES = ['/', '/watch', '/crawlers', '/community'];

/** Every route to prerender: the static ones, then one page per crawler. */
export function routesFor(crawlers) {
  const ids = Array.isArray(crawlers?.crawlers)
    ? crawlers.crawlers.map((crawler) => crawler?.id).filter((id) => typeof id === 'string' && id !== '')
    : [];
  return [...STATIC_ROUTES, ...ids.map((id) => `/crawlers/${id}`)];
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
export function injectPage(template, { head, html, data }) {
  let page = template;

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

  const routes = routesFor(crawlers);
  for (const route of routes) {
    const data = { route, show, crawlers, status };
    const { html, head } = render(route, data);
    const page = injectPage(template, { head, html, data });
    const out = outputPath(dist, route);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, page);
  }
  console.log(`prerender: wrote ${routes.length} page(s): ${routes.join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}

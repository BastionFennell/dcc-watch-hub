/**
 * `sitemap.xml` and `robots.txt` for the marketing routes (011 §7).
 *
 *   node scripts/sitemap.mjs
 *
 * The route list is the prerenderer's, so the two can never drift: whatever has
 * real HTML is what search engines are pointed at. Hub routes are not listed -
 * they are client-rendered and carry no indexable content of their own.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { routesFor } from './prerender.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_SITE_URL = 'https://dungeoncrawlcast.com';

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * The canonical prefix every route hangs off: the site URL plus the deploy
 * base, with no trailing slash.
 */
export function canonicalBase(siteUrl = process.env.VITE_SITE_URL, base = process.env.VITE_BASE) {
  const site = (siteUrl === undefined || siteUrl === '' ? DEFAULT_SITE_URL : siteUrl).replace(
    /\/+$/,
    '',
  );
  const prefix = (base ?? '/').replace(/\/+$/, '');
  return prefix === '' || prefix === '.' ? site : `${site}${prefix.startsWith('/') ? '' : '/'}${prefix}`;
}

/** The sitemap, in the order the routes were given. */
export function buildSitemap(routes, base) {
  const urls = routes
    .map((route) => `${base}${route === '/' ? '/' : route}`)
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** Everything is crawlable; the sitemap is the only pointer worth giving. */
export function buildRobots(base) {
  return `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
}

async function main() {
  const dist = resolve(root, 'dist');
  let crawlers = { crawlers: [] };
  try {
    crawlers = JSON.parse(await readFile(resolve(root, 'public/data/crawlers.json'), 'utf8'));
  } catch {
    console.warn('sitemap: no crawlers.json; listing the static routes only');
  }
  const base = canonicalBase();
  const routes = routesFor(crawlers);
  await writeFile(resolve(dist, 'sitemap.xml'), buildSitemap(routes, base));
  await writeFile(resolve(dist, 'robots.txt'), buildRobots(base));
  console.log(`sitemap: ${routes.length} route(s) under ${base}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}

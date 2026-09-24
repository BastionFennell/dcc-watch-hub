/**
 * OpenGraph images (011 §4, §7): 1200x630 PNGs screenshotted from the app's own
 * `/_og/**` routes, so a share preview is the same object as the card on the
 * page rather than a second design to keep in sync.
 *
 *   node scripts/og.mjs
 *
 * Needs a Chrome that is already on the machine: `puppeteer-core` never
 * downloads a browser. Without one this prints a warning and exits 0 - the
 * build must not depend on a headless browser being present (constitution
 * VIII: "degrades gracefully when the tool is absent").
 *
 * The `/_og/**` routes arrive in Wave B. Until they do, every page renders the
 * app's not-found shell, which has no `[data-og-frame]` element: that is the
 * signal to skip the shot rather than write a picture of an error.
 */
import { access, mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** What Wave B's OG pages must render; its absence means "no frame here". */
const FRAME_SELECTOR = '[data-og-frame]';
const WIDTH = 1200;
const HEIGHT = 630;

/** `CHROME_PATH` first, then the usual places on macOS and Linux. */
export const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
];

export async function findChrome(env = process.env) {
  const candidates = [env.CHROME_PATH, ...CHROME_CANDIDATES].filter(
    (path) => typeof path === 'string' && path !== '',
  );
  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

async function freePort() {
  return new Promise((resolveport, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolveport(port));
    });
  });
}

/** Starts `vite preview` on `dist` and waits for it to answer. */
async function startPreview(port, base) {
  const child = spawn(
    process.execPath,
    [
      resolve(root, 'node_modules/vite/bin/vite.js'),
      'preview',
      // Bound explicitly: "localhost" can resolve to ::1 only, and then the
      // screenshot loop cannot reach the server it just started.
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: root, stdio: 'ignore', env: process.env },
  );
  const origin = `http://127.0.0.1:${port}${base}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('vite preview exited before it was ready');
    try {
      const response = await fetch(origin);
      if (response.ok) return { child, origin };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  child.kill();
  throw new Error('vite preview did not start in time');
}

/** Every image this build wants: the route to shoot and the file to write. */
export function shotList(show, crawlers) {
  const shots = [];
  for (const crawler of crawlers?.crawlers ?? []) {
    if (typeof crawler?.id !== 'string' || crawler.id === '') continue;
    shots.push({ route: `/_og/crawler/${crawler.id}`, file: `crawler-${crawler.id}.png` });
  }
  for (const episode of show?.episodes ?? []) {
    if (typeof episode?.id !== 'number') continue;
    shots.push({ route: `/_og/episode/${episode.id}`, file: `ep${episode.id}.png` });
  }
  return shots;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const chrome = await findChrome();
  if (chrome === null) {
    console.warn(
      'og: no Chrome found (set CHROME_PATH, or install Google Chrome / Chromium) - skipping OG images.',
    );
    return;
  }

  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch (cause) {
    console.warn(`og: puppeteer-core is unavailable (${cause?.message ?? cause}) - skipping OG images.`);
    return;
  }

  const show = await readJson(resolve(root, 'public/data/show.json'), { episodes: [] });
  const crawlers = await readJson(resolve(root, 'public/data/crawlers.json'), { crawlers: [] });
  const shots = shotList(show, crawlers);
  if (shots.length === 0) {
    console.warn('og: nothing to render.');
    return;
  }

  const outDir = resolve(root, 'dist/og');
  await mkdir(outDir, { recursive: true });

  const base = (process.env.VITE_BASE ?? '/').replace(/\/+$/, '') || '';
  const port = await freePort();
  const { child, origin } = await startPreview(port, `${base}/`);

  let browser;
  let written = 0;
  let skipped = 0;
  try {
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

    for (const shot of shots) {
      const url = `${origin.replace(/\/$/, '')}${shot.route}`;
      await page.goto(url, { waitUntil: 'networkidle0' });
      const frame = await page.$(FRAME_SELECTOR);
      if (frame === null) {
        skipped += 1;
        continue;
      }
      await page.screenshot({ path: resolve(outDir, shot.file), type: 'png' });
      written += 1;
    }
  } finally {
    await browser?.close();
    child.kill();
  }

  if (skipped > 0) {
    console.warn(
      `og: ${skipped} route(s) had no ${FRAME_SELECTOR} and were skipped (the /_og pages land in Wave B).`,
    );
  }
  console.log(`og: wrote ${written} image(s) to dist/og`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}

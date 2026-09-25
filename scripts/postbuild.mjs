/**
 * Everything `vite build` cannot do on its own (011, spec "Build pipeline").
 *
 * One step runs *before* all of this and not from here: `npm run prebuild`
 * compiles `content/status/*.json` into `public/data/dossier/`. It has to
 * precede `vite build`, because that is what copies `public/` into `dist/` -
 * a dossier written at this point would never reach the output. Step 3 below
 * reads those same files out of `public/` and embeds them per crawler.
 *
 * Order matters:
 *  1. `dist/404.html` is a copy of the ORIGINAL shell, taken before the
 *     prerenderer overwrites `dist/index.html`. A static host with no rewrite
 *     rules serves it for every deep link (`/ep/3`, `/codex`), and those have to
 *     boot into an empty app rather than into the home page's markup.
 *  2. `status.json` - the live crawler numbers the pages read.
 *  3. prerender - real HTML for the marketing routes, with the data embedded.
 *  4. OG images - needs a system Chrome; skipped with a warning without one.
 *  5. `sitemap.xml` + `robots.txt`, from the prerenderer's own route list.
 *  6. `dist/server` is deleted: it is the SSR bundle, and nothing serves it.
 */
import { access, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const indexHtml = resolve(dist, 'index.html');
const notFoundHtml = resolve(dist, '404.html');
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs');

/**
 * @param optional a step that is allowed to fail without failing the build
 *   (the OG renderer, which depends on a browser this machine may not have).
 */
function run(label, args, { optional = false } = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  const failed = result.status !== 0 || result.error !== undefined;
  if (!failed) return;
  const reason = result.error?.message ?? `exit code ${result.status}`;
  if (optional) {
    console.warn(`postbuild: ${label} failed (${reason}); continuing without it.`);
    return;
  }
  console.error(`postbuild: ${label} failed (${reason}).`);
  process.exit(1);
}

try {
  await access(indexHtml);
} catch {
  console.error(`postbuild: ${indexHtml} not found - did vite build run?`);
  process.exit(1);
}

// 1. The untouched shell, before anything rewrites index.html.
await copyFile(indexHtml, notFoundHtml);
console.log('postbuild: wrote dist/404.html (static-host deep-link fallback)');

// 2-5.
run('build-status', [tsx, resolve(root, 'scripts/build-status.ts')]);
run('prerender', [resolve(root, 'scripts/prerender.mjs')]);
run('og', [resolve(root, 'scripts/og.mjs')], { optional: true });
run('sitemap', [resolve(root, 'scripts/sitemap.mjs')]);

// 6. The SSR bundle is a build tool, not a page.
await rm(resolve(dist, 'server'), { recursive: true, force: true });
console.log('postbuild: removed dist/server');

// GitHub Pages has no rewrite rules: a copy of index.html at 404.html makes
// deep links such as /ep/3 load the app shell. See contracts/routes.md.
import { copyFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = resolve(root, 'dist/index.html');
const notFoundHtml = resolve(root, 'dist/404.html');

try {
  await access(indexHtml);
} catch {
  console.error(`postbuild: ${indexHtml} not found — did vite build run?`);
  process.exit(1);
}

await copyFile(indexHtml, notFoundHtml);
console.log('postbuild: wrote dist/404.html (static-host deep-link fallback)');

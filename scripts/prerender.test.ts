/**
 * The prerenderer's pure half, plus the shell wiring end to end: what the SSR
 * bundle returns has to land in the template where the browser expects it.
 * The script itself (disk, the built bundle) is exercised by the build in Wave C.
 */
import { describe, expect, it } from 'vitest';
import { STATIC_ROUTES, embedScript, injectPage, outputPath, routesFor } from './prerender.mjs';
import { render } from '../src/entry-server';
import { makeCrawlers, makeShow, makeStatus } from '../src/test/fixtures';

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="The System's broadcast feed."
    />
    <title>Dungeon Crawl Cast · System Feed</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>
`;

describe('routesFor', () => {
  it('is the four static routes plus one page per crawler', () => {
    expect(routesFor(makeCrawlers())).toEqual([
      ...STATIC_ROUTES,
      '/crawlers/stuntman',
      '/crawlers/harry',
    ]);
  });

  it('survives a missing or empty roster', () => {
    expect(routesFor(null)).toEqual(STATIC_ROUTES);
    expect(routesFor({ crawlers: [] })).toEqual(STATIC_ROUTES);
    expect(routesFor({ crawlers: [{ name: 'no id' }] })).toEqual(STATIC_ROUTES);
  });
});

describe('embedScript', () => {
  it('escapes anything that could close the script or open a comment', () => {
    const script = embedScript({ route: '/', evil: '</script><!-- <b>' });
    expect(script).not.toContain('</script><!--');
    expect(script).toContain('\\u003c/script>\\u003c!--');
    expect(script.startsWith('<script id="__DCC__" type="application/json">')).toBe(true);
    expect(script.endsWith('</script>')).toBe(true);
  });

  it('round-trips through JSON.parse', () => {
    const data = { route: '/watch', show: makeShow(), status: makeStatus() };
    const inner = embedScript(data).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(inner)).toEqual(data);
  });
});

describe('outputPath', () => {
  it('maps the root to dist/index.html and everything else to a directory', () => {
    expect(outputPath('/d', '/')).toBe('/d/index.html');
    expect(outputPath('/d', '/watch')).toBe('/d/watch/index.html');
    expect(outputPath('/d', '/crawlers/harry')).toBe('/d/crawlers/harry/index.html');
  });
});

describe('injectPage', () => {
  const data = { route: '/watch', show: makeShow(), crawlers: makeCrawlers(), status: null };

  it('puts the route head where the template title was, and drops the old description', () => {
    const page = injectPage(TEMPLATE, {
      head: '<title>New</title>\n<meta name="description" content="Fresh" />',
      html: '<p>hi</p>',
      data,
    });
    expect(page).toContain('<title>New</title>');
    expect(page).not.toContain('Dungeon Crawl Cast · System Feed');
    expect(page).toContain('<meta name="description" content="Fresh" />');
    expect(page).not.toContain("The System's broadcast feed.");
    expect(page.match(/<meta name="description"/g)).toHaveLength(1);
  });

  it('injects the markup into #root and the payload before </body>', () => {
    const page = injectPage(TEMPLATE, { head: '<title>T</title>', html: '<p>hi</p>', data });
    expect(page).toContain('<div id="root"><p>hi</p></div>');
    expect(page).toContain('<script id="__DCC__" type="application/json">');
    expect(page.indexOf('__DCC__')).toBeLessThan(page.indexOf('</body>'));
    // The client bundle is still the last word.
    expect(page).toContain('<script type="module" src="/assets/index-abc.js"></script>');
  });

  it('keeps the template title when the route produced no head', () => {
    const page = injectPage(TEMPLATE, { head: '', html: '<p>hi</p>', data });
    expect(page).toContain('<title>Dungeon Crawl Cast · System Feed</title>');
  });

  it('never lets a "$&" in the markup corrupt the page', () => {
    const page = injectPage(TEMPLATE, { head: '<title>$&</title>', html: '<p>$& $1</p>', data });
    expect(page).toContain('<p>$& $1</p>');
    expect(page).toContain('<title>$&</title>');
  });
});

/* ------------------------------------------------- the shell, end to end */

describe('a prerendered page', () => {
  it('carries the rendered route, its head and its payload', () => {
    const route = '/nope';
    const data = { route, show: makeShow(), crawlers: makeCrawlers(), status: makeStatus() };
    const { html, head } = render(route, data);
    const page = injectPage(TEMPLATE, { head, html, data });

    expect(page).toContain('<title>Dungeon Crawl Cast - Heart and chaos in the World Dungeon.</title>');
    expect(page).toContain('No such recap episode exists in the archive.');
    expect(page).toContain('<div id="root"><div class=');
    const payload = page
      .split('<script id="__DCC__" type="application/json">')[1]
      .split('</script>')[0];
    expect(JSON.parse(payload).route).toBe(route);
    // The head tags live in <head>, not inside #root.
    const rootAt = page.indexOf('<div id="root">');
    expect(page.indexOf('<link rel="canonical"')).toBeLessThan(rootAt);
    expect(page.slice(rootAt).includes('<title>')).toBe(false);
  });
});

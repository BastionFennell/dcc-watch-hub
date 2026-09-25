/**
 * The prerenderer's pure half, plus the shell wiring end to end: what the SSR
 * bundle returns has to land in the template where the browser expects it.
 * The script itself (disk, the built bundle) is exercised by the build in Wave C.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  STATIC_ROUTES,
  crawlerIdIn,
  embedScript,
  injectPage,
  outputPath,
  routesFor,
} from './prerender.mjs';
import { ready, render } from '../src/entry-server';
import { makeCrawlers, makeDossier, makeShow, makeStatus } from '../src/test/fixtures';

/** Every collected tag carries the marker the browser strips at boot. */
const M = ' data-dcc-head';

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      data-dcc-shell
      name="description"
      content="The System's broadcast feed."
    />
    <title data-dcc-shell>Dungeon Crawl Cast · System Feed</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>
`;

beforeAll(async () => {
  await ready;
});

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

describe('crawlerIdIn', () => {
  it('names the crawler a route is about, and nothing else (012)', () => {
    expect(crawlerIdIn('/crawlers/harry')).toBe('harry');
    expect(crawlerIdIn('/crawlers')).toBeNull();
    expect(crawlerIdIn('/crawlers/harry/extra')).toBeNull();
    expect(crawlerIdIn('/watch')).toBeNull();
    expect(crawlerIdIn('/')).toBeNull();
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
    expect(page).toContain('<title data-dcc-shell>Dungeon Crawl Cast · System Feed</title>');
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
    const route = '/community';
    const data = { route, show: makeShow(), crawlers: makeCrawlers(), status: makeStatus() };
    const { html, head } = render(route, data);
    const page = injectPage(TEMPLATE, { head, html, data });

    expect(page).toContain(`<title${M}>Community · Dungeon Crawl Cast</title>`);
    expect(page).toContain('Keep up with the crawl');
    expect(page).toContain('<div id="root"><div class=');
    const payload = page
      .split('<script id="__DCC__" type="application/json">')[1]
      .split('</script>')[0];
    expect(JSON.parse(payload).route).toBe(route);
    // The head tags live in <head>, not inside #root.
    const rootAt = page.indexOf('<div id="root">');
    expect(page.indexOf(`<link${M} rel="canonical"`)).toBeLessThan(rootAt);
    expect(page.slice(rootAt).includes('<title>')).toBe(false);
  });
});

/* ------------------------------------------------- the dossier, prerendered */

/**
 * 012 T1220. The panel ships in the server's HTML, fully locked, and the whole
 * feature rests on that HTML being the same document for every crawler: a
 * reader who opens view-source must learn exactly what a reader who opens the
 * page learns, which is nothing until they click.
 */
describe('the crawler dossier in a prerendered page', () => {
  /** The markup from the panel's `<section>` up to the prev/next bar. */
  function panelOf(html: string): string {
    const at = html.indexOf('aria-labelledby="dossier-');
    expect(at).toBeGreaterThan(-1);
    const start = html.lastIndexOf('<section', at);
    return html.slice(start, html.indexOf('<nav ', start));
  }

  function pageFor(id: string) {
    const roster = makeCrawlers();
    // One pronoun between them: the heading is a fact about the crawler, like
    // their name, and the snapshot is about everything else.
    for (const crawler of roster.crawlers) crawler.pronouns = 'he/him';
    const profile = roster.crawlers.find((crawler) => crawler.id === id);
    const route = `/crawlers/${id}`;
    const { html } = render(route, {
      route,
      show: makeShow(),
      crawlers: roster,
      status: makeStatus(),
      dossier: makeDossier(id),
    });
    return { html, profile: profile as NonNullable<typeof profile> };
  }

  it('renders one locked row per aired episode and no card text at all', () => {
    const { html } = pageFor('harry');
    const panel = panelOf(html);
    expect(panel.match(/aria-label="Reveal the Episode \d+ status update"/g)).toHaveLength(3);
    expect(panel).toContain('3 updates hidden');
    for (const card of makeDossier('harry').updates) {
      expect(panel).not.toContain(card.title);
      expect(panel).not.toContain(card.body);
    }
    expect(panel).not.toMatch(/deceased|death|final|killed|memorial/i);
  });

  it('is the same markup for two crawlers once the name and the id are swapped', () => {
    const a = pageFor('harry');
    const b = pageFor('stuntman');
    const swapped = panelOf(b.html)
      .split(b.profile.characterName.toUpperCase())
      .join(a.profile.characterName.toUpperCase())
      .split(b.profile.id)
      .join(a.profile.id);
    expect(swapped).toBe(panelOf(a.html));
  });
});

/**
 * The prerenderer's pure half, plus the shell wiring end to end: what the SSR
 * bundle returns has to land in the template where the browser expects it.
 * The script itself (disk, the built bundle) is exercised by the build in Wave C.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PAGE_MODULES,
  assetPrefix,
  assetsFor,
  modulesFor,
  STATIC_ROUTES,
  crawlerIdIn,
  embedScript,
  injectPage,
  outputPath,
  routesFor,
} from './prerender.mjs';
import { ready, render } from '../src/entry-server';
import { makeCast, makeCrawlers, makeDossier, makeShow, makeStatus } from '../src/test/fixtures';

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
  it('is the five static routes plus one page per crawler', () => {
    // 014: /cast sits between the roster and /community, in nav order.
    expect(STATIC_ROUTES).toEqual(['/', '/watch', '/crawlers', '/cast', '/community']);
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

/* ------------------------------------------------- the cast, prerendered (014) */

describe('the cast in a prerendered page', () => {
  function crawlerPage(cast: unknown) {
    const route = '/crawlers/stuntman';
    const data = {
      route,
      show: makeShow(),
      crawlers: makeCrawlers(),
      status: makeStatus(),
      dossier: makeDossier('stuntman'),
      ...(cast === undefined ? {} : { cast }),
    };
    return injectPage(TEMPLATE, { ...render(route, data), data });
  }

  it('credits the player in the server HTML and carries the cast in the payload', () => {
    const page = crawlerPage(makeCast());
    expect(page).toMatch(/Played by\s*(<!-- -->)?\s*<\/span><a[^>]*href="\/cast#danny"[^>]*>Danny</);
    // 014 T1420: the headshot is in the server's HTML too, sized before it loads.
    expect(page).toMatch(/<img[^>]*src="\/img\/cast\/danny-sm\.webp"[^>]*width="40"/);
    const payload = page
      .split('<script id="__DCC__" type="application/json">')[1]
      .split('</script>')[0];
    expect(JSON.parse(payload).cast).toEqual(makeCast());
  });

  it('renders no credit at all when the payload carries no cast', () => {
    expect(crawlerPage({ cast: [] })).not.toContain('Played by');
    expect(crawlerPage(undefined)).not.toContain('Played by');
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

/* ------------------------------------------------ route assets (014 fix) */

/** The shape Vite writes: a page chunk, a shared chunk with CSS, the entry. */
const MANIFEST = {
  'index.html': { file: 'assets/index-abc.js', css: ['assets/index-abc.css'], isEntry: true },
  'src/site/SiteLayout.tsx': { file: 'assets/SiteLayout-1.js', imports: ['index.html', '_ctx.js'] },
  '_ctx.js': { file: 'assets/ctx-1.js', imports: ['index.html'] },
  '_page.module.js': { file: 'assets/page.module-1.js', css: ['assets/page-1.css'] },
  'src/site/pages/CastPage.tsx': {
    file: 'assets/CastPage-1.js',
    css: ['assets/CastPage-1.css'],
    imports: ['index.html', '_ctx.js', '_page.module.js'],
  },
  'src/site/pages/CrawlerPage.tsx': {
    file: 'assets/CrawlerPage-1.js',
    css: ['assets/CrawlerPage-1.css'],
    imports: ['_page.module.js'],
  },
};

describe('assetsFor', () => {
  it("collects a route's stylesheets and chunks, dependencies first, without the entry", () => {
    expect(assetsFor(MANIFEST, '/cast')).toEqual({
      styles: ['assets/page-1.css', 'assets/CastPage-1.css'],
      scripts: [
        'assets/ctx-1.js',
        'assets/SiteLayout-1.js',
        'assets/page.module-1.js',
        'assets/CastPage-1.js',
      ],
    });
  });

  it("gives every crawler page the crawler page's assets", () => {
    expect(assetsFor(MANIFEST, '/crawlers/mimi').styles).toEqual([
      'assets/page-1.css',
      'assets/CrawlerPage-1.css',
    ]);
  });

  it('is empty without a manifest, for an unknown route, or for a module the manifest lacks', () => {
    const none = { styles: [], scripts: [] };
    expect(assetsFor(null, '/cast')).toEqual(none);
    expect(assetsFor(MANIFEST, '/ep/3')).toEqual(none);
    expect(assetsFor({}, '/cast')).toEqual(none);
  });

  it('names a real source file for every static route', () => {
    for (const route of STATIC_ROUTES) {
      const modules = modulesFor(route);
      expect(modules, route).toHaveLength(2);
      for (const module of modules) expect(existsSync(resolve(module)), module).toBe(true);
    }
    expect(Object.keys(PAGE_MODULES).sort()).toEqual([...STATIC_ROUTES].sort());
    expect(existsSync(resolve(modulesFor('/crawlers/mimi')[1]))).toBe(true);
  });
});

describe('injectPage with route assets', () => {
  const data = { route: '/cast', show: makeShow(), crawlers: makeCrawlers(), status: null };
  const BASED = TEMPLATE.replace(
    '</head>',
    '  <link rel="stylesheet" crossorigin href="/dcc-watch-hub/assets/index-abc.css">\n  </head>',
  );

  it('reads the deploy base off the entry stylesheet', () => {
    expect(assetPrefix(BASED)).toBe('/dcc-watch-hub/');
    expect(assetPrefix(TEMPLATE)).toBe('/');
  });

  it('links the stylesheets and preloads the chunks at the end of the head', () => {
    const page = injectPage(BASED, {
      head: '<title>T</title>',
      html: '<p>hi</p>',
      data,
      assets: assetsFor(MANIFEST, '/cast'),
    });
    const head = page.slice(0, page.indexOf('</head>'));
    expect(head).toContain(
      '<link rel="stylesheet" crossorigin href="/dcc-watch-hub/assets/CastPage-1.css">',
    );
    expect(head).toContain(
      '<link rel="modulepreload" crossorigin href="/dcc-watch-hub/assets/CastPage-1.js">',
    );
    // After the entry stylesheet, and shared rules before the page's own.
    expect(head.indexOf('index-abc.css')).toBeLessThan(head.indexOf('page-1.css'));
    expect(head.indexOf('page-1.css')).toBeLessThan(head.indexOf('CastPage-1.css'));
  });

  it('adds nothing when the route has no assets', () => {
    const plain = injectPage(TEMPLATE, { head: '<title>T</title>', html: '', data });
    expect(plain).not.toContain('modulepreload');
    expect(plain.match(/rel="stylesheet"/g)).toBeNull();
  });
});

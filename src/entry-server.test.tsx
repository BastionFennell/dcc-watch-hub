/**
 * The server entry, tested the way the prerenderer uses it: give it a URL and
 * the payload, get markup for `#root` and a head for `<head>`.
 *
 * Since T1125 the marketing routes are real pages, each one a lazy chunk the
 * module preloads before it renders: an empty body here would mean the
 * prerenderer is writing Suspense fallbacks into the HTML.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ready, render, stripHoistedHead } from './entry-server';
import type { Embedded } from './data/types';
import { makeCrawlers, makeShow, makeStatus } from './test/fixtures';

/** Every collected tag carries the marker the browser strips at boot. */
const M = ' data-dcc-head';

// What `scripts/prerender.mjs` does before its first render.
beforeAll(async () => {
  await ready;
});

function data(route: string): Embedded {
  return { route, show: makeShow(), crawlers: makeCrawlers(), status: makeStatus() };
}

describe('stripHoistedHead', () => {
  it('removes the leading run React hoists, and nothing else', () => {
    const markup =
      '<title>T</title><meta name="description" content="d"/><link rel="canonical" href="x"/><div id="a"><meta name="kept" content="y"/></div>';
    expect(stripHoistedHead(markup)).toBe('<div id="a"><meta name="kept" content="y"/></div>');
  });

  it('leaves markup with no hoistables alone', () => {
    expect(stripHoistedHead('<div>hi</div>')).toBe('<div>hi</div>');
  });
});

describe('render', () => {
  it('renders the NotFound page for an unknown route', () => {
    const { html } = render('/nope', data('/nope'));
    expect(html).toContain('No such recap episode exists in the archive.');
    // Nothing React hoists survives into the body; the head carries it instead.
    expect(html.startsWith('<title>')).toBe(false);
    expect(html).not.toContain('<link rel="canonical"');
  });

  it("returns the page's own head, seeded from the show and overwritten by <Seo>", () => {
    const { head } = render('/crawlers/harry', data('/crawlers/harry'));
    expect(head).toContain(`<title${M}>Harold Wallace · Dungeon Crawl Cast</title>`);
    expect(head).toContain(`<meta${M} name="description" content="Harold Wallace. Concept coming soon.`);
    expect(head).toContain(
      `<link${M} rel="canonical" href="https://dungeoncrawlcast.com/crawlers/harry" />`,
    );
    expect(head).toContain(`<meta${M} property="og:type" content="profile" />`);
    expect(head).toContain(
      `<meta${M} property="og:image" content="https://dungeoncrawlcast.com/og/crawler-harry.png" />`,
    );
  });

  it('gives a hub episode its own head, so a shared /ep link previews', () => {
    const { head } = render('/ep/1', data('/ep/1'));
    expect(head).toContain(`<title${M}>Episode 1 - The World Dungeon · System feed</title>`);
    expect(head).toContain(`<meta${M} property="og:type" content="video.other" />`);
    expect(head).toContain(
      `<meta${M} property="og:image" content="https://dungeoncrawlcast.com/og/ep1.png" />`,
    );
  });

  it('falls back to the default head when the payload carries no show', () => {
    const { head } = render('/', { route: '/', show: null, crawlers: null, status: null });
    expect(head).toContain(`<title${M}>Dungeon Crawl Cast</title>`);
    expect(head).toContain(
      `<meta${M} name="description" content="A Dungeon Crawler Carl actual play." />`,
    );
  });

  it('renders the front door at the root, from the seeded show and roster', () => {
    const { html } = render('/', data('/'));
    // Seeded, not fetched: no effects run on the server, so a fetch would have
    // left the page empty - and the marketing pages are lazy chunks, so a
    // missing preload would have left it empty too.
    expect(html).toContain('Heart and chaos in the World Dungeon.');
    expect(html).toContain('Ronald Hudson');
  });

  it('renders the archive at /watch', () => {
    const { html } = render('/watch', data('/watch'));
    expect(html).toContain('Episode 1 - The World Dungeon');
    expect(html).toContain('Episode 3 - Descent');
  });

  it('renders in-page links under the deploy base, as the browser will', () => {
    vi.stubEnv('BASE_URL', '/dcc-watch-hub/');
    try {
      const { html, head } = render('/watch', data('/watch'));
      expect(html).toContain('href="/dcc-watch-hub/crawlers"');
      expect(html).toContain('href="/dcc-watch-hub/ep/1"');
      expect(head).toContain('https://dungeoncrawlcast.com/dcc-watch-hub/watch');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not throw for a hub episode route', () => {
    expect(() => render('/ep/1', data('/ep/1'))).not.toThrow();
  });
});

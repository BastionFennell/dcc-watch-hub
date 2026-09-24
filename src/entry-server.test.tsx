/**
 * The server entry, tested the way the prerenderer uses it: give it a URL and
 * the payload, get markup for `#root` and a head for `<head>`.
 *
 * The marketing pages land in Wave B, so today every route renders the app
 * shell - which is exactly what makes this a useful smoke test of the wiring.
 */
import { describe, expect, it } from 'vitest';
import { render, stripHoistedHead } from './entry-server';
import type { Embedded } from './data/types';
import { makeCrawlers, makeShow, makeStatus } from './test/fixtures';

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

  it('returns a head with a title, a description and a canonical for the route', () => {
    const { head } = render('/crawlers/harry', data('/crawlers/harry'));
    expect(head).toContain(
      '<title>Dungeon Crawl Cast - Heart and chaos in the World Dungeon.</title>',
    );
    expect(head).toContain('<meta name="description" content="Five people from a film crew.');
    expect(head).toContain(
      '<link rel="canonical" href="https://dungeoncrawlcast.com/crawlers/harry" />',
    );
    expect(head).toContain('<meta property="og:type" content="website" />');
  });

  it('falls back to the default head when the payload carries no show', () => {
    const { head } = render('/', { route: '/', show: null, crawlers: null, status: null });
    expect(head).toContain('<title>Dungeon Crawl Cast</title>');
    expect(head).toContain(
      '<meta name="description" content="A Dungeon Crawler Carl actual play." />',
    );
  });

  it('renders the hub archive at the root, from the seeded show', () => {
    const { html } = render('/', data('/'));
    expect(html).toContain('Episode 1 - The World Dungeon');
    // Seeded, not fetched: no effects run on the server, so a fetch would have
    // left the page empty.
    expect(html).toContain('Episode 3 - Descent');
  });

  it('does not throw for a hub episode route', () => {
    expect(() => render('/ep/1', data('/ep/1'))).not.toThrow();
  });
});

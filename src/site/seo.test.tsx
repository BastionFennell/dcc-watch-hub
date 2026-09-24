// @vitest-environment jsdom
/**
 * Two halves of one contract: what React puts in the browser's `<head>`, and
 * what the collector hands the prerenderer. They have to agree.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { HeadCollector, HeadCollectorProvider, Seo, absoluteUrl, siteOrigin } from './seo';

/** Every collected tag carries the marker the browser strips at boot. */
const M = ' data-dcc-head';

const props = {
  title: 'Harry - Dungeon Crawl Cast',
  description: 'The crawler, and the person behind him.',
  canonicalPath: '/crawlers/harry',
};

// React owns the head nodes it hoisted; unmounting (Testing Library does it
// for us) is what removes them, so the test never touches <head> by hand.
afterEach(() => vi.unstubAllEnvs());

describe('siteOrigin / absoluteUrl', () => {
  it('defaults to the registered domain and strips a trailing slash', () => {
    expect(siteOrigin()).toBe('https://dungeoncrawlcast.com');
    vi.stubEnv('VITE_SITE_URL', 'https://dcc.example/');
    expect(siteOrigin()).toBe('https://dcc.example');
  });

  it('adds the deploy base to a root-relative path', () => {
    vi.stubEnv('BASE_URL', '/dcc-watch-hub/');
    expect(absoluteUrl('/crawlers/harry')).toBe(
      'https://dungeoncrawlcast.com/dcc-watch-hub/crawlers/harry',
    );
  });

  it('leaves an absolute URL alone', () => {
    expect(absoluteUrl('https://img.example/a.png')).toBe('https://img.example/a.png');
  });
});

describe('Seo in the browser', () => {
  it('hoists the title, description and canonical into <head>', async () => {
    render(<Seo {...props} />);
    await waitFor(() => expect(document.title).toBe(props.title));
    expect(
      document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe(props.description);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://dungeoncrawlcast.com/crawlers/harry',
    );
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'website',
    );
  });

  it('renders JSON-LD in place, with `<` escaped', () => {
    const { container } = render(
      <Seo {...props} jsonLd={{ '@type': 'VideoObject', name: '</script><b>' }} />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).toBe('{"@type":"VideoObject","name":"\\u003c/script>\\u003cb>"}');
    expect(script?.innerHTML).not.toContain('</script>');
  });
});

describe('Seo on the server', () => {
  function serverRender(extra: Partial<Parameters<typeof Seo>[0]> = {}) {
    const collector = new HeadCollector();
    const html = renderToString(
      <HeadCollectorProvider collector={collector}>
        <div id="app">
          <Seo {...props} {...extra} />
          <p>body</p>
        </div>
      </HeadCollectorProvider>,
    );
    return { head: collector.toString(), html };
  }

  it('collects the head as a string, in a fixed order', () => {
    const { head } = serverRender();
    expect(head.split('\n')).toEqual([
      `<title${M}>Harry - Dungeon Crawl Cast</title>`,
      `<meta${M} name="description" content="The crawler, and the person behind him." />`,
      `<link${M} rel="canonical" href="https://dungeoncrawlcast.com/crawlers/harry" />`,
      `<meta${M} property="og:title" content="Harry - Dungeon Crawl Cast" />`,
      `<meta${M} property="og:description" content="The crawler, and the person behind him." />`,
      `<meta${M} property="og:url" content="https://dungeoncrawlcast.com/crawlers/harry" />`,
      `<meta${M} property="og:type" content="website" />`,
      `<meta${M} property="og:site_name" content="Dungeon Crawl Cast" />`,
      `<meta${M} name="twitter:card" content="summary" />`,
    ]);
  });

  it('adds the image pair and the large card when there is an OG image', () => {
    const { head } = serverRender({ ogImage: '/og/crawler-harry.png', ogType: 'profile' });
    expect(head).toContain(`<meta${M} name="twitter:card" content="summary_large_image" />`);
    expect(head).toContain(
      `<meta${M} property="og:image" content="https://dungeoncrawlcast.com/og/crawler-harry.png" />`,
    );
    expect(head).toContain(`<meta${M} property="og:type" content="profile" />`);
  });

  it('escapes what goes into an attribute', () => {
    const { head } = serverRender({ title: 'A & B "quoted" <x>' });
    expect(head).toContain(`<title${M}>A &amp; B "quoted" &lt;x&gt;</title>`);
    expect(head).toContain(
      `<meta${M} property="og:title" content="A &amp; B &quot;quoted&quot; &lt;x&gt;" />`,
    );
  });

  /*
   * renderToString hoists <title>/<meta>/<link> to the FRONT of the returned
   * string rather than into a head of its own - which is exactly why `render()`
   * strips them and uses the collector's copy instead. The collected head must
   * therefore be right whatever the markup does.
   */
  it('emits the hoistables at the start of the html, ahead of the app', () => {
    const { html } = serverRender();
    expect(html.startsWith('<title>Harry - Dungeon Crawl Cast</title>')).toBe(true);
    expect(html).toContain('<div id="app"><p>body</p></div>');
  });

  it('keeps JSON-LD in the body, not in the collected head', () => {
    const { head, html } = serverRender({ jsonLd: { '@type': 'VideoObject' } });
    expect(head).not.toContain('ld+json');
    expect(html).toContain('<script type="application/ld+json">{"@type":"VideoObject"}</script>');
  });

  it('lets a later Seo win rather than emitting both', () => {
    const collector = new HeadCollector();
    renderToString(
      <HeadCollectorProvider collector={collector}>
        <div>
          <Seo {...props} />
          <Seo {...props} title="Second" />
        </div>
      </HeadCollectorProvider>,
    );
    const head = collector.toString();
    expect(head).toContain(`<title${M}>Second</title>`);
    expect(head.match(/<title/g)).toHaveLength(1);
    // The order does not drift when a value is overwritten.
    expect(head.split('\n')[0]).toBe(`<title${M}>Second</title>`);
  });
});

describe('noindex', () => {
  it('is absent by default, on both sides', () => {
    const collector = new HeadCollector();
    collector.collect(props);
    expect(collector.toString()).not.toContain('robots');

    const { container } = render(<Seo {...props} />);
    expect(container.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('keeps the 404 out of the index, on both sides', async () => {
    const collector = new HeadCollector();
    collector.collect({ ...props, noindex: true });
    expect(collector.toString()).toContain(`<meta${M} name="robots" content="noindex" />`);

    render(<Seo {...props} noindex />);
    await waitFor(() =>
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex',
      ),
    );
  });
});

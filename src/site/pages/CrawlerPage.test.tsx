// @vitest-environment jsdom
/**
 * `/crawlers/:id` (011 §3.4, revision 2): the hero, the one CTA, the credit,
 * the sections that only exist when there is something in them, the entry
 * achievement as the page's single System-styled block, and the bar that walks
 * the roster.
 *
 * The rule under half of these: **empty renders nothing**. `harry` in the
 * fixture roster is the unwritten crawler, and what the page does with him is
 * as much a requirement as what it does with a filled one.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { CrawlerPage } from './CrawlerPage';
import { siteCopy } from '../copy';
import { copy } from '../../copy';
import { renderSite } from '../../test/renderSite';
import {
  makeCrawlers,
  makeDossier,
  makeEpisodeRaw,
  makeShow,
  makeStatus,
} from '../../test/fixtures';
import type { CrawlerRoster } from '../../data/types';

const [stuntman] = makeCrawlers().crawlers;

/** Every episode file answers with the fixture party (stuntman and harry). */
function stubEpisodes() {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const id = Number(/ep(\d+)\.json/.exec(String(input))?.[1] ?? 1);
    return Promise.resolve(
      new Response(JSON.stringify(makeEpisodeRaw(id)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

beforeEach(() => {
  stubEpisodes();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderCrawler(id = 'stuntman') {
  return renderSite(<CrawlerPage />, { path: `/crawlers/${id}`, routePath: '/crawlers/:id' });
}

/** The roster with one crawler patched, for the states data alone decides. */
function rosterWith(patch: (roster: CrawlerRoster) => void): CrawlerRoster {
  const roster = makeCrawlers();
  patch(roster);
  return roster;
}

describe('CrawlerPage hero', () => {
  it('opens on the archetype, the character and the handle', () => {
    renderCrawler();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(stuntman.characterName);
    expect(screen.getByText(stuntman.name)).toBeInTheDocument();
    expect(screen.getByText(stuntman.handle)).toBeInTheDocument();
  });

  it('credits the player in the hero, with the name brighter than the rest', () => {
    renderCrawler();
    const prefix = screen.getByText(`${siteCopy.playedBy}`, { exact: false });
    expect(prefix).toBeInTheDocument();
    expect(prefix.closest('p')).toHaveTextContent(`${siteCopy.playedBy} Danny`);
    expect(screen.getByText('he/him · Two sentences about Danny.')).toBeInTheDocument();
  });

  /*
   * No progression in the hero (011 R2): a stranger from a search result gets
   * who this is, not how far they have got. 012 takes the last of it - there
   * is no status pill on this page for anyone, in any condition, because a
   * pill is an answer to a question nobody asked.
   */
  it('spoils nothing: no floor, no level line, no condition anywhere', () => {
    renderCrawler();
    expect(screen.queryByTestId('status-line')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Floor \d/);
    expect(document.body.textContent).not.toMatch(/Lv \d|Level \d/);
    expect(document.body.textContent).not.toMatch(/alive|dead|deceased|fused|unknown/i);
  });
});

describe('CrawlerPage sections', () => {
  it('states the concept and lists the pockets when there are any', () => {
    renderCrawler();
    expect(screen.getByText(stuntman.concept)).toBeInTheDocument();
    const pockets = screen.getByRole('heading', { name: siteCopy.pocketsTitle }).closest('section');
    expect(
      within(pockets as HTMLElement)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(stuntman.pockets);
  });

  it('renders nothing at all for the sections the author has not filled in', () => {
    renderCrawler('harry');
    // Harry is the empty crawler: no concept, no pockets, no achievement.
    expect(screen.queryByRole('heading', { name: siteCopy.pocketsTitle })).toBeNull();
    expect(screen.queryByRole('heading', { name: /concept/i })).toBeNull();
    expect(screen.queryByTestId('entry-achievement')).toBeNull();
    // ...and above all, no placeholder standing in for any of them.
    expect(document.body.textContent).not.toMatch(/coming soon/i);
    // The hero itself still renders: the crawler is not a blank page.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Harold Wallace');
  });

  it('renders the entry achievement as the page\'s one System-styled block', () => {
    renderCrawler();
    const box = screen.getByTestId('entry-achievement');
    // No section label over it: the kicker inside the box is the heading
    // (author, 2026-09-25).
    expect(screen.queryByRole('heading', { name: /entry achievement/i })).toBeNull();
    expect(within(box).getByText(siteCopy.achievementKicker)).toBeInTheDocument();
    expect(within(box).getByText('Method Acting')).toBeInTheDocument();
    expect(within(box).getByText('You committed to the bit.')).toBeInTheDocument();
    expect(within(box).getByText('Reward: Golden Monster Box → Liquid Latex')).toBeInTheDocument();
    expect(within(box).getByText('Inside is a bottle of Liquid Latex.')).toBeInTheDocument();
    expect(screen.getAllByTestId('entry-achievement')).toHaveLength(1);
    // The hub's SystemBox is not what does this job any more (011 R2).
    expect(screen.queryByTestId('system-box')).toBeNull();
  });

  it('omits the achievement entirely when there is none', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      crawlers: rosterWith((roster) => {
        delete roster.crawlers[0].entryAchievement;
      }),
    });
    expect(screen.queryByTestId('entry-achievement')).toBeNull();
  });

  /*
   * "Appears in" was dropped on 2026-09-25 by the author: the crawler page
   * lists no episodes at all any more, whether or not the build precomputed
   * them into `status.json` (which it still does, for other readers).
   */
  it('lists no episode links, precomputed appearances or not', async () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      status: { ...makeStatus(), appearances: { stuntman: [1, 3] } },
    });
    const hero = screen.getByRole('heading', { level: 1 }).closest('article');
    expect(within(hero as HTMLElement).queryAllByRole('link', { name: /^Episode \d/ })).toEqual([]);
    expect(screen.queryByRole('heading', { name: /appears in/i })).toBeNull();
    // ...and nothing arrives after mount either.
    await waitFor(() => expect(screen.getByTestId('entry-achievement')).toBeInTheDocument());
    expect(within(hero as HTMLElement).queryAllByRole('link', { name: /^Episode \d/ })).toEqual([]);
  });
});

describe('CrawlerPage CTA and navigation', () => {
  const opener = makeShow().episodes[0];

  it('points the one CTA at episode 1 on the hub once the feed is open', () => {
    const show = makeShow();
    show.episodes[0].hubLiveAt = '2020-01-01T00:00:00.000Z';
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      show,
    });
    const cta = screen.getByRole('link', { name: siteCopy.startAtEpisodeOne });
    expect(cta).toHaveAttribute('href', `/ep/${opener.id}`);
    expect(cta).toHaveAttribute('data-kind', 'hub');
  });

  it('points it at YouTube while the feed is still shut', () => {
    const show = makeShow();
    show.episodes[0].hubLiveAt = '2099-01-01T00:00:00.000Z';
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      show,
      status: null,
      now: Date.parse('2026-01-01T00:00:00.000Z'),
    });
    const cta = screen.getByRole('link', { name: siteCopy.startAtEpisodeOne });
    expect(cta).toHaveAttribute('data-kind', 'youtube');
    expect(cta.getAttribute('href')).toContain('youtube.com');
  });

  it('walks the roster with a prev/next bar', () => {
    const { unmount } = renderCrawler('stuntman');
    expect(screen.queryByRole('link', { name: new RegExp(siteCopy.prevCrawler) })).toBeNull();
    const next = screen.getByRole('link', { name: new RegExp(siteCopy.nextCrawler) });
    expect(next).toHaveAttribute('href', '/crawlers/harry');
    expect(next).toHaveTextContent('Harold Wallace →');
    unmount();

    renderCrawler('harry');
    const prev = screen.getByRole('link', { name: new RegExp(siteCopy.prevCrawler) });
    expect(prev).toHaveAttribute('href', '/crawlers/stuntman');
    expect(prev).toHaveTextContent('← Ronald Hudson');
    expect(screen.queryByRole('link', { name: new RegExp(siteCopy.nextCrawler) })).toBeNull();
  });

  it('gives an unknown crawler the System not-found page', () => {
    renderCrawler('nobody');
    expect(screen.getByText(copy.notFoundTitle)).toBeInTheDocument();
  });

  it('shares as a profile, with the crawler card as the image', () => {
    renderCrawler();
    expect(document.title).toBe(siteCopy.pageTitle(stuntman.characterName));
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'profile');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      '/og/crawler-stuntman.png',
    );
  });
});

/*
 * The dossier on the page (012 T1215, T1217). The panel's own behaviour is
 * tested next to it; what the page owes it is a place to stand and a head that
 * gives nothing away.
 */
describe('the crawler dossier on the page', () => {
  /** A file whose every string is distinctive, so a leak is unmistakable. */
  function loudDossier(id: string) {
    const file = makeDossier(id);
    file.updates[2] = {
      ...file.updates[2],
      title: 'The final descent ends on the Brine Stairs',
      body: 'A memorial banner hangs over Floor Two.',
      chips: ['IN MEMORIAM'],
      condition: 'deceased',
    };
    return file;
  }

  it('stands full width under the hero and above the bar that walks the roster', () => {
    renderCrawler();
    const panel = screen.getByRole('heading', { name: /where is|where are/i }).closest('section');
    expect(panel).not.toBeNull();
    const hero = screen.getByRole('heading', { level: 1 }).closest('article') as HTMLElement;
    const nav = screen.getByRole('navigation', { name: siteCopy.crawlersTitle });
    // Document order: hero, then the panel, then prev/next.
    expect(hero.compareDocumentPosition(panel as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect((panel as HTMLElement).compareDocumentPosition(nav)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // It is a child of the page, not of the hero grid.
    expect(hero.contains(panel as Node)).toBe(false);
    expect(screen.getAllByTestId('dossier-row')).toHaveLength(3);
  });

  it('keeps every card out of the title, the meta tags and the JSON-LD (T1217)', () => {
    const file = loudDossier('stuntman');
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      dossier: file,
    });

    const head = [
      document.title,
      ...[...document.querySelectorAll('meta')].map((tag) => tag.getAttribute('content') ?? ''),
      ...[...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (tag) => tag.textContent ?? '',
      ),
      ...[...document.querySelectorAll('link')].map((tag) => tag.getAttribute('href') ?? ''),
    ].join(' | ');

    for (const card of file.updates) {
      expect(head).not.toContain(card.title);
      expect(head).not.toContain(card.body);
      for (const chip of card.chips) expect(head).not.toContain(chip);
    }
    expect(head).not.toMatch(/deceased|death|killed|memorial/i);

    // ...and opening every card changes none of it.
    fireEvent.click(screen.getByRole('button', { name: /^Reveal all/ }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(document.title).toBe(siteCopy.pageTitle(stuntman.characterName));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).not.toMatch(
      /Brine Stairs|memorial/i,
    );
  });

  it('puts nothing in the URL: no fragment, no query, no link out of the panel (T1217)', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      dossier: loudDossier('stuntman'),
    });
    const panel = screen.getByRole('heading', { name: /where is|where are/i })
      .closest('section') as HTMLElement;

    fireEvent.click(screen.getByRole('button', { name: /^Reveal the Episode 2/ }));
    expect(within(panel).queryAllByRole('link')).toEqual([]);
    expect(panel.querySelectorAll('[href]')).toHaveLength(0);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    // The canonical link is still the page's own address, unqualified.
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://dungeoncrawlcast.com/crawlers/stuntman',
    );
  });

  it('renders the launch state, and no rows, for a deploy with no cards yet', () => {
    renderSite(<CrawlerPage />, {
      path: '/crawlers/stuntman',
      routePath: '/crawlers/:id',
      dossier: { id: 'stuntman', generatedAt: '', updates: [] },
    });
    expect(screen.getByText(siteCopy.dossier.launch)).toBeInTheDocument();
    expect(screen.queryAllByTestId('dossier-row')).toEqual([]);
  });
});

/*
 * jsdom computes no stylesheet, so the only honest way to assert a shared
 * measure is to read the modules: one token, used by the shell and the footer,
 * so every left edge on the front door lands on the same pixel (011 R2).
 */
describe('the front door measure', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  it('sizes the page shell and the footer from one token', () => {
    expect(read('./page.module.css')).toContain('max-width: var(--site-measure)');
    expect(read('../components/SiteFooter.module.css')).toContain(
      'max-width: var(--site-measure)',
    );
    expect(read('../../styles/tokens.css')).toMatch(/--site-measure:\s*992px/);
  });
});

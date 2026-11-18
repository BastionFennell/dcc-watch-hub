// @vitest-environment jsdom
/**
 * `/cast` (014): five cards from the real `cast.json`, in file order, each
 * showing what the author supplied and nothing standing in for what they have
 * not - plus the `/cast#<id>` anchors and the one effect that scrolls to them
 * after a client-side arrival.
 *
 * Most of this runs against the real files on purpose: the bios must match
 * the spec word for word, and the fixture cast cannot prove that.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CastPage } from './CastPage';
import { siteCopy } from '../copy';
import { renderSite } from '../../test/renderSite';
import { makeShow, makeStatus } from '../../test/fixtures';
import { ShowProvider } from '../../data/ShowContext';
import { CrawlersProvider } from '../../data/CrawlersContext';
import type { CastFile, CrawlerRoster } from '../../data/types';

function data(name: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, '../../../public/data', name), 'utf8'));
}

const realCast = data('cast.json') as CastFile;
const realCrawlers = data('crawlers.json') as CrawlerRoster;
const IDS = ['lulu', 'madio', 'danny', 'sarah', 'bastion'];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderCast(path = '/cast') {
  return renderSite(<CastPage />, { path, crawlers: realCrawlers, cast: realCast });
}

function card(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`no card #${id}`);
  return element;
}

function member(id: string) {
  const found = realCast.cast.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no member ${id}`);
  return found;
}

describe('CastPage', () => {
  it('shows five cards in file order, each headed by the short name', () => {
    renderCast();
    const cards = Array.from(document.querySelectorAll('article'));
    expect(cards.map((element) => element.id)).toEqual(IDS);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Lulu',
      'Madio',
      'Danny',
      'Sarah',
      'Bastion',
    ]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(siteCopy.castTitle);
  });

  it('prints the three bios exactly as the file has them, one paragraph each', () => {
    renderCast();
    for (const id of ['madio', 'sarah', 'danny']) {
      const paragraphs = member(id).bio;
      expect(paragraphs.length).toBeGreaterThan(0);
      for (const paragraph of paragraphs) {
        expect(within(card(id)).getByText(paragraph).tagName).toBe('P');
      }
    }
    expect(member('sarah').bio).toHaveLength(2);
  });

  it('gives a member with no bio and no links nothing in their place', () => {
    renderCast();
    for (const id of ['lulu', 'bastion']) {
      const element = card(id);
      expect(element.querySelector('ul')).toBeNull();
      // Role and pronouns are the only paragraphs: no bio, no placeholder.
      const lines = Array.from(element.querySelectorAll('p')).map((p) => p.textContent);
      expect(lines).toEqual(
        id === 'lulu' ? ['Plays Mimi Rivers', 'she/her'] : ['The System AI', 'he/him'],
      );
      expect(element.textContent).not.toMatch(/coming soon|tbd|not yet|todo/i);
    }
  });

  it("links a player's role to their crawler and leaves the System AI as plain text", () => {
    renderCast();
    const plays = within(card('madio')).getByRole('link', { name: 'Plays Ronald Hudson' });
    expect(plays).toHaveAttribute('href', '/crawlers/ronald');
    expect(within(card('bastion')).getByText('The System AI').closest('a')).toBeNull();
    expect(within(card('bastion')).queryAllByRole('link')).toHaveLength(0);
  });

  it('draws the link pills with the right label, address and safety rule', () => {
    renderCast();
    const expected: [string, string, string][] = [
      ['madio', siteCopy.platform.beacons, 'https://beacons.ai/madiotu'],
      ['danny', siteCopy.platform.linktree, 'https://linktr.ee/dannyrmendoza'],
      ['sarah', siteCopy.platform.instagram, 'https://www.instagram.com/sarahthegeeky'],
    ];
    for (const [id, label, href] of expected) {
      const list = within(card(id)).getByRole('list', {
        name: siteCopy.castLinksLabel(member(id).name),
      });
      const link = within(list).getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener');
    }
  });

  it('names every photo, reserves its space and defers all but the first', () => {
    renderCast();
    const images = Array.from(document.querySelectorAll('article img'));
    expect(images).toHaveLength(5);
    images.forEach((image, index) => {
      expect(image).toHaveAttribute('alt', realCast.cast[index].name);
      expect(image).toHaveAttribute('width', '480');
      expect(image).toHaveAttribute('height', '480');
      expect(image).toHaveAttribute('src', realCast.cast[index].photo.card);
      expect(image).toHaveAttribute('loading', index === 0 ? 'eager' : 'lazy');
    });
  });

  it('says nothing about any crawler\'s fate', () => {
    renderCast();
    expect(document.body.textContent).not.toMatch(/Floor \d/);
    expect(document.body.textContent).not.toMatch(/Lv \d|Level \d/);
    expect(document.body.textContent).not.toMatch(/alive|dead|deceased|fused|unknown/i);
  });

  it('carries its own head', () => {
    renderCast();
    expect(document.title).toBe(siteCopy.pageTitle(siteCopy.navCast));
  });

  /* The roster still loading: the member renders without a role, not a broken one. */
  it('leaves out a role line whose crawler is not in the roster yet', () => {
    renderSite(<CastPage />, { path: '/cast', crawlers: { crawlers: [] }, cast: realCast });
    expect(within(card('madio')).queryByText(/^Plays /)).toBeNull();
    expect(within(card('bastion')).getByText('The System AI')).toBeInTheDocument();
  });
});

/* ------------------------------------------------ /cast#<id> (US2, T1419) */

/**
 * A client-side arrival: the page carries a payload without `cast` (a hub
 * page, or one written before 014), so the provider fetches the file and the
 * page has to make the fragment jump itself.
 */
function mountFetched(path: string) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('cast.json') ? realCast : realCrawlers;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  const embedded = { route: path, show: makeShow(), crawlers: realCrawlers, status: makeStatus() };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ShowProvider embedded={embedded}>
        <CrawlersProvider embedded={embedded}>
          <CastPage />
        </CrawlersProvider>
      </ShowProvider>
    </MemoryRouter>,
  );
}

describe('CastPage anchors', () => {
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('gives each of the five members an element id', () => {
    renderCast();
    for (const id of IDS) expect(card(id).tagName).toBe('ARTICLE');
  });

  it('scrolls to the named card once a fetched cast lands', async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    mountFetched('/cast#sarah');
    await waitFor(() => expect(scrolled).toEqual(['sarah']));
  });

  it('does nothing for a hash that names nobody', async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    expect(() => mountFetched('/cast#nobody')).not.toThrow();
    await waitFor(() => expect(document.getElementById('sarah')).not.toBeNull());
    expect(scrolled).toEqual([]);
  });

  /* Prerendered: the browser already jumped; a second jump would yank the reader. */
  it('leaves a seeded page where the browser put it', () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    renderCast('/cast#sarah');
    expect(card('sarah')).toBeInTheDocument();
    expect(scrolled).toEqual([]);
  });

  /*
   * Seeded, but arrived at by a client-side navigation (the "Played by" credit
   * on a prerendered crawler page): the browser jumped nowhere, so the page does.
   */
  it('scrolls on a client-side arrival even when the cast was seeded', () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    const embedded = {
      route: '/crawlers/veil',
      show: makeShow(),
      crawlers: realCrawlers,
      status: makeStatus(),
      cast: realCast,
    };
    render(
      <MemoryRouter initialEntries={['/crawlers/veil', '/cast#sarah']} initialIndex={1}>
        <ShowProvider embedded={embedded}>
          <CrawlersProvider embedded={embedded}>
            <CastPage />
          </CrawlersProvider>
        </ShowProvider>
      </MemoryRouter>,
    );
    expect(scrolled).toEqual(['sarah']);
  });

  /*
   * Seeded, on the first entry, but the card is not where the native jump put
   * it (the markup was re-rendered, or the chunk CSS moved it): scroll after all.
   */
  it('scrolls a seeded page when the native jump did not hold', () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 1600 } as DOMRect);
    renderCast('/cast#sarah');
    expect(scrolled).toEqual(['sarah']);
    rect.mockRestore();
  });

  it('survives a browser with no scrollIntoView (jsdom)', async () => {
    expect(() => mountFetched('/cast#sarah')).not.toThrow();
    await waitFor(() => expect(document.getElementById('sarah')).not.toBeNull());
  });
});

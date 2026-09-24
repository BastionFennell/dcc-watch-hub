// @vitest-environment jsdom
/**
 * User Story 2 (tasks.md T028/T029): the archive is browsable and the header is
 * the same chrome on every route. The header and the hub both list episodes, so
 * every assertion is scoped to the banner or to main.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { copy } from './copy';
import { makeEpisodeRaw, makeRegistry, makeShow, makeSpells } from './test/fixtures';

function showFixture(withoutRegistry: boolean) {
  const show = makeShow();
  if (withoutRegistry) delete (show as { registryUrl?: string }).registryUrl;
  return show;
}

function stubFetch({ withoutRegistry = false }: { withoutRegistry?: boolean } = {}) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('show.json')
      ? showFixture(withoutRegistry)
      : url.includes('npcs.json')
        ? makeRegistry()
        : url.includes('spells.json')
          ? makeSpells()
          : makeEpisodeRaw(1);
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('broadcast archive', () => {
  beforeEach(() => stubFetch());

  it('groups the hub episodes by floor, in show order', async () => {
    renderAt('/');
    const main = screen.getByRole('main');
    await waitFor(() =>
      expect(within(main).getByRole('heading', { name: 'Floor 1' })).toBeInTheDocument(),
    );

    const floorOne = within(main).getByRole('heading', { name: 'Floor 1' }).closest('section');
    const floorTwo = within(main).getByRole('heading', { name: 'Floor 2' }).closest('section');
    expect(floorOne).not.toBeNull();
    expect(floorTwo).not.toBeNull();

    expect(
      within(floorOne as HTMLElement)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/ep/1', '/ep/2']);
    expect(
      within(floorTwo as HTMLElement)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/ep/3']);
    expect(
      within(main).getByRole('link', { name: /Episode 2 - The Meat District/ }),
    ).toHaveAttribute('href', '/ep/2');
  });

  it('titles the hub document in the System voice', async () => {
    renderAt('/');
    await waitFor(() => expect(document.title).toBe(copy.pageTitle(copy.archiveTitle)));
  });

  it('offers a skip link to the broadcast', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: copy.skipToContent })).toHaveAttribute('href', '#main');
  });

  it('shows the episode label and only a next arrow on the first episode', async () => {
    renderAt('/ep/1?fake=1');
    const banner = screen.getByRole('banner');
    await waitFor(() =>
      expect(within(banner).getByText(copy.episodeLabel(1, 1, 1))).toBeInTheDocument(),
    );
    expect(within(banner).queryByLabelText(copy.prevEpisode)).toBeNull();
    expect(within(banner).getByLabelText(copy.nextEpisode)).toHaveAttribute('href', '/ep/2?fake=1');
  });

  it('hides the next arrow on the last episode', async () => {
    renderAt('/ep/3?fake=1');
    const banner = screen.getByRole('banner');
    await waitFor(() =>
      expect(within(banner).getByText(copy.episodeLabel(1, 2, 3))).toBeInTheDocument(),
    );
    expect(within(banner).getByLabelText(copy.prevEpisode)).toHaveAttribute('href', '/ep/2?fake=1');
    expect(within(banner).queryByLabelText(copy.nextEpisode)).toBeNull();
  });

  it('lists every episode in the header menu and marks the open one', async () => {
    renderAt('/ep/2?fake=1');
    const banner = screen.getByRole('banner');
    await waitFor(() =>
      expect(within(banner).getByRole('heading', { name: 'Floor 2' })).toBeInTheDocument(),
    );

    const menuLinks = within(banner)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/ep/'));
    expect(menuLinks.map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining(['/ep/1?fake=1', '/ep/2?fake=1', '/ep/3?fake=1']),
    );

    const open = within(banner).getByRole('link', { name: /Episode 2 - The Meat District/ });
    expect(open).toHaveAttribute('aria-current', 'page');
    expect(
      within(banner).getByRole('link', { name: /Episode 1 - The World Dungeon/ }),
    ).not.toHaveAttribute('aria-current');
  });

  /*
   * 011 (T1123): the show channels are hub chrome now - they ride the header on
   * a hub route and stay off the front door, whose own footer and community
   * page carry the links instead.
   */
  it('links to the show channels from the header on a hub route', async () => {
    renderAt('/ep/1?fake=1');
    const banner = screen.getByRole('banner');
    const youtube = await within(banner).findAllByRole('link', { name: copy.youtube });
    expect(youtube[0]).toHaveAttribute('href', makeShow().links.youtube);
    expect(youtube[0]).toHaveAttribute('rel', 'noopener noreferrer');
    expect(youtube[0]).toHaveAttribute('target', '_blank');
    expect(within(banner).getAllByRole('link', { name: copy.discord })[0]).toHaveAttribute(
      'href',
      makeShow().links.discord,
    );
  });

  /*
   * The System Registry link (007, FR-620). It appears twice in the DOM - the
   * right cluster and the phone menu - and CSS picks which one is on screen, so
   * the assertion is about every copy of it.
   */
  it('links to the System Registry when the show publishes one', async () => {
    renderAt('/ep/1?fake=1');
    const banner = screen.getByRole('banner');
    const links = await within(banner).findAllByRole('link', { name: copy.registry });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute('href', '/codex');
  });

  it('omits the Registry link for a show that publishes no registry', async () => {
    stubFetch({ withoutRegistry: true });
    renderAt('/ep/1?fake=1');
    const banner = screen.getByRole('banner');
    // The header has landed once the show links are there.
    await waitFor(() =>
      expect(within(banner).getAllByRole('link', { name: copy.youtube }).length).toBeGreaterThan(0),
    );
    expect(within(banner).queryByRole('link', { name: copy.registry })).toBeNull();
  });

  it('shows the System not-found copy for an unknown episode id', async () => {
    renderAt('/ep/999');
    await waitFor(() => expect(screen.getByText(copy.notFoundTitle)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: copy.returnToArchive })).toHaveAttribute('href', '/');
  });

  it('redirects the old /codex path to the Codex', async () => {
    renderAt('/registry');
    await waitFor(() => expect(screen.getByTestId('registry')).toBeInTheDocument());
  });
});

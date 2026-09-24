// @vitest-environment jsdom
/**
 * Wave-1 shell smoke test (tasks.md T018 checkpoint). Asserts only what survives
 * later waves: the header slot renders, the archive route mounts, and an unknown
 * episode id gets the System's not-found copy. T028 adds the full App.test.tsx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { copy } from './copy';
import { siteCopy } from './site/copy';
import {
  makeCrawlers,
  makeEpisodeRaw,
  makeRegistry,
  makeShow,
  makeSpells,
  makeStatus,
} from './test/fixtures';

function stubFetch(ok = true) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    if (!ok) return Promise.resolve(new Response('nope', { status: 500 }));
    const url = String(input);
    const body = url.includes('show.json')
      ? makeShow()
      : url.includes('crawlers.json')
        ? makeCrawlers()
        : url.includes('status.json')
          ? makeStatus()
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

describe('app shell', () => {
  beforeEach(() => stubFetch());

  it('renders the header slot on every route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText(copy.systemFeedPill)).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('mounts the front door at / and the archive at /watch (011 §1)', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    // Lazy chunks, so every marketing assertion waits for the import.
    await waitFor(() => expect(screen.getByText(makeShow().tagline as string)).toBeInTheDocument());
    unmount();

    render(
      <MemoryRouter initialEntries={['/watch']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: siteCopy.watchTitle })).toBeInTheDocument(),
    );
  });

  it('shows the System not-found copy for an unknown episode id', async () => {
    render(
      <MemoryRouter initialEntries={['/ep/999']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(copy.notFoundTitle)).toBeInTheDocument());
  });

  it('shows a System-voiced error with a retry when the archive cannot load', async () => {
    stubFetch(false);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(copy.archiveUnavailable)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: copy.retry })).toBeInTheDocument();
  });
});

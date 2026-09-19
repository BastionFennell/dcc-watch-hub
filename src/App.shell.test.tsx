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
import { makeEpisodeRaw, makeRegistry, makeShow } from './test/fixtures';

function stubFetch(ok = true) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    if (!ok) return Promise.resolve(new Response('nope', { status: 500 }));
    const url = String(input);
    const body = url.includes('show.json')
      ? makeShow()
      : url.includes('npcs.json')
        ? makeRegistry()
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

  it('mounts the broadcast archive at /', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(copy.archiveTitle)).toBeInTheDocument());
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

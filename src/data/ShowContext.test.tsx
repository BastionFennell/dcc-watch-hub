// @vitest-environment jsdom
/**
 * 011 gave the show provider a second way in: the prerenderer's `__DCC__`
 * script. What matters is that the seeded path paints synchronously and fetches
 * nothing, and that every other page behaves exactly as it did before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ShowProvider, useShow } from './ShowContext';
import { EMBEDDED_ID } from './load';
import { makeCrawlers, makeShow } from '../test/fixtures';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(response: () => Response = () => json(makeShow())): string[] {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    asked.push(String(input));
    return Promise.resolve(response());
  });
  return asked;
}

function embed(payload: unknown): void {
  const script = document.createElement('script');
  script.id = EMBEDDED_ID;
  script.type = 'application/json';
  script.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
  document.body.appendChild(script);
}

function Probe() {
  const { show, loading, error, reload } = useShow();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error === null ? 'none' : error.name}</span>
      <span data-testid="title">{show?.title ?? 'none'}</span>
      <button type="button" onClick={reload}>
        reload
      </button>
    </div>
  );
}

function mount() {
  render(
    <ShowProvider>
      <Probe />
    </ShowProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById(EMBEDDED_ID)?.remove();
});

describe('ShowProvider', () => {
  it('paints the embedded show without fetching', () => {
    const asked = stubFetch();
    embed({ route: '/', show: makeShow(), crawlers: makeCrawlers(), status: null });
    mount();
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('title')).toHaveTextContent('Dungeon Crawl Cast');
    expect(asked).toEqual([]);
  });

  it('fetches when the page carries no payload', async () => {
    const asked = stubFetch();
    mount();
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(asked).toEqual(['/data/show.json']);
  });

  it('falls back to fetching when the embedded show is not a show', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const asked = stubFetch();
    embed({ route: '/', show: { title: 'broken' }, crawlers: null, status: null });
    mount();
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Dungeon Crawl'));
    expect(asked).toEqual(['/data/show.json']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('surfaces a failed fetch, and retries on reload', async () => {
    let fail = true;
    stubFetch(() =>
      fail ? new Response('nope', { status: 500, statusText: 'Server Error' }) : json(makeShow()),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('DataError'));
    fail = false;
    act(() => screen.getByRole('button', { name: 'reload' }).click());
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Dungeon Crawl'));
  });
});

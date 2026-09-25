// @vitest-environment jsdom
/**
 * The roster provider has two jobs and they must not overlap: seed from the
 * prerenderer's `__DCC__` script when the page carries one (no fetch at all),
 * fetch otherwise. The status file is allowed to be missing either way.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CrawlersProvider, useCrawlers } from './CrawlersContext';
import { EMBEDDED_ID } from './load';
import { makeCrawlers, makeDossier, makeShow, makeStatus } from '../test/fixtures';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(crawlers: () => Response, status: () => Response): string[] {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    if (url.includes('status.json')) return Promise.resolve(status());
    return Promise.resolve(crawlers());
  });
  return asked;
}

function embed(payload: unknown): void {
  const script = document.createElement('script');
  script.id = EMBEDDED_ID;
  script.type = 'application/json';
  script.textContent = JSON.stringify(payload);
  document.body.appendChild(script);
}

function Probe() {
  const { profiles, status, loading, error } = useCrawlers();
  return (
    <ul>
      <li data-testid="loading">{String(loading)}</li>
      <li data-testid="error">{error === null ? 'none' : error.name}</li>
      <li data-testid="profiles">{profiles.map((p) => p.id).join(',')}</li>
      <li data-testid="status">
        {status === null ? 'none' : Object.keys(status.crawlers).join(',')}
      </li>
    </ul>
  );
}

function mount() {
  render(
    <CrawlersProvider>
      <Probe />
    </CrawlersProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById(EMBEDDED_ID)?.remove();
});

describe('CrawlersProvider (seeded)', () => {
  it('renders the embedded roster on the first paint, fetching nothing', () => {
    const asked = stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    embed({ route: '/crawlers', show: makeShow(), crawlers: makeCrawlers(), status: makeStatus() });
    mount();
    // Synchronous: no `waitFor`, because there is nothing to wait for.
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('profiles')).toHaveTextContent('stuntman,harry');
    expect(screen.getByTestId('status')).toHaveTextContent('stuntman,harry');
    expect(asked).toEqual([]);
  });

  it('seeds the roster without a status file', () => {
    const asked = stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    embed({ route: '/crawlers', show: makeShow(), crawlers: makeCrawlers(), status: null });
    mount();
    expect(screen.getByTestId('profiles')).toHaveTextContent('stuntman,harry');
    expect(screen.getByTestId('status')).toHaveTextContent('none');
    expect(asked).toEqual([]);
  });

  it('drops a malformed embedded crawler rather than the page', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    const roster = makeCrawlers();
    embed({
      route: '/crawlers',
      show: makeShow(),
      crawlers: { crawlers: [roster.crawlers[0], { id: 'broken' }] },
      status: null,
    });
    mount();
    expect(screen.getByTestId('profiles')).toHaveTextContent('stuntman');
    warn.mockRestore();
  });
});

describe('CrawlersProvider (fetched)', () => {
  it('fetches both files when the page carries no payload', async () => {
    const asked = stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    mount();
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('profiles')).toHaveTextContent('stuntman,harry');
    expect(screen.getByTestId('status')).toHaveTextContent('stuntman,harry');
    expect(asked.some((url) => url.includes('crawlers.json'))).toBe(true);
    expect(asked.some((url) => url.includes('status.json'))).toBe(true);
  });

  /* dev: nothing has generated dist/data/status.json, and that is fine. */
  it('keeps the roster when the status file 404s', async () => {
    stubFetch(
      () => json(makeCrawlers()),
      () => new Response('nope', { status: 404, statusText: 'Not Found' }),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('profiles')).toHaveTextContent('stuntman,harry');
    expect(screen.getByTestId('status')).toHaveTextContent('none');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('surfaces an error when the roster itself cannot be read', async () => {
    stubFetch(
      () => new Response('nope', { status: 500, statusText: 'Server Error' }),
      () => json(makeStatus()),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('DataError'));
    expect(screen.getByTestId('profiles')).toHaveTextContent('');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

/* -------------------------------------------------- the dossier (012) */

function DossierProbe({ id }: { id: string }) {
  const { dossierFor } = useCrawlers();
  const file = dossierFor(id);
  return (
    <ul>
      <li data-testid="dossier">
        {file === null ? 'none' : file.updates.map((u) => u.episode).join(',')}
      </li>
    </ul>
  );
}

function mountDossier(id: string) {
  return render(
    <CrawlersProvider>
      <DossierProbe id={id} />
    </CrawlersProvider>,
  );
}

describe('CrawlersProvider dossierFor', () => {
  it('answers synchronously from the payload, fetching nothing', () => {
    const asked = stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    embed({
      route: '/crawlers/stuntman',
      show: makeShow(),
      crawlers: makeCrawlers(),
      status: null,
      dossier: makeDossier('stuntman'),
    });
    mountDossier('stuntman');
    // No waitFor: the locked rows are in the server's HTML already.
    expect(screen.getByTestId('dossier')).toHaveTextContent('1,2,3');
    expect(asked).toEqual([]);
  });

  it('fetches the file for a crawler the payload does not carry', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      if (url.includes('/dossier/')) return Promise.resolve(json(makeDossier('harry')));
      if (url.includes('status.json')) return Promise.resolve(json(makeStatus()));
      return Promise.resolve(json(makeCrawlers()));
    });
    embed({
      route: '/crawlers/stuntman',
      show: makeShow(),
      crawlers: makeCrawlers(),
      status: null,
      dossier: makeDossier('stuntman'),
    });
    mountDossier('harry');

    expect(screen.getByTestId('dossier')).toHaveTextContent('none');
    await waitFor(() => expect(screen.getByTestId('dossier')).toHaveTextContent('1,2,3'));
    expect(asked.filter((url) => url.includes('/dossier/harry.json'))).toHaveLength(1);
  });

  /* dev, or a deploy that never ran the build step: no panel, no error. */
  it('stays null on a 404 rather than failing the page', async () => {
    stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('nope', { status: 404, statusText: 'Not Found' })),
    );
    mountDossier('harry');
    await waitFor(() => expect(screen.getByTestId('dossier')).toHaveTextContent('none'));
  });

  it('ignores an embedded dossier that is not one, and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(
      () => json(makeCrawlers()),
      () => json(makeStatus()),
    );
    embed({
      route: '/crawlers/stuntman',
      show: makeShow(),
      crawlers: makeCrawlers(),
      status: null,
      dossier: { id: 'stuntman', updates: 'nope' },
    });
    mountDossier('stuntman');
    expect(screen.getByTestId('dossier')).toHaveTextContent('none');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

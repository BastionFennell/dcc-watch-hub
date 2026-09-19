// @vitest-environment jsdom
/**
 * The provider is the only React in `src/data` besides `ShowContext`; what it
 * owes the rest of the app is narrow (research R1): one fetch once the show is
 * there, `null` when the show declares no registry, and no crash when the file
 * is gone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ShowProvider } from './ShowContext';
import { RegistryProvider, useRegistry } from './RegistryContext';
import { makeRegistry, makeShow } from '../test/fixtures';

function stubFetch(registry: () => Response, show = makeShow()): string[] {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    if (url.includes('show.json')) {
      return Promise.resolve(
        new Response(JSON.stringify(show), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(registry());
  });
  return asked;
}

function okRegistry(): Response {
  return new Response(JSON.stringify(makeRegistry()), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function Probe() {
  const { registry, loading, error } = useRegistry();
  return (
    <ul>
      <li data-testid="loading">{String(loading)}</li>
      <li data-testid="error">{error === null ? 'none' : error.name}</li>
      <li data-testid="entities">{(registry?.entities ?? []).map((e) => e.id).join(',')}</li>
    </ul>
  );
}

function mount() {
  render(
    <ShowProvider>
      <RegistryProvider>
        <Probe />
      </RegistryProvider>
    </ShowProvider>,
  );
}

describe('RegistryProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the registry once the show has landed', async () => {
    const asked = stubFetch(okRegistry);
    mount();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('entities')).toHaveTextContent('hoarder,grull-rep,quartermaster');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(asked.filter((url) => url.includes('npcs.json'))).toHaveLength(1);
  });

  it('yields a null registry, and asks for nothing, when the show declares none', async () => {
    const { registryUrl: _registryUrl, ...show } = makeShow();
    const asked = stubFetch(okRegistry, show);
    mount();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('entities')).toBeEmptyDOMElement();
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(asked.some((url) => url.includes('npcs.json'))).toBe(false);
  });

  it('files the failure and leaves the registry null when the file is gone', async () => {
    stubFetch(() => new Response('gone', { status: 404, statusText: 'Not Found' }));
    mount();

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('DataError'));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('entities')).toBeEmptyDOMElement();
  });
});

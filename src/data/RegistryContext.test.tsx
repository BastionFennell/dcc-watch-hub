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
import { makeRegistry, makeShow, makeSpells } from '../test/fixtures';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * `spells` defaults to the fixture book; a test that cares about the spell
 * registry's own failure passes its own response (008 R4).
 */
function stubFetch(
  registry: () => Response,
  show = makeShow(),
  spells: () => Response = () => json(makeSpells()),
): string[] {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    if (url.includes('show.json')) return Promise.resolve(json(show));
    if (url.includes('spells.json')) return Promise.resolve(spells());
    return Promise.resolve(registry());
  });
  return asked;
}

function okRegistry(): Response {
  return json(makeRegistry());
}

function Probe() {
  const { registry, spells, loading, error } = useRegistry();
  return (
    <ul>
      <li data-testid="loading">{String(loading)}</li>
      <li data-testid="error">{error === null ? 'none' : error.name}</li>
      <li data-testid="entities">{(registry?.entities ?? []).map((e) => e.id).join(',')}</li>
      <li data-testid="spells">{(spells?.spells ?? []).map((s) => s.id).join(',')}</li>
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

  it('loads the spell registry beside it, once (008 R4)', async () => {
    const asked = stubFetch(okRegistry);
    mount();

    await waitFor(() =>
      expect(screen.getByTestId('spells')).toHaveTextContent('mending-light,cinder-snap'),
    );
    expect(asked.filter((url) => url.includes('spells.json'))).toHaveLength(1);
  });

  it('asks for no spells when the show declares no spellsUrl', async () => {
    const { spellsUrl: _spellsUrl, ...show } = makeShow();
    const asked = stubFetch(okRegistry, show);
    mount();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('spells')).toBeEmptyDOMElement();
    expect(asked.some((url) => url.includes('spells.json'))).toBe(false);
  });

  /*
   * The spell registry is a nice-to-have, not the page: its failure is warned
   * about and swallowed, and the entity registry beside it still lands (R4).
   */
  it('warns and carries on when the spell registry is gone', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(okRegistry, makeShow(), () => new Response('gone', { status: 404 }));
    mount();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('entities')).toHaveTextContent('hoarder,grull-rep,quartermaster');
    expect(screen.getByTestId('spells')).toBeEmptyDOMElement();
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(
      () => new Response('gone', { status: 404, statusText: 'Not Found' }),
      makeShow(),
      () => new Response('gone', { status: 404, statusText: 'Not Found' }),
    );
    mount();

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('DataError'));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('entities')).toBeEmptyDOMElement();
    warn.mockRestore();
  });
});

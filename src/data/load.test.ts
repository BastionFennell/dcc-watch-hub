import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRegistry, fetchSpells, joinBase } from './load';
import { DataError } from './validate';
import { makeRegistry, makeShow, makeSpells } from '../test/fixtures';

describe('joinBase', () => {
  it('leaves root-based deploys untouched', () => {
    expect(joinBase('/', '/data/ep1.json')).toBe('/data/ep1.json');
  });

  it('prefixes a sub-path deploy base', () => {
    expect(joinBase('/dcc-watch-hub/', '/data/ep1.json')).toBe('/dcc-watch-hub/data/ep1.json');
    expect(joinBase('/dcc-watch-hub', '/data/ep1.json')).toBe('/dcc-watch-hub/data/ep1.json');
  });

  it('leaves absolute URLs untouched', () => {
    expect(joinBase('/dcc-watch-hub/', 'https://cdn.example/data/ep1.json')).toBe(
      'https://cdn.example/data/ep1.json',
    );
  });

  it('leaves relative URLs untouched', () => {
    expect(joinBase('/dcc-watch-hub/', 'data/ep1.json')).toBe('data/ep1.json');
  });
});

describe('fetchRegistry', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(response: () => Response): string[] {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      asked.push(String(input));
      return Promise.resolve(response());
    });
    return asked;
  }

  function ok(body: unknown): () => Response {
    return () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
  }

  it('returns null, and fetches nothing, for a show with no registryUrl', async () => {
    const asked = stub(ok(makeRegistry()));
    const { registryUrl: _registryUrl, ...show } = makeShow();
    await expect(fetchRegistry(show)).resolves.toBeNull();
    await expect(fetchRegistry({ ...show, registryUrl: '' })).resolves.toBeNull();
    expect(asked).toEqual([]);
  });

  it('reads and normalizes the declared file', async () => {
    const asked = stub(ok(makeRegistry()));
    const registry = await fetchRegistry(makeShow());
    expect(registry?.entities.map((entity) => entity.id)).toEqual([
      'hoarder',
      'grull-rep',
      'quartermaster',
    ]);
    expect(asked).toEqual(['/data/npcs.json']);
  });

  it('resolves the leading slash against the deploy base', async () => {
    vi.stubEnv('BASE_URL', '/dcc-watch-hub/');
    const asked = stub(ok(makeRegistry()));
    await fetchRegistry(makeShow());
    expect(asked).toEqual(['/dcc-watch-hub/data/npcs.json']);
    vi.unstubAllEnvs();
  });

  it('throws DataError when the file is missing', async () => {
    stub(() => new Response('nope', { status: 404, statusText: 'Not Found' }));
    await expect(fetchRegistry(makeShow())).rejects.toBeInstanceOf(DataError);
  });

  it('throws DataError when the file is not a registry', async () => {
    stub(ok({ crawlers: [] }));
    await expect(fetchRegistry(makeShow())).rejects.toBeInstanceOf(DataError);
  });
});

describe('fetchSpells (008 revision 4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(response: () => Response): string[] {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      asked.push(String(input));
      return Promise.resolve(response());
    });
    return asked;
  }

  function ok(body: unknown): () => Response {
    return () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
  }

  it('returns null, and fetches nothing, for a show with no spellsUrl', async () => {
    const asked = stub(ok(makeSpells()));
    const { spellsUrl: _spellsUrl, ...show } = makeShow();
    await expect(fetchSpells(show)).resolves.toBeNull();
    await expect(fetchSpells({ ...show, spellsUrl: '' })).resolves.toBeNull();
    expect(asked).toEqual([]);
  });

  it('reads and validates the declared file, against the deploy base', async () => {
    vi.stubEnv('BASE_URL', '/dcc-watch-hub/');
    const asked = stub(ok(makeSpells()));
    const spells = await fetchSpells(makeShow());
    expect(spells?.spells.map((spell) => spell.id)).toEqual(['mending-light', 'cinder-snap']);
    expect(asked).toEqual(['/dcc-watch-hub/data/spells.json']);
    vi.unstubAllEnvs();
  });

  it('throws DataError when the file is missing or is not a spell registry', async () => {
    stub(() => new Response('nope', { status: 404, statusText: 'Not Found' }));
    await expect(fetchSpells(makeShow())).rejects.toBeInstanceOf(DataError);
    stub(ok({ entities: [] }));
    await expect(fetchSpells(makeShow())).rejects.toBeInstanceOf(DataError);
  });
});

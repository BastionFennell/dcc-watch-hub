import { describe, expect, it } from 'vitest';
import { createResumeStore, resumeKey } from './resume';

/** A `Storage` that lives in a Map — no jsdom, no globals. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

/** Private mode: every method throws, and the store must swallow all of it. */
function throwingStorage(): Storage {
  const boom = (): never => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return {
    get length(): number {
      return boom();
    },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  };
}

describe('resumeKey', () => {
  it('namespaces one key per episode', () => {
    expect(resumeKey(1)).toBe('dcc-watch-hub:resume:v1:1');
    expect(resumeKey(2)).not.toBe(resumeKey(1));
  });
});

describe('createResumeStore', () => {
  it('round-trips a position and stores nothing but the record', () => {
    const storage = memoryStorage();
    const store = createResumeStore(storage);

    store.save(1, 120);
    const record = store.load(1);

    expect(record).toMatchObject({ episodeId: 1, t: 120 });
    expect(typeof record?.savedAt).toBe('string');
    expect(Object.keys(JSON.parse(storage.getItem(resumeKey(1)) ?? '{}')).sort()).toEqual([
      'episodeId',
      'savedAt',
      't',
    ]);
  });

  it('keeps positions per episode', () => {
    const store = createResumeStore(memoryStorage());
    store.save(1, 120);
    expect(store.load(2)).toBeNull();
  });

  it('returns null for a missing key', () => {
    expect(createResumeStore(memoryStorage()).load(1)).toBeNull();
  });

  it('returns null for unparsable JSON', () => {
    const store = createResumeStore(memoryStorage({ [resumeKey(1)]: 'not json {' }));
    expect(store.load(1)).toBeNull();
  });

  it.each([
    ['a mismatched episodeId', { episodeId: 2, t: 30, savedAt: '2026-09-15T00:00:00.000Z' }],
    ['a negative t', { episodeId: 1, t: -1, savedAt: '2026-09-15T00:00:00.000Z' }],
    ['a non-finite t', { episodeId: 1, t: 'soon', savedAt: '2026-09-15T00:00:00.000Z' }],
    ['a missing savedAt', { episodeId: 1, t: 30 }],
    ['an array', [1, 2, 3]],
  ])('returns null for %s', (_label, value) => {
    const store = createResumeStore(memoryStorage({ [resumeKey(1)]: JSON.stringify(value) }));
    expect(store.load(1)).toBeNull();
  });

  it('ignores a negative or non-finite save', () => {
    const storage = memoryStorage();
    const store = createResumeStore(storage);
    store.save(1, -5);
    store.save(1, Number.NaN);
    expect(storage.getItem(resumeKey(1))).toBeNull();
  });

  it('clears one episode and leaves the others alone', () => {
    const store = createResumeStore(memoryStorage());
    store.save(1, 120);
    store.save(2, 45);

    store.clear(1);

    expect(store.load(1)).toBeNull();
    expect(store.load(2)).toMatchObject({ t: 45 });
  });

  it('never throws when storage does', () => {
    const store = createResumeStore(throwingStorage());
    expect(() => store.save(1, 120)).not.toThrow();
    expect(() => store.clear(1)).not.toThrow();
    expect(store.load(1)).toBeNull();
  });
});

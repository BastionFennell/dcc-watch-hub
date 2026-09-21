import { describe, expect, it } from 'vitest';
import type { DraftMeta, StudioDraft } from './draft';
import { newDraft } from './draft';
import {
  INDEX_KEY,
  deleteDraft,
  draftKey,
  listDrafts,
  loadDraft,
  saveDraft,
  storageAvailable,
} from './storage';

const META: DraftMeta = {
  id: 1,
  title: 'Episode 1',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 1,
  durationSec: 240,
};

/** A `Storage` in a Map - no jsdom, no globals (the pattern `resume.test` uses). */
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

function throwingStorage(error: unknown): Storage {
  const boom = (): never => {
    throw error;
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

function draftAt(id: number, updatedAt: string, events = 0): StudioDraft {
  const draft = newDraft({ ...META, id, title: `Episode ${id}` });
  return {
    ...draft,
    updatedAt,
    events: Array.from({ length: events }, (_, index) => ({
      uid: `u${index}`,
      event: { t: index, type: 'note', text: 'x' },
    })),
  };
}

describe('keys', () => {
  it('lives under the dcc.studio.v1 prefix', () => {
    expect(INDEX_KEY).toBe('dcc.studio.v1.index');
    expect(draftKey(7)).toBe('dcc.studio.v1.draft.7');
  });
});

describe('saveDraft / loadDraft', () => {
  it('round-trips a draft and indexes it', () => {
    const store = memoryStorage();
    const draft = draftAt(1, '2026-09-20T00:00:00.000Z', 2);
    expect(saveDraft(draft, store)).toEqual({ ok: true });
    expect(loadDraft(1, store)).toEqual(draft);
    expect(listDrafts(store)).toEqual([
      { id: 1, title: 'Episode 1', updatedAt: '2026-09-20T00:00:00.000Z', events: 2 },
    ]);
  });

  it('replaces the index row rather than adding a second', () => {
    const store = memoryStorage();
    saveDraft(draftAt(1, '2026-09-20T00:00:00.000Z'), store);
    saveDraft(draftAt(1, '2026-09-20T01:00:00.000Z', 3), store);
    expect(listDrafts(store)).toEqual([
      { id: 1, title: 'Episode 1', updatedAt: '2026-09-20T01:00:00.000Z', events: 3 },
    ]);
  });

  it('lists newest first', () => {
    const store = memoryStorage();
    saveDraft(draftAt(1, '2026-09-20T00:00:00.000Z'), store);
    saveDraft(draftAt(2, '2026-09-21T00:00:00.000Z'), store);
    saveDraft(draftAt(3, '2026-09-19T00:00:00.000Z'), store);
    expect(listDrafts(store).map((summary) => summary.id)).toEqual([2, 1, 3]);
  });

  it('reads nothing for a draft that was never saved', () => {
    expect(loadDraft(9, memoryStorage())).toBeNull();
  });

  it('refuses a stored value that is not one of ours', () => {
    const store = memoryStorage({
      [draftKey(1)]: '{not json',
      [draftKey(2)]: '{"version":2}',
      [draftKey(3)]: '{"version":1,"meta":{},"events":[]}',
    });
    expect(loadDraft(1, store)).toBeNull();
    expect(loadDraft(2, store)).toBeNull();
    expect(loadDraft(3, store)).toBeNull();
  });

  it('survives an index that is not an array of summaries', () => {
    expect(listDrafts(memoryStorage({ [INDEX_KEY]: '"nope"' }))).toEqual([]);
    expect(listDrafts(memoryStorage({ [INDEX_KEY]: '[1, null, {"id":4}]' }))).toEqual([
      { id: 4, title: 'Episode 4', updatedAt: '', events: 0 },
    ]);
  });
});

describe('failure modes', () => {
  it('reports a full quota as quota', () => {
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    expect(saveDraft(draftAt(1, 'now'), throwingStorage(quota))).toEqual({
      ok: false,
      reason: 'quota',
    });
  });

  it('reports a locked-down storage as unavailable', () => {
    const insecure = new DOMException('The operation is insecure.', 'SecurityError');
    expect(saveDraft(draftAt(1, 'now'), throwingStorage(insecure))).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(listDrafts(throwingStorage(insecure))).toEqual([]);
    expect(loadDraft(1, throwingStorage(insecure))).toBeNull();
    expect(() => deleteDraft(1, throwingStorage(insecure))).not.toThrow();
    expect(storageAvailable(throwingStorage(insecure))).toBe(false);
  });

  it('reports a quota failure on the index too', () => {
    const store = memoryStorage();
    const real = store.setItem.bind(store);
    let calls = 0;
    store.setItem = (key: string, value: string) => {
      calls += 1;
      if (calls === 2) throw new DOMException('quota', 'QuotaExceededError');
      real(key, value);
    };
    expect(saveDraft(draftAt(1, 'now'), store)).toEqual({ ok: false, reason: 'quota' });
  });

  it('says a working storage is available', () => {
    expect(storageAvailable(memoryStorage())).toBe(true);
  });
});

describe('deleteDraft', () => {
  it('removes the draft and its row', () => {
    const store = memoryStorage();
    saveDraft(draftAt(1, '2026-09-20T00:00:00.000Z'), store);
    saveDraft(draftAt(2, '2026-09-20T00:00:00.000Z'), store);
    deleteDraft(1, store);
    expect(loadDraft(1, store)).toBeNull();
    expect(listDrafts(store).map((summary) => summary.id)).toEqual([2]);
  });
});

describe('no storage at all', () => {
  it('degrades to empty rather than throwing', () => {
    const none = undefined as unknown as Storage;
    // `globalThis.localStorage` does not exist in the node test environment.
    expect(listDrafts(none)).toEqual([]);
    expect(loadDraft(1, none)).toBeNull();
    expect(saveDraft(draftAt(1, 'now'), none)).toEqual({ ok: false, reason: 'unavailable' });
    expect(storageAvailable(none)).toBe(false);
    expect(() => deleteDraft(1, none)).not.toThrow();
  });
});

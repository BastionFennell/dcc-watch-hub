import { describe, expect, it, vi } from 'vitest';
import {
  draftFromEpisode,
  draftParty,
  emptyInitialState,
  findDraftEvent,
  newDraft,
  sortDraftEvents,
  toEpisodeData,
  toRawEvent,
  uid,
  withParty,
} from './draft';
import type { DraftEvent, DraftMeta } from './draft';

const META: DraftMeta = {
  id: 7,
  title: 'Episode 7 - The Stairwell',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 2,
  durationSec: 600,
};

describe('uid', () => {
  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });

  it('falls back to a counter when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {});
    try {
      const a = uid();
      const b = uid();
      expect(a).not.toBe(b);
      expect(a.startsWith('uid-')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to a counter when reading crypto throws', () => {
    vi.stubGlobal('crypto', {
      get randomUUID(): never {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    try {
      expect(uid().startsWith('uid-')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('newDraft', () => {
  it('starts empty, on the meta floor', () => {
    const draft = newDraft(META);
    expect(draft.version).toBe(1);
    expect(draft.meta).toEqual(META);
    expect(draft.events).toEqual([]);
    expect(draft.initialState).toEqual(emptyInitialState(2));
    expect(Number.isNaN(Date.parse(draft.updatedAt))).toBe(false);
  });

  it('takes an initial state when one is given', () => {
    const initialState = { party: [{ id: 'harry' }], map: { floor: 9 } };
    expect(newDraft(META, initialState).initialState).toBe(initialState);
  });

  it('copies the meta rather than aliasing it', () => {
    const meta = { ...META };
    const draft = newDraft(meta);
    meta.title = 'changed';
    expect(draft.meta.title).toBe(META.title);
  });
});

describe('draftFromEpisode', () => {
  const episode = {
    episodeId: 7,
    initialState: { party: [{ id: 'harry' }], map: { floor: 2 } },
    events: [
      { t: 30, type: 'note', text: 'second' },
      { t: 10, type: 'note', text: 'first' },
      'not an event',
      { type: 'note', text: 'no time' },
      { t: 30, type: 'note', text: 'third' },
    ],
  };

  it('keeps every well-formed event, sorted, ties in file order', () => {
    const draft = draftFromEpisode(META, episode);
    expect(draft.events.map((entry) => entry.event.text)).toEqual(['first', 'second', 'third']);
    expect(new Set(draft.events.map((entry) => entry.uid)).size).toBe(3);
  });

  it('carries the initial state verbatim', () => {
    expect(draftFromEpisode(META, episode).initialState).toBe(episode.initialState);
  });

  it('survives an envelope with nothing in it', () => {
    const draft = draftFromEpisode(META, null);
    expect(draft.events).toEqual([]);
    expect(draft.initialState).toEqual(emptyInitialState(2));
  });
});

describe('toRawEvent', () => {
  it('accepts a numeric string t', () => {
    expect(toRawEvent({ t: '15', type: 'note', text: 'x' })).toEqual({
      t: 15,
      type: 'note',
      text: 'x',
    });
  });

  it('rejects anything with no usable t or type', () => {
    expect(toRawEvent({ type: 'note' })).toBeNull();
    expect(toRawEvent({ t: 1 })).toBeNull();
    expect(toRawEvent({ t: 1, type: '' })).toBeNull();
    expect(toRawEvent([1, 2])).toBeNull();
    expect(toRawEvent(null)).toBeNull();
  });
});

describe('toEpisodeData', () => {
  it('is the raw envelope, events sorted', () => {
    const draft = draftFromEpisode(META, {
      initialState: { party: [] },
      events: [
        { t: 30, type: 'note', text: 'b' },
        { t: 10, type: 'note', text: 'a' },
      ],
    });
    expect(toEpisodeData(draft)).toEqual({
      episodeId: 7,
      initialState: { party: [] },
      events: [
        { t: 10, type: 'note', text: 'a' },
        { t: 30, type: 'note', text: 'b' },
      ],
    });
  });
});

describe('party helpers', () => {
  it('reads and replaces the party without losing the map', () => {
    const draft = newDraft(META, { party: [{ id: 'harry' }], map: { floor: 2 }, extra: 1 });
    expect(draftParty(draft)).toEqual([{ id: 'harry' }]);
    expect(withParty(draft.initialState, [{ id: 'mimi' }])).toEqual({
      party: [{ id: 'mimi' }],
      map: { floor: 2 },
      extra: 1,
    });
  });

  it('reads an empty party from a malformed initial state', () => {
    expect(draftParty(newDraft(META, 'nonsense'))).toEqual([]);
    expect(withParty(null, [])).toEqual({ party: [] });
  });
});

describe('sortDraftEvents and findDraftEvent', () => {
  const entries: DraftEvent[] = [
    { uid: 'c', event: { t: 5, type: 'note' } },
    { uid: 'a', event: { t: 1, type: 'note' } },
    { uid: 'b', event: { t: 5, type: 'note' } },
  ];

  it('is stable for equal times', () => {
    expect(sortDraftEvents(entries).map((entry) => entry.uid)).toEqual(['a', 'c', 'b']);
  });

  it('finds by uid', () => {
    const draft = { ...newDraft(META), events: entries };
    expect(findDraftEvent(draft, 'b')?.event.t).toBe(5);
    expect(findDraftEvent(draft, 'zz')).toBeUndefined();
  });
});

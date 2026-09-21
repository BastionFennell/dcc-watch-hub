import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftMeta, StudioDraft } from './draft';
import { newDraft } from './draft';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  historyReducer,
  initHistory,
  sameDraftValue,
} from './history';
import type { DraftHistory } from './history';

const META: DraftMeta = {
  id: 7,
  title: 'Episode 7',
  youtubeId: 'aqz-KE-bpKQ',
  floor: 2,
  durationSec: 600,
};

function start(): DraftHistory {
  return initHistory(newDraft(META, { party: [{ id: 'harry' }], map: { floor: 2 } }));
}

/** Every commit stamps `updatedAt`, so time has to move for the test to see it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T00:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

const times = (history: DraftHistory) => history.present.events.map((entry) => entry.event.t);
const uids = (history: DraftHistory) => history.present.events.map((entry) => entry.uid);

describe('addEvent', () => {
  it('keeps the list sorted by t, ties in insertion order', () => {
    let history = start();
    history = historyReducer(history, { kind: 'addEvent', event: { t: 30, type: 'note' }, uid: 'a' });
    history = historyReducer(history, { kind: 'addEvent', event: { t: 10, type: 'note' }, uid: 'b' });
    history = historyReducer(history, { kind: 'addEvent', event: { t: 30, type: 'note' }, uid: 'c' });
    expect(times(history)).toEqual([10, 30, 30]);
    expect(uids(history)).toEqual(['b', 'a', 'c']);
  });

  it('mints a uid when none is given', () => {
    const history = historyReducer(start(), { kind: 'addEvent', event: { t: 1, type: 'note' } });
    expect(history.present.events[0].uid).not.toBe('');
  });

  it('refreshes updatedAt', () => {
    const history = start();
    vi.setSystemTime(new Date('2026-09-20T01:00:00.000Z'));
    const next = historyReducer(history, { kind: 'addEvent', event: { t: 1, type: 'note' } });
    expect(next.present.updatedAt).toBe('2026-09-20T01:00:00.000Z');
    expect(next.present.updatedAt).not.toBe(history.present.updatedAt);
  });
});

describe('updateEvent', () => {
  it('replaces the payload and keeps the uid', () => {
    let history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note', text: 'a' },
      uid: 'x',
    });
    history = historyReducer(history, {
      kind: 'updateEvent',
      uid: 'x',
      event: { t: 10, type: 'note', text: 'b' },
    });
    expect(history.present.events).toEqual([{ uid: 'x', event: { t: 10, type: 'note', text: 'b' } }]);
  });

  it('re-sorts when the time changes, landing last among ties', () => {
    let history = start();
    history = historyReducer(history, { kind: 'addEvent', event: { t: 10, type: 'note' }, uid: 'a' });
    history = historyReducer(history, { kind: 'addEvent', event: { t: 30, type: 'note' }, uid: 'b' });
    history = historyReducer(history, {
      kind: 'updateEvent',
      uid: 'a',
      event: { t: 30, type: 'note' },
    });
    expect(uids(history)).toEqual(['b', 'a']);
  });

  it('is a no-op for an unknown uid or an identical payload', () => {
    const history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note', text: 'a' },
      uid: 'x',
    });
    expect(
      historyReducer(history, { kind: 'updateEvent', uid: 'zz', event: { t: 1, type: 'note' } }),
    ).toBe(history);
    expect(
      historyReducer(history, {
        kind: 'updateEvent',
        uid: 'x',
        event: { t: 10, type: 'note', text: 'a' },
      }),
    ).toBe(history);
  });
});

describe('retimeEvent', () => {
  it('moves the event and re-sorts', () => {
    let history = start();
    history = historyReducer(history, { kind: 'addEvent', event: { t: 10, type: 'note' }, uid: 'a' });
    history = historyReducer(history, { kind: 'addEvent', event: { t: 30, type: 'note' }, uid: 'b' });
    history = historyReducer(history, { kind: 'retimeEvent', uid: 'a', t: 40 });
    expect(times(history)).toEqual([30, 40]);
    expect(uids(history)).toEqual(['b', 'a']);
  });

  it('is a no-op at the same time or for an unknown uid', () => {
    const history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    expect(historyReducer(history, { kind: 'retimeEvent', uid: 'a', t: 10 })).toBe(history);
    expect(historyReducer(history, { kind: 'retimeEvent', uid: 'zz', t: 99 })).toBe(history);
  });
});

describe('duplicateEvent and removeEvent', () => {
  it('copies at a new time under a new uid', () => {
    let history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'loot', actor: 'harry', item: 'Crowbar' },
      uid: 'a',
    });
    history = historyReducer(history, {
      kind: 'duplicateEvent',
      uid: 'a',
      t: 50,
      newUid: 'a2',
    });
    expect(history.present.events.map((entry) => [entry.uid, entry.event.t])).toEqual([
      ['a', 10],
      ['a2', 50],
    ]);
    expect(history.present.events[1].event.item).toBe('Crowbar');
  });

  it('copies at the same time, right after the original', () => {
    let history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    history = historyReducer(history, { kind: 'duplicateEvent', uid: 'a', newUid: 'a2' });
    expect(uids(history)).toEqual(['a', 'a2']);
  });

  it('removes by uid and ignores an unknown one', () => {
    const history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    expect(historyReducer(history, { kind: 'removeEvent', uid: 'zz' })).toBe(history);
    expect(historyReducer(history, { kind: 'removeEvent', uid: 'a' }).present.events).toEqual([]);
    expect(historyReducer(history, { kind: 'duplicateEvent', uid: 'zz' })).toBe(history);
  });
});

describe('meta, party and initial state', () => {
  it('patches meta and ignores an identical patch', () => {
    const history = start();
    const next = historyReducer(history, { kind: 'setMeta', meta: { durationSec: 900 } });
    expect(next.present.meta).toEqual({ ...META, durationSec: 900 });
    expect(historyReducer(next, { kind: 'setMeta', meta: { durationSec: 900 } })).toBe(next);
    expect(historyReducer(next, { kind: 'setMeta', meta: {} })).toBe(next);
  });

  it('replaces the party and keeps the rest of the initial state', () => {
    const history = start();
    const next = historyReducer(history, { kind: 'setParty', party: [{ id: 'mimi' }] });
    expect(next.present.initialState).toEqual({ party: [{ id: 'mimi' }], map: { floor: 2 } });
    expect(historyReducer(next, { kind: 'setParty', party: [{ id: 'mimi' }] })).toBe(next);
  });

  it('replaces the whole initial state', () => {
    const history = start();
    const next = historyReducer(history, {
      kind: 'setInitialState',
      initialState: { party: [], map: { floor: 9 } },
    });
    expect(next.present.initialState).toEqual({ party: [], map: { floor: 9 } });
    expect(
      historyReducer(next, { kind: 'setInitialState', initialState: { party: [], map: { floor: 9 } } }),
    ).toBe(next);
  });
});

describe('undo and redo', () => {
  it('returns to the exact prior draft and back again', () => {
    const history = start();
    const before = history.present;
    const added = historyReducer(history, {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    const undone = historyReducer(added, { kind: 'undo' });
    expect(undone.present).toEqual(before);
    expect(canUndo(undone)).toBe(false);
    expect(canRedo(undone)).toBe(true);

    const redone = historyReducer(undone, { kind: 'redo' });
    expect(redone.present).toEqual(added.present);
    expect(canRedo(redone)).toBe(false);
  });

  it('is a no-op at either end', () => {
    const history = start();
    expect(historyReducer(history, { kind: 'undo' })).toBe(history);
    expect(historyReducer(history, { kind: 'redo' })).toBe(history);
  });

  it('drops the redo branch once a new edit lands', () => {
    let history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    history = historyReducer(history, { kind: 'undo' });
    expect(canRedo(history)).toBe(true);
    history = historyReducer(history, { kind: 'addEvent', event: { t: 20, type: 'note' }, uid: 'b' });
    expect(canRedo(history)).toBe(false);
    expect(uids(history)).toEqual(['b']);
  });

  it('caps the past at 100 steps', () => {
    let history = start();
    for (let i = 0; i < HISTORY_LIMIT + 25; i += 1) {
      history = historyReducer(history, {
        kind: 'addEvent',
        event: { t: i, type: 'note' },
        uid: `u${i}`,
      });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.present.events).toHaveLength(HISTORY_LIMIT + 25);
    // The oldest step fell off the bottom: the first undo cannot reach t = 0.
    expect(history.past[0].events[0].event.t).toBe(0);
    expect(history.past[0].events).toHaveLength(25);
  });

  it('no-op actions never push a step', () => {
    const history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    const after = historyReducer(history, { kind: 'removeEvent', uid: 'zz' });
    expect(after).toBe(history);
    expect(after.past).toHaveLength(1);
  });
});

describe('replaceDraft', () => {
  it('becomes the present and clears the stack', () => {
    let history = historyReducer(start(), {
      kind: 'addEvent',
      event: { t: 10, type: 'note' },
      uid: 'a',
    });
    history = historyReducer(history, { kind: 'undo' });
    const loaded: StudioDraft = newDraft({ ...META, id: 9 });
    const next = historyReducer(history, { kind: 'replaceDraft', draft: loaded });
    expect(next.present).toBe(loaded);
    expect(next.past).toEqual([]);
    expect(next.future).toEqual([]);
  });
});

describe('sameDraftValue', () => {
  it('compares JSON shapes structurally', () => {
    expect(sameDraftValue({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(sameDraftValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameDraftValue([1, 2], [2, 1])).toBe(false);
    expect(sameDraftValue(null, {})).toBe(false);
    expect(sameDraftValue(null, null)).toBe(true);
    expect(sameDraftValue('x', 1)).toBe(false);
  });
});

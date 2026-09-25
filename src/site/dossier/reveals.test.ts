// @vitest-environment jsdom
/**
 * The reveal store (012). Two things are being proved: the state machine the
 * bulk control drives, and that a browser which refuses storage costs the
 * reader nothing but persistence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCKED,
  REVEALS_KEY,
  getLockedSnapshot,
  getReveals,
  hideAll,
  isRevealed,
  loadReveals,
  reveal,
  revealAll,
  saveReveals,
  subscribe,
} from './reveals';

beforeEach(() => {
  localStorage.clear();
  loadReveals();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('loadReveals', () => {
  it('starts with nothing revealed and no watermark', () => {
    expect(loadReveals()).toEqual({ v: 1, revealed: {}, caughtUpThrough: 0 });
  });

  it('reads back exactly what was saved', () => {
    saveReveals({ v: 1, revealed: { harry: [1, 3] }, caughtUpThrough: 2 });
    expect(loadReveals()).toEqual({ v: 1, revealed: { harry: [1, 3] }, caughtUpThrough: 2 });
  });

  it('survives a value that is not JSON, or not this shape', () => {
    localStorage.setItem(REVEALS_KEY, 'not json');
    expect(loadReveals().revealed).toEqual({});
    localStorage.setItem(REVEALS_KEY, '[1,2,3]');
    expect(loadReveals().revealed).toEqual({});
    localStorage.setItem(REVEALS_KEY, '{"revealed":{"harry":"nope"},"caughtUpThrough":"x"}');
    expect(loadReveals()).toEqual({ v: 1, revealed: {}, caughtUpThrough: 0 });
  });

  it('sorts and dedupes the episodes it reads', () => {
    localStorage.setItem(REVEALS_KEY, '{"v":1,"revealed":{"harry":[3,1,3]},"caughtUpThrough":0}');
    expect(loadReveals().revealed.harry).toEqual([1, 3]);
  });
});

describe('isRevealed', () => {
  it('is true for a card on the crawler s own list', () => {
    const state = reveal(loadReveals(), 'harry', 4);
    expect(isRevealed(state, 'harry', 4)).toBe(true);
    expect(isRevealed(state, 'harry', 5)).toBe(false);
    expect(isRevealed(state, 'mimi', 4)).toBe(false);
  });

  it('is true for anything at or below the watermark, for every crawler', () => {
    const state = revealAll(loadReveals(), 'harry', 7);
    expect(isRevealed(state, 'harry', 7)).toBe(true);
    expect(isRevealed(state, 'mimi', 7)).toBe(true);
    expect(isRevealed(state, 'veil', 8)).toBe(false);
  });
});

describe('the mutators', () => {
  it('reveal is idempotent and keeps the list ascending', () => {
    let state = reveal(loadReveals(), 'harry', 3);
    state = reveal(state, 'harry', 1);
    const same = reveal(state, 'harry', 1);
    expect(state.revealed.harry).toEqual([1, 3]);
    expect(same).toBe(state);
  });

  it('reveal leaves the previous state alone', () => {
    const before = loadReveals();
    reveal(before, 'harry', 1);
    expect(before.revealed.harry).toBeUndefined();
  });

  it('revealAll raises the watermark and never lowers it', () => {
    let state = revealAll(loadReveals(), 'harry', 7);
    expect(state.caughtUpThrough).toBe(7);
    state = revealAll(state, 'mimi', 3);
    expect(state.caughtUpThrough).toBe(7);
  });

  it('hideAll clears that crawler and drops the watermark to zero', () => {
    let state = reveal(loadReveals(), 'harry', 2);
    state = reveal(state, 'mimi', 5);
    state = revealAll(state, 'harry', 9);
    state = hideAll(state, 'harry');

    expect(state.caughtUpThrough).toBe(0);
    expect(state.revealed.harry).toBeUndefined();
    expect(isRevealed(state, 'harry', 2)).toBe(false);
    // The other crawler's own clicks are not this button's business.
    expect(state.revealed.mimi).toEqual([5]);
  });
});

describe('persistence', () => {
  it('survives a reload: the key holds the whole state', () => {
    saveReveals(reveal(loadReveals(), 'harry', 2));
    const stored = JSON.parse(localStorage.getItem(REVEALS_KEY) ?? '{}') as unknown;
    expect(stored).toEqual({ v: 1, revealed: { harry: [2] }, caughtUpThrough: 0 });
  });

  it('carries the watermark across crawlers, which is what "caught up" means', () => {
    saveReveals(revealAll(loadReveals(), 'harry', 6));
    const reloaded = loadReveals();
    expect(isRevealed(reloaded, 'veil', 6)).toBe(true);
    expect(isRevealed(reloaded, 'veil', 7)).toBe(false);
  });

  it('falls back to memory when storage throws, without throwing itself', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const next = reveal(getReveals(), 'harry', 3);
    expect(() => {
      saveReveals(next);
    }).not.toThrow();
    // Nothing reached the disk, and the session kept its reveals anyway.
    expect(localStorage.getItem(REVEALS_KEY)).toBeNull();
    expect(isRevealed(getReveals(), 'harry', 3)).toBe(true);
  });

  it('reads empty rather than throwing when storage refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadReveals()).toEqual({ v: 1, revealed: {}, caughtUpThrough: 0 });
  });
});

describe('the store seam', () => {
  it('hands useSyncExternalStore one frozen, fully locked server snapshot', () => {
    expect(getLockedSnapshot()).toBe(LOCKED);
    expect(getLockedSnapshot()).toEqual({ v: 1, revealed: {}, caughtUpThrough: 0 });
    expect(Object.isFrozen(LOCKED)).toBe(true);
  });

  it('notifies subscribers on save, and stops when they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    saveReveals(reveal(getReveals(), 'harry', 1));
    expect(listener).toHaveBeenCalledTimes(1);
    // A new snapshot each time, so useSyncExternalStore re-renders.
    expect(getReveals().revealed.harry).toEqual([1]);

    unsubscribe();
    saveReveals(reveal(getReveals(), 'harry', 2));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
/**
 * The log's open preference (005 T502). A viewer preference, not overlay state
 * (constitution I), and it must never reach the viewer as an error.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOG_OPEN_KEY,
  createLogOpenStore,
  loadLogOpen,
  saveLogOpen,
} from './logOpen';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('logOpen', () => {
  it('round-trips the viewer’s choice through localStorage', () => {
    expect(loadLogOpen()).toBe(false);

    saveLogOpen(true);
    expect(localStorage.getItem(LOG_OPEN_KEY)).toBe('1');
    expect(loadLogOpen()).toBe(true);

    saveLogOpen(false);
    expect(localStorage.getItem(LOG_OPEN_KEY)).toBeNull();
    expect(loadLogOpen()).toBe(false);
  });

  it('uses the documented key', () => {
    expect(LOG_OPEN_KEY).toBe('dcc-watch-hub:prefs:v1:log-open');
  });

  it('reads a missing or unrecognized value as closed', () => {
    expect(loadLogOpen()).toBe(false);
    localStorage.setItem(LOG_OPEN_KEY, 'true');
    expect(loadLogOpen()).toBe(false);
    localStorage.setItem(LOG_OPEN_KEY, '');
    expect(loadLogOpen()).toBe(false);
  });

  it('stores nothing else: the value is the flag, not overlay state', () => {
    saveLogOpen(true);
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe(LOG_OPEN_KEY);
  });

  it('never throws when the store throws on read or write', () => {
    const throwing = {
      getItem() {
        throw new Error('storage disabled');
      },
      setItem() {
        throw new Error('storage disabled');
      },
      removeItem() {
        throw new Error('storage disabled');
      },
    } as unknown as Storage;
    const store = createLogOpenStore(throwing);

    expect(store.load()).toBe(false);
    expect(() => store.save(true)).not.toThrow();
    expect(() => store.save(false)).not.toThrow();
  });

  it('never throws when localStorage itself is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(loadLogOpen()).toBe(false);
    expect(() => saveLogOpen(true)).not.toThrow();
  });
});

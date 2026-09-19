// @vitest-environment jsdom
/**
 * T601 - `useIsPhone` (contracts/mobile.md "Hooks"): the phone breakpoint, and
 * the guard that keeps every existing (matchMedia-less) test on the desktop
 * tree (FR-505).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useIsPhone } from './useIsPhone';

/** jsdom has no `matchMedia`; this is the smallest stub the hook can use. */
function stubMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = [];
  const queries: string[] = [];
  const query = {
    matches,
    media: '(max-width: 900px)',
    addEventListener: (_: string, listener: () => void) => void listeners.push(listener),
    removeEventListener: (_: string, listener: () => void) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  vi.stubGlobal('matchMedia', (media: string) => {
    queries.push(media);
    return query;
  });
  return {
    queries,
    listenerCount: () => listeners.length,
    set(next: boolean) {
      query.matches = next;
      act(() => {
        for (const listener of [...listeners]) listener();
      });
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useIsPhone', () => {
  it('asks for the ≤ 900 px breakpoint and reports its answer', () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useIsPhone());

    expect(result.current).toBe(true);
    expect(media.queries).toContain('(max-width: 900px)');
  });

  it('is false on a desktop width', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });

  it('follows the query across a resize or a rotation', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);

    media.set(true);
    expect(result.current).toBe(true);

    media.set(false);
    expect(result.current).toBe(false);
  });

  it('drops its listener when it unmounts', () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useIsPhone());
    expect(media.listenerCount()).toBe(1);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('is false where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });

  it('is false where matchMedia throws', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('unsupported query');
    });
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });
});

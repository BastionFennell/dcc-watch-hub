// @vitest-environment jsdom
/**
 * T405 — `useShare` (FR-302/304, research R5). Fake timers, stubbed platform:
 * the hook's whole job is the URL, the status and the timer around them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { copy } from '../copy';
import type { ShareEnv } from './share';
import { SHARE_NOTICE_MS, useShare } from './useShare';

const ARGS = { episodeId: 1, episodeTitle: 'Episode 1 — The World Dungeon' };

function env(overrides: Partial<ShareEnv> = {}): ShareEnv {
  return {
    share: vi.fn().mockResolvedValue(undefined),
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    preferShare: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useShare', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useShare({ ...ARGS, env: env() }));
    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
  });

  it('copies the absolute moment URL and confirms for two seconds', async () => {
    const e = env();
    const { result } = renderHook(() => useShare({ ...ARGS, env: e }));

    await act(async () => {
      await result.current.share(156);
    });

    // jsdom's origin, with vitest's BASE_URL of "/".
    expect(e.clipboard?.writeText).toHaveBeenCalledWith('http://localhost:3000/ep/1?t=156');
    expect(result.current.status).toBe('copied');
    expect(result.current.url).toBe('http://localhost:3000/ep/1?t=156');

    act(() => void vi.advanceTimersByTime(SHARE_NOTICE_MS - 1));
    expect(result.current.status).toBe('copied');

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
  });

  it('floors the moment to a whole second', async () => {
    const e = env();
    const { result } = renderHook(() => useShare({ ...ARGS, env: e }));
    await act(async () => {
      await result.current.share(156.94);
    });
    expect(result.current.url).toBe('http://localhost:3000/ep/1?t=156');
  });

  it('hands the share sheet the episode title and the moment', async () => {
    const e = env({ preferShare: true });
    const { result } = renderHook(() => useShare({ ...ARGS, env: e }));

    await act(async () => {
      await result.current.share(156);
    });

    expect(e.share).toHaveBeenCalledWith({
      title: copy.shareTitle(ARGS.episodeTitle, '2:36'),
      url: 'http://localhost:3000/ep/1?t=156',
    });
    expect(result.current.status).toBe('shared');
  });

  it('says nothing when the share sheet is dismissed', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const e = env({ preferShare: true, share: vi.fn().mockRejectedValue(abort) });
    const { result } = renderHook(() => useShare({ ...ARGS, env: e }));

    await act(async () => {
      await result.current.share(156);
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
  });

  it('keeps the fallback notice up until it is dismissed (FR-304)', async () => {
    const e = env({ clipboard: undefined });
    const { result } = renderHook(() => useShare({ ...ARGS, env: e }));

    await act(async () => {
      await result.current.share(30);
    });
    expect(result.current.status).toBe('shown');
    expect(result.current.url).toBe('http://localhost:3000/ep/1?t=30');

    // The link is the only copy the viewer has: it does not evaporate.
    act(() => void vi.advanceTimersByTime(SHARE_NOTICE_MS * 5));
    expect(result.current.status).toBe('shown');

    act(() => result.current.dismiss());
    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
  });

  it('restarts the timer when a second moment is shared', async () => {
    const e = env();
    const { result } = renderHook(() => useShare({ ...ARGS, env: e }));

    await act(async () => {
      await result.current.share(10);
    });
    act(() => void vi.advanceTimersByTime(SHARE_NOTICE_MS - 100));
    expect(result.current.status).toBe('copied');

    await act(async () => {
      await result.current.share(20);
    });
    expect(result.current.url).toBe('http://localhost:3000/ep/1?t=20');

    // The first share's timer must not cut the second confirmation short.
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.status).toBe('copied');

    act(() => void vi.advanceTimersByTime(SHARE_NOTICE_MS));
    expect(result.current.status).toBe('idle');
  });

  it('drops its timer on unmount', async () => {
    const e = env();
    const { result, unmount } = renderHook(() => useShare({ ...ARGS, env: e }));
    await act(async () => {
      await result.current.share(10);
    });

    unmount();
    expect(() => vi.advanceTimersByTime(SHARE_NOTICE_MS * 2)).not.toThrow();
  });

  it('shares the episode the caller names', async () => {
    const e = env();
    const { result } = renderHook(() =>
      useShare({ episodeId: 3, episodeTitle: 'Episode 3 — Descent', env: e }),
    );
    await act(async () => {
      await result.current.share(0);
    });
    expect(result.current.url).toBe('http://localhost:3000/ep/3?t=0');
  });
});

// @vitest-environment jsdom
/**
 * T402 - `useDeepLink` (research R6). The source is a real `FakeTimeSource`
 * with a spy on `seek`, inside a `MemoryRouter` so `useLocation` is real; the
 * harness exposes `navigate` so a test can change the search the way the header
 * does, without remounting the hook.
 */
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import type { EpisodeMeta } from '../data/types';
import type { TimeSource } from './TimeSource';
import { FakeTimeSource } from './FakeTimeSource';
import { useDeepLink } from './useDeepLink';

const DURATION = 240;

function makeMeta(id = 1, durationSec = DURATION): EpisodeMeta {
  return {
    id,
    title: `Episode ${id}`,
    youtubeId: `yt-${id}`,
    floor: 1,
    durationSec,
    dataUrl: `/data/ep${id}.json`,
  };
}

interface Props {
  meta: EpisodeMeta | undefined;
  source: TimeSource | null;
}

function makeSource() {
  const source = new FakeTimeSource(0, DURATION);
  const seek = vi.spyOn(source, 'seek');
  return { source, seek };
}

function mount(entry: string, initialProps: Props) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  return renderHook(
    ({ meta, source }: Props) => {
      const navigate = useNavigate();
      return { ...useDeepLink(meta, source), navigate };
    },
    { initialProps, wrapper },
  );
}

describe('useDeepLink', () => {
  it('seeks to the linked moment exactly once', () => {
    const { source, seek } = makeSource();
    const { result, rerender } = mount('/ep/1?t=156', { meta: makeMeta(), source });

    expect(result.current.linkedT).toBe(156);
    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(156);
    expect(source.getTime()).toBe(156);

    rerender({ meta: makeMeta(), source });
    rerender({ meta: makeMeta(), source });
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it('reports the moment before the source exists and seeks when it arrives', () => {
    const { source, seek } = makeSource();
    const { result, rerender } = mount('/ep/1?t=156', { meta: makeMeta(), source: null });

    // The page needs `linkedT` on the first render to suppress the resume offer.
    expect(result.current.linkedT).toBe(156);
    expect(seek).not.toHaveBeenCalled();

    rerender({ meta: makeMeta(), source });
    expect(seek).toHaveBeenCalledTimes(1);
    expect(source.getTime()).toBe(156);
  });

  it('does not seek the viewer back after they scrub away', () => {
    const { source, seek } = makeSource();
    const { rerender } = mount('/ep/1?t=156', { meta: makeMeta(), source });
    expect(seek).toHaveBeenCalledTimes(1);

    act(() => source.set(30));
    rerender({ meta: makeMeta(), source });
    expect(source.getTime()).toBe(30);
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it('seeks again when the search changes', () => {
    const { source, seek } = makeSource();
    const { result } = mount('/ep/1?t=156', { meta: makeMeta(), source });
    expect(seek).toHaveBeenCalledTimes(1);

    act(() => void result.current.navigate('/ep/1?t=60'));
    expect(seek).toHaveBeenCalledTimes(2);
    expect(seek).toHaveBeenLastCalledWith(60);
    expect(source.getTime()).toBe(60);
  });

  it('seeks again for another episode', () => {
    const { source, seek } = makeSource();
    const { rerender } = mount('/ep/1?t=156', { meta: makeMeta(1), source });
    expect(seek).toHaveBeenCalledTimes(1);

    // Same search, new episode: a different visit, so the link applies again.
    rerender({ meta: makeMeta(2), source });
    expect(seek).toHaveBeenCalledTimes(2);
    expect(seek).toHaveBeenLastCalledWith(156);
  });

  it('ignores an invalid moment', () => {
    for (const entry of ['/ep/1?t=abc', '/ep/1?t=-5', '/ep/1?t=99999', '/ep/1', '/ep/1?fake=1']) {
      const { source, seek } = makeSource();
      const { result, unmount } = mount(entry, { meta: makeMeta(), source });
      expect(result.current.linkedT).toBeNull();
      expect(seek).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('does nothing without an episode', () => {
    const { source, seek } = makeSource();
    const { result } = mount('/ep/1?t=156', { meta: undefined, source });
    expect(result.current.linkedT).toBeNull();
    expect(seek).not.toHaveBeenCalled();
  });

  it('survives a host that refuses the seek', () => {
    const source = new FakeTimeSource(0, DURATION);
    const seek = vi.spyOn(source, 'seek').mockImplementation(() => {
      throw new Error('player not ready');
    });
    const { result } = mount('/ep/1?t=156', { meta: makeMeta(), source });
    expect(seek).toHaveBeenCalledTimes(1);
    expect(result.current.linkedT).toBe(156);
  });
});

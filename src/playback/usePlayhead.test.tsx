// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { FakeTimeSource } from './FakeTimeSource';
import { usePlayhead } from './usePlayhead';

describe('usePlayhead', () => {
  it('tracks ticks, play, pause, and the ended state', () => {
    const source = new FakeTimeSource(0, 240);
    const { result } = renderHook(() => usePlayhead(source));
    expect(result.current).toEqual({ t: 0, playing: false, ended: false });

    act(() => source.set(42));
    expect(result.current.t).toBe(42);

    act(() => source.end());
    expect(result.current.ended).toBe(true);
    expect(result.current.t).toBe(240);
    source.destroy();
  });

  it('leaves the ended state as soon as the playhead moves again', () => {
    const source = new FakeTimeSource(0, 240);
    const { result } = renderHook(() => usePlayhead(source));

    act(() => source.end());
    expect(result.current.ended).toBe(true);

    act(() => source.seek(30));
    expect(result.current).toMatchObject({ t: 30, ended: false });
    source.destroy();
  });
});

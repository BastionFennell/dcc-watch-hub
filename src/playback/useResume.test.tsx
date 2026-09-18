// @vitest-environment jsdom
/**
 * T127 - useResume (US3, FR-130..FR-133, contracts/resume-storage.md).
 *
 * The playhead is driven the realistic way: a real `FakeTimeSource` feeding
 * `usePlayhead` inside a small harness hook, so `set` / `play` / `pause` /
 * `end` produce the same `Playhead` the page sees. The store is an in-memory
 * `Map` behind `vi.fn()` spies (or a store whose every method throws).
 *
 * Save cadence is wall-clock, not timer, based: the tests freeze `Date.now()`
 * with `vi.setSystemTime` and never advance the fake interval, so every tick is
 * explicit.
 */
import { act, renderHook } from '@testing-library/react';
import type { EpisodeMeta } from '../data/types';
import type { TimeSource } from './TimeSource';
import type { ResumeRecord, ResumeStore } from './resume';
import { FakeTimeSource } from './FakeTimeSource';
import { usePlayhead } from './usePlayhead';
import { RESUME_SAVE_INTERVAL_MS, useResume } from './useResume';

const DURATION = 600;
const T0 = new Date('2026-09-15T12:00:00.000Z').getTime();

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

interface SpyStore extends ResumeStore {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  records: Map<number, ResumeRecord>;
}

function makeStore(seed: Array<[number, number]> = []): SpyStore {
  const records = new Map<number, ResumeRecord>();
  for (const [episodeId, t] of seed) {
    records.set(episodeId, { episodeId, t, savedAt: new Date(T0).toISOString() });
  }
  return {
    records,
    load: vi.fn((episodeId: number) => records.get(episodeId) ?? null),
    save: vi.fn((episodeId: number, t: number) => {
      records.set(episodeId, { episodeId, t, savedAt: new Date().toISOString() });
    }),
    clear: vi.fn((episodeId: number) => {
      records.delete(episodeId);
    }),
  };
}

const throwingStore: ResumeStore = {
  load() {
    throw new Error('storage blocked');
  },
  save() {
    throw new Error('storage blocked');
  },
  clear() {
    throw new Error('storage blocked');
  },
};

interface HarnessProps {
  meta: EpisodeMeta;
  source: TimeSource | null;
}

/** Mount `useResume` with a real playhead behind it. */
function mount(store: ResumeStore, props: HarnessProps) {
  return renderHook(
    ({ meta, source }: HarnessProps) => {
      const playhead = usePlayhead(source);
      return { playhead, resume: useResume(meta, source, playhead, store) };
    },
    { initialProps: props },
  );
}

function savesFor(store: SpyStore): Array<[number, number]> {
  return store.save.mock.calls.map((call) => [call[0] as number, call[1] as number]);
}

describe('useResume', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /* ------------------------------------------------------- offer thresholds */

  describe('the offer', () => {
    function pendingFor(savedT: number, durationSec = DURATION) {
      const store = makeStore([[1, savedT]]);
      const source = new FakeTimeSource(0, durationSec);
      const { result, unmount } = mount(store, { meta: makeMeta(1, durationSec), source });
      const pending = result.current.resume.pending;
      unmount();
      source.destroy();
      return pending;
    }

    it('is withheld below 30 s', () => {
      expect(pendingFor(29)).toBeNull();
    });

    it('is offered at exactly 30 s', () => {
      expect(pendingFor(30)).toEqual({ t: 30 });
    });

    it('is offered mid-episode', () => {
      expect(pendingFor(120)).toEqual({ t: 120 });
    });

    it('is withheld inside the last 30 s', () => {
      expect(pendingFor(DURATION - 29)).toBeNull();
    });

    it('is withheld when the saved time is past the duration (data changed)', () => {
      expect(pendingFor(DURATION + 45)).toBeNull();
    });

    it('is withheld when nothing is stored', () => {
      const store = makeStore();
      const source = new FakeTimeSource(0, DURATION);
      const { result, unmount } = mount(store, { meta: makeMeta(), source });
      expect(result.current.resume.pending).toBeNull();
      expect(store.load).toHaveBeenCalledWith(1);
      unmount();
      source.destroy();
    });
  });

  it('does nothing until an episode exists', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore([[1, 120]]);
    const source = new FakeTimeSource(0, DURATION);
    const { result, rerender, unmount } = renderHook(
      ({ meta }: { meta: EpisodeMeta | undefined }) => {
        const playhead = usePlayhead(source);
        return useResume(meta, source, playhead, store);
      },
      { initialProps: { meta: undefined as EpisodeMeta | undefined } },
    );

    act(() => source.play());
    act(() => source.set(40));
    expect(result.current.pending).toBeNull();
    expect(store.load).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();

    // The meta lands (the show JSON resolved): the offer appears.
    act(() => source.set(0));
    rerender({ meta: makeMeta(1) });
    expect(result.current.pending).toEqual({ t: 120 });

    unmount();
    source.destroy();
  });

  /* ------------------------------------------------------------ save cadence */

  it('saves at most once every 5 s while playing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(10));
    expect(savesFor(store)).toEqual([[1, 10]]);

    act(() => source.set(12));
    act(() => source.set(14));
    expect(savesFor(store)).toEqual([[1, 10]]);

    vi.setSystemTime(T0 + 5_000);
    act(() => source.set(20));
    expect(savesFor(store)).toEqual([
      [1, 10],
      [1, 20],
    ]);

    unmount();
    source.destroy();
  });

  it('never saves a playhead under 1 s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(0.5));
    act(() => source.pause());
    expect(store.save).not.toHaveBeenCalled();

    unmount();
    expect(store.save).not.toHaveBeenCalled();
    source.destroy();
  });

  it('saves immediately on pause', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(10));
    act(() => source.set(12));
    expect(savesFor(store)).toEqual([[1, 10]]);

    act(() => source.pause());
    expect(savesFor(store)).toEqual([
      [1, 10],
      [1, 12],
    ]);

    unmount();
    source.destroy();
  });

  it('saves on pagehide', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(10));
    act(() => source.set(42));
    expect(savesFor(store)).toEqual([[1, 10]]);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(savesFor(store)).toEqual([
      [1, 10],
      [1, 42],
    ]);

    unmount();
    source.destroy();
  });

  it('saves when the page is hidden', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.set(77));

    // Visible: a visibilitychange must not write.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(store.save).not.toHaveBeenCalled();

    // jsdom keeps `visibilityState` on Document.prototype; shadow it, then remove.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(savesFor(store)).toEqual([[1, 77]]);
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
    }

    unmount();
    source.destroy();
  });

  it('saves the latest position on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.set(64));
    unmount();
    expect(savesFor(store)).toEqual([[1, 64]]);
    source.destroy();
  });

  /* ----------------------------------------------------------------- clears */

  it('clears the record when playback ends', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(100));
    expect(store.records.get(1)?.t).toBe(100);
    store.save.mockClear();

    act(() => source.end());
    expect(store.clear).toHaveBeenCalledWith(1);
    expect(store.records.has(1)).toBe(false);

    unmount();
    expect(store.save).not.toHaveBeenCalled();
    source.destroy();
  });

  it('clears the record inside the last 30 s and stops saving there', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore();
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(DURATION - 30));
    expect(store.clear).toHaveBeenCalledWith(1);
    expect(store.save).not.toHaveBeenCalled();

    vi.setSystemTime(T0 + 60_000);
    act(() => source.set(DURATION - 10));
    expect(store.save).not.toHaveBeenCalled();
    expect(store.clear).toHaveBeenCalledTimes(1);

    // Seeking back out of the tail makes the position worth keeping again.
    act(() => source.set(100));
    expect(savesFor(store)).toEqual([[1, 100]]);

    unmount();
    source.destroy();
  });

  /* ------------------------------------------------------ resolving the offer */

  it('seeks to the saved time on rejoin and drops the offer', () => {
    const store = makeStore([[1, 120]]);
    const source = new FakeTimeSource(0, DURATION);
    const { result, unmount } = mount(store, { meta: makeMeta(), source });

    expect(result.current.resume.pending).toEqual({ t: 120 });
    act(() => result.current.resume.rejoin());

    expect(source.getTime()).toBe(120);
    expect(result.current.playhead.t).toBe(120);
    expect(result.current.resume.pending).toBeNull();
    expect(store.clear).not.toHaveBeenCalled();

    unmount();
    source.destroy();
  });

  it('holds the seek until a source arrives', () => {
    const store = makeStore([[1, 120]]);
    const { result, rerender, unmount } = mount(store, { meta: makeMeta(), source: null });

    expect(result.current.resume.pending).toEqual({ t: 120 });
    act(() => result.current.resume.rejoin());
    expect(result.current.resume.pending).toBeNull();

    const source = new FakeTimeSource(0, DURATION);
    rerender({ meta: makeMeta(), source });
    expect(source.getTime()).toBe(120);
    expect(result.current.playhead.t).toBe(120);

    unmount();
    source.destroy();
  });

  it('clears the record on start over', () => {
    const store = makeStore([[1, 120]]);
    const source = new FakeTimeSource(0, DURATION);
    const { result, unmount } = mount(store, { meta: makeMeta(), source });

    act(() => result.current.resume.startOver());

    expect(store.clear).toHaveBeenCalledWith(1);
    expect(store.records.has(1)).toBe(false);
    expect(result.current.resume.pending).toBeNull();
    expect(source.getTime()).toBe(0);

    unmount();
    source.destroy();
  });

  it('drops an unanswered offer once the broadcast runs past 5 s, keeping the record', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore([[1, 120]]);
    const source = new FakeTimeSource(0, DURATION);
    const { result, unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(3));
    expect(result.current.resume.pending).toEqual({ t: 120 });
    expect(store.save).not.toHaveBeenCalled();

    act(() => source.set(6));
    expect(result.current.resume.pending).toBeNull();
    expect(store.clear).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(store.records.get(1)?.t).toBe(120);

    // Saving resumes on the next tick, now that the offer is answered.
    act(() => source.set(8));
    expect(savesFor(store)).toEqual([[1, 8]]);

    unmount();
    source.destroy();
  });

  it('never saves while the offer is unanswered', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore([[1, 120]]);
    const source = new FakeTimeSource(0, DURATION);
    const { unmount } = mount(store, { meta: makeMeta(), source });

    act(() => source.play());
    act(() => source.set(2));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    act(() => source.pause());
    expect(store.save).not.toHaveBeenCalled();

    unmount();
    expect(store.save).not.toHaveBeenCalled();
    source.destroy();
  });

  /* --------------------------------------------------------- storage failure */

  it('survives a store that throws on every call', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const source = new FakeTimeSource(0, DURATION);
    const { result, unmount } = mount(throwingStore, { meta: makeMeta(), source });

    expect(result.current.resume.pending).toBeNull();

    expect(() => {
      act(() => source.play());
      act(() => source.set(40));
      act(() => source.pause());
      act(() => {
        window.dispatchEvent(new Event('pagehide'));
      });
      act(() => result.current.resume.startOver());
      act(() => result.current.resume.rejoin());
      act(() => source.end());
    }).not.toThrow();

    expect(result.current.resume.pending).toBeNull();
    expect(() => unmount()).not.toThrow();
    source.destroy();
  });

  /* ------------------------------------------------------------ episode change */

  it('saves the outgoing episode and loads the incoming one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    const store = makeStore([[2, 200]]);
    const first = new FakeTimeSource(0, DURATION);
    const { result, rerender, unmount } = mount(store, { meta: makeMeta(1), source: first });

    act(() => first.play());
    act(() => first.set(40));
    act(() => first.set(50));
    expect(savesFor(store)).toEqual([[1, 40]]);

    const second = new FakeTimeSource(0, DURATION);
    rerender({ meta: makeMeta(2), source: second });

    expect(savesFor(store)).toEqual([
      [1, 40],
      [1, 50],
    ]);
    expect(store.load).toHaveBeenCalledWith(2);
    expect(result.current.resume.pending).toEqual({ t: 200 });

    unmount();
    first.destroy();
    second.destroy();
  });

  /* ------------------------------------- 004 US1: a deep link wins this visit */

  describe('suppressOffer (004 FR-301)', () => {
    interface SuppressProps extends HarnessProps {
      suppressOffer: boolean;
    }

    function mountSuppressed(store: ResumeStore, props: SuppressProps) {
      return renderHook(
        ({ meta, source, suppressOffer }: SuppressProps) => {
          const playhead = usePlayhead(source);
          return {
            playhead,
            resume: useResume(meta, source, playhead, store, { suppressOffer }),
          };
        },
        { initialProps: props },
      );
    }

    it('never offers, and never even reads the record', () => {
      const store = makeStore([[1, 120]]);
      const source = new FakeTimeSource(0, DURATION);
      const { result, unmount } = mountSuppressed(store, {
        meta: makeMeta(),
        source,
        suppressOffer: true,
      });

      expect(result.current.resume.pending).toBeNull();
      expect(store.load).not.toHaveBeenCalled();
      expect(store.save).not.toHaveBeenCalled();
      expect(store.clear).not.toHaveBeenCalled();
      expect(store.records.get(1)?.t).toBe(120);

      unmount();
      source.destroy();
    });

    it('still offers when the flag is off (the ordinary visit)', () => {
      const store = makeStore([[1, 120]]);
      const source = new FakeTimeSource(0, DURATION);
      const { result, unmount } = mountSuppressed(store, {
        meta: makeMeta(),
        source,
        suppressOffer: false,
      });

      expect(result.current.resume.pending).toEqual({ t: 120 });
      unmount();
      source.destroy();
    });

    it('keeps saving as normal, so the next plain visit resumes from here', () => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      const store = makeStore([[1, 120]]);
      const source = new FakeTimeSource(0, DURATION);
      const { unmount } = mountSuppressed(store, {
        meta: makeMeta(),
        source,
        suppressOffer: true,
      });

      // The deep link put the playhead at 2:36 and playback carried on.
      act(() => source.set(156));
      act(() => source.play());
      act(() => source.set(157)); // inside the 5 s throttle: no second write
      expect(savesFor(store)).toEqual([[1, 156]]);

      vi.setSystemTime(T0 + RESUME_SAVE_INTERVAL_MS);
      act(() => source.set(162));
      expect(savesFor(store)).toEqual([
        [1, 156],
        [1, 162],
      ]);

      unmount();
      source.destroy();
    });

    it('still clears a finished episode', () => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      const store = makeStore([[1, 120]]);
      const source = new FakeTimeSource(0, DURATION);
      const { unmount } = mountSuppressed(store, {
        meta: makeMeta(),
        source,
        suppressOffer: true,
      });

      act(() => source.end());
      expect(store.clear).toHaveBeenCalledWith(1);
      expect(store.records.has(1)).toBe(false);

      unmount();
      source.destroy();
    });

    it('takes a standing offer away if the flag arrives late, record intact', () => {
      const store = makeStore([[1, 120]]);
      const source = new FakeTimeSource(0, DURATION);
      const { result, rerender, unmount } = mountSuppressed(store, {
        meta: makeMeta(),
        source,
        suppressOffer: false,
      });
      expect(result.current.resume.pending).toEqual({ t: 120 });

      rerender({ meta: makeMeta(), source, suppressOffer: true });
      expect(result.current.resume.pending).toBeNull();
      expect(store.clear).not.toHaveBeenCalled();
      expect(store.records.get(1)?.t).toBe(120);

      unmount();
      source.destroy();
    });
  });
});

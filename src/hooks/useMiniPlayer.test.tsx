// @vitest-environment jsdom
/**
 * T601 — `useMiniPlayer` (contracts/mobile.md "Hooks", research R1). The
 * `IntersectionObserver` is a stub that hands its callback back to the test, so
 * "the sentinel left the top of the screen" is a function call, not a scroll.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useMiniPlayer } from './useMiniPlayer';

interface StubObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
}

/** Records every observer the hook builds and lets a test fire entries at it. */
function stubIntersectionObserver() {
  const instances: StubObserver[] = [];
  class Stub {
    private readonly self: StubObserver;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.self = { callback, options, observed: [], disconnected: false };
      instances.push(this.self);
    }
    observe(element: Element) {
      this.self.observed.push(element);
    }
    unobserve() {}
    disconnect() {
      this.self.disconnected = true;
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', Stub as unknown as typeof IntersectionObserver);
  return instances;
}

/** The two facts the hook reads off an entry. */
function fire(observer: StubObserver, isIntersecting: boolean, top: number) {
  act(() => {
    observer.callback(
      [{ isIntersecting, boundingClientRect: { top } } as unknown as IntersectionObserverEntry],
      null as unknown as IntersectionObserver,
    );
  });
}

function mount(options: { enabled?: boolean; headerPx?: number; cancel?: boolean } = {}) {
  const sentinel = document.createElement('div');
  document.body.append(sentinel);
  const view = renderHook(
    (props: { enabled: boolean; headerPx?: number; cancel?: boolean }) => useMiniPlayer(props),
    { initialProps: { enabled: true, ...options } },
  );
  act(() => view.result.current.sentinelRef(sentinel));
  return { ...view, sentinel };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useMiniPlayer', () => {
  it('observes the sentinel with the header inset, and starts undocked', () => {
    const observers = stubIntersectionObserver();
    const { result, sentinel } = mount();

    expect(result.current.docked).toBe(false);
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([sentinel]);
    expect(observers[0].options?.rootMargin).toBe('-48px 0px 0px 0px');
  });

  it('docks once the sentinel has scrolled up past the header', () => {
    const observers = stubIntersectionObserver();
    const { result } = mount();

    fire(observers[0], false, -120);
    expect(result.current.docked).toBe(true);

    // Back at the top: the stage is on screen again.
    fire(observers[0], true, 8);
    expect(result.current.docked).toBe(false);
  });

  it('does not dock for a sentinel that is merely below the fold', () => {
    const observers = stubIntersectionObserver();
    const { result } = mount();

    fire(observers[0], false, 900);
    expect(result.current.docked).toBe(false);
  });

  it('uses the header height it is given, as margin and as the threshold', () => {
    const observers = stubIntersectionObserver();
    const { result } = mount({ headerPx: 36 });

    expect(observers[0].options?.rootMargin).toBe('-36px 0px 0px 0px');
    // Below 36 counts as "past" at this header height.
    fire(observers[0], false, 20);
    expect(result.current.docked).toBe(true);
  });

  it('never docks while cancelled (the resume offer, the ended card)', () => {
    const observers = stubIntersectionObserver();
    const { result, rerender } = mount();

    fire(observers[0], false, -120);
    expect(result.current.docked).toBe(true);

    rerender({ enabled: true, cancel: true });
    expect(result.current.docked).toBe(false);

    // Dismissing the card hands the mini-player back without a new scroll.
    rerender({ enabled: true, cancel: false });
    expect(result.current.docked).toBe(true);
  });

  it('never docks on desktop, and stops observing when it is disabled', () => {
    const observers = stubIntersectionObserver();
    const { result, rerender } = mount({ enabled: false });

    expect(observers).toHaveLength(0);
    expect(result.current.docked).toBe(false);

    rerender({ enabled: true });
    expect(observers).toHaveLength(1);
    fire(observers[0], false, -120);
    expect(result.current.docked).toBe(true);

    rerender({ enabled: false });
    expect(observers[0].disconnected).toBe(true);
    expect(result.current.docked).toBe(false);
  });

  it('re-creates the observer when the header height changes', () => {
    const observers = stubIntersectionObserver();
    const { rerender } = mount();

    rerender({ enabled: true, headerPx: 36 });
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnected).toBe(true);
    expect(observers[1].options?.rootMargin).toBe('-36px 0px 0px 0px');
  });

  it('disconnects on unmount', () => {
    const observers = stubIntersectionObserver();
    const { unmount } = mount();

    unmount();
    expect(observers[0].disconnected).toBe(true);
  });

  it('never docks where IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = mount();
    expect(result.current.docked).toBe(false);
  });

  it('scrolls back to the top, smoothly by default', () => {
    stubIntersectionObserver();
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { result } = mount();

    act(() => result.current.exitMini());
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps instead of scrolling under prefers-reduced-motion (FR-506)', () => {
    stubIntersectionObserver();
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
    }));
    const { result } = mount();

    act(() => result.current.exitMini());
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('survives a window without scrollTo', () => {
    stubIntersectionObserver();
    vi.stubGlobal('scrollTo', undefined);
    const { result } = mount();

    expect(() => act(() => result.current.exitMini())).not.toThrow();
  });
});

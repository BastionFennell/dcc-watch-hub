import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeTimeSource } from './FakeTimeSource';
import { createEmitter } from './TimeSource';

describe('FakeTimeSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts at the initial time and clamps negatives', () => {
    expect(new FakeTimeSource().getTime()).toBe(0);
    expect(new FakeTimeSource(12).getTime()).toBe(12);
    expect(new FakeTimeSource(-3).getTime()).toBe(0);
  });

  it('emits a tick on set and seek', () => {
    const source = new FakeTimeSource();
    const ticks: number[] = [];
    source.onTick((t) => ticks.push(t));
    source.set(30);
    source.seek(10);
    expect(ticks).toEqual([30, 10]);
    expect(source.getTime()).toBe(10);
  });

  it('advances at 1x while playing and emits play/pause', () => {
    const source = new FakeTimeSource(0, 240);
    const ticks: number[] = [];
    let played = 0;
    let paused = 0;
    source.onTick((t) => ticks.push(t));
    source.onPlay(() => (played += 1));
    source.onPause(() => (paused += 1));

    source.play();
    vi.advanceTimersByTime(1000);
    expect(source.getTime()).toBeCloseTo(1, 5);
    expect(ticks).toHaveLength(4);
    expect(played).toBe(1);

    source.pause();
    vi.advanceTimersByTime(1000);
    expect(source.getTime()).toBeCloseTo(1, 5);
    expect(paused).toBe(1);
  });

  it('emits onEnded once and stops ticking until the next seek', () => {
    const source = new FakeTimeSource(0, 240);
    let ended = 0;
    source.onEnded(() => (ended += 1));
    source.end();
    expect(ended).toBe(1);
    expect(source.getTime()).toBe(240);

    const ticks: number[] = [];
    source.onTick((t) => ticks.push(t));
    vi.advanceTimersByTime(2000);
    expect(ticks).toEqual([]);
    source.seek(5);
    expect(ticks).toEqual([5]);
  });

  it('ends automatically at the duration while playing', () => {
    const source = new FakeTimeSource(0, 0.5);
    let ended = 0;
    source.onEnded(() => (ended += 1));
    source.play();
    vi.advanceTimersByTime(1000);
    expect(ended).toBe(1);
    expect(source.getTime()).toBe(0.5);
  });

  it('destroy is idempotent and silences listeners', () => {
    const source = new FakeTimeSource();
    const ticks: number[] = [];
    source.onTick((t) => ticks.push(t));
    source.destroy();
    source.destroy();
    source.set(50);
    expect(ticks).toEqual([]);
  });
});

describe('createEmitter', () => {
  it('unsubscribes safely more than once', () => {
    const emitter = createEmitter<number>();
    const seen: number[] = [];
    const off = emitter.subscribe((v) => seen.push(v));
    emitter.emit(1);
    off();
    off();
    emitter.emit(2);
    expect(seen).toEqual([1]);
    expect(emitter.size).toBe(0);
  });
});

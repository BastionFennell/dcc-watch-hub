/**
 * Deterministic TimeSource for tests and the dev-only scrubber. Required by
 * constitution II: a fake must be able to drive the whole episode page without
 * a network or a video host.
 */
import type { ControllableTimeSource } from './TimeSource';
import { createEmitter } from './TimeSource';

const TICK_MS = 250;

/** The Studio's rate buttons; anything outside is clamped to this range (010). */
export const MIN_RATE = 0.25;
export const MAX_RATE = 4;

export class FakeTimeSource implements ControllableTimeSource {
  private t: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;
  /** Playback speed multiplier; the tick cadence is fixed, the step is not. */
  private rate = 1;

  private readonly ticks = createEmitter<number>();
  private readonly plays = createEmitter<void>();
  private readonly pauses = createEmitter<void>();
  private readonly ends = createEmitter<void>();

  /** Optional upper bound; `play()` stops and ends here. */
  constructor(
    initial = 0,
    private readonly durationSec: number = Number.POSITIVE_INFINITY,
  ) {
    this.t = Math.max(0, initial);
  }

  getTime(): number {
    return this.t;
  }

  onTick(cb: (t: number) => void): () => void {
    return this.ticks.subscribe(cb);
  }

  onPlay(cb: () => void): () => void {
    return this.plays.subscribe(cb);
  }

  onPause(cb: () => void): () => void {
    return this.pauses.subscribe(cb);
  }

  onEnded(cb: () => void): () => void {
    return this.ends.subscribe(cb);
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  /** Jump the playhead and emit a tick. */
  set(t: number): void {
    if (this.destroyed) return;
    this.t = Math.max(0, t);
    this.ticks.emit(this.t);
  }

  seek(t: number): void {
    this.set(t);
  }

  /** Advance by `dt` seconds (no timers involved). */
  advance(dt: number): void {
    this.set(this.t + dt);
  }

  play(): void {
    if (this.destroyed || this.timer !== null) return;
    this.plays.emit();
    this.timer = setInterval(() => {
      this.t = Math.min(this.t + (TICK_MS / 1000) * this.rate, this.durationSec);
      this.ticks.emit(this.t);
      if (this.t >= this.durationSec) this.end();
    }, TICK_MS);
  }

  pause(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
    this.pauses.emit();
    this.ticks.emit(this.t);
  }

  /* -------------------------------------------------------- Transport (010) */

  /** Paused is "not ticking", so a destroyed or ended source reads as paused. */
  isPaused(): boolean {
    return this.timer === null;
  }

  /** `null` for the unbounded default: an author's draft has no duration yet. */
  getDuration(): number | null {
    return Number.isFinite(this.durationSec) ? this.durationSec : null;
  }

  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return;
    this.rate = Math.min(Math.max(rate, MIN_RATE), MAX_RATE);
  }

  getRate(): number {
    return this.rate;
  }

  /** Jump to the end and emit `onEnded` (no further ticks until a seek). */
  end(): void {
    if (this.destroyed) return;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (Number.isFinite(this.durationSec)) this.t = this.durationSec;
    this.ticks.emit(this.t);
    this.ends.emit();
  }

  destroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.destroyed = true;
    this.ticks.clear();
    this.plays.clear();
    this.pauses.clear();
    this.ends.clear();
  }
}

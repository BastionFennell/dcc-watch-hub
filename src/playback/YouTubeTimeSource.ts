/**
 * The production `TimeSource`: a thin adapter over the YouTube IFrame Player API
 * (research R4/R8, contracts/time-source.md §6).
 *
 * A seek is accepted at any time. Before the player is ready the latest target is
 * queued and applied in `onReady` with `seekTo(t, true)`, so answering the resume
 * card while the iframe is still loading still lands the broadcast in the right
 * place (FR-132).
 *
 * This file and `loadYouTubeApi.ts` are the ONLY modules allowed to reference the
 * `YT` global (constitution II). Nothing here knows about React or the overlay.
 */
import type { ControllableTimeSource } from './TimeSource';
import { createEmitter } from './TimeSource';
import { loadYouTubeApi } from './loadYouTubeApi';

const POLL_MS = 250;
// While paused, cued, or ended the host can still be scrubbed with its own bar without
// any state change, so keep watching the clock at a gentler cadence (contract §1).
const IDLE_POLL_MS = 500;

export interface YouTubeTimeSourceOptions {
  /** Fired once the player is ready to accept commands. */
  onReady?: () => void;
  /** Fired when the player or the API fails; the host shows its own error UI. */
  onError?: (error: Error) => void;
}

export class YouTubeTimeSource implements ControllableTimeSource {
  private t = 0;
  /** The rate the caller asked for; applied in `onReady` when it came early (010). */
  private rate = 1;
  private player: YT.Player | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerMs = 0;
  private destroyed = false;
  private ready = false;
  /** Only the most recent seek requested before `onReady` is kept (contract §6). */
  private pendingSeek: number | null = null;

  /** Our own child element: `YT.Player` replaces the node it is given. */
  private host: HTMLElement | null;

  private readonly ticks = createEmitter<number>();
  private readonly plays = createEmitter<void>();
  private readonly pauses = createEmitter<void>();
  private readonly ends = createEmitter<void>();

  constructor(
    container: HTMLElement,
    videoId: string,
    private readonly opts: YouTubeTimeSourceOptions = {},
  ) {
    const host = container.ownerDocument.createElement('div');
    host.setAttribute('data-youtube-host', '');
    container.appendChild(host);
    this.host = host;

    loadYouTubeApi()
      .then((api) => {
        if (this.destroyed) return;
        this.player = new api.Player(host, {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin,
          } as YT.PlayerVars,
          events: {
            onReady: () => {
              if (this.destroyed) return;
              this.ready = true;
              this.startPolling(IDLE_POLL_MS);
              this.applyRate();
              this.applyPendingSeek();
              this.opts.onReady?.();
            },
            onStateChange: (event: YT.OnStateChangeEvent) => this.handleState(event.data),
            onError: () => {
              this.opts.onError?.(new Error('The host player could not play this video.'));
            },
          },
        });
      })
      .catch((cause: unknown) => {
        if (this.destroyed) return;
        this.opts.onError?.(cause instanceof Error ? cause : new Error(String(cause)));
      });
  }

  /* ------------------------------------------------------------ TimeSource */

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

  seek(t: number): void {
    if (this.destroyed) return;
    const target = Math.max(0, t);
    if (this.ready) {
      this.player?.seekTo(target, true);
    } else {
      // Not ready yet: remember the latest target and apply it in onReady.
      this.pendingSeek = target;
    }
    // Contract: a seek MUST produce a tick, even while paused or not yet ready.
    this.emitTime(target);
  }

  /* -------------------------------------------------------- Transport (010) */

  /**
   * Every command below is a no-op before `onReady`: the IFrame API queues
   * nothing itself and calling a half-built player throws. The Studio's
   * transport bar simply stays inert for the second the iframe takes to load.
   */
  play(): void {
    if (this.destroyed || !this.ready) return;
    this.player?.playVideo?.();
  }

  pause(): void {
    if (this.destroyed || !this.ready) return;
    this.player?.pauseVideo?.();
  }

  /** Only PLAYING and BUFFERING are "running"; unready reads as paused. */
  isPaused(): boolean {
    if (this.destroyed || !this.ready) return true;
    const state = this.player?.getPlayerState?.();
    return !(state === 1 /* PLAYING */ || state === 3 /* BUFFERING */);
  }

  /** The host reports 0 until metadata arrives, which is "not known yet". */
  getDuration(): number | null {
    if (this.destroyed) return null;
    const raw = this.player?.getDuration?.();
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
    return raw;
  }

  setRate(rate: number): void {
    if (this.destroyed || !Number.isFinite(rate) || rate <= 0) return;
    this.rate = rate;
    if (this.ready) this.applyRate();
  }

  getRate(): number {
    if (this.destroyed || !this.ready) return this.rate;
    const raw = this.player?.getPlaybackRate?.();
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : this.rate;
  }

  private applyRate(): void {
    if (this.rate === 1) return;
    this.player?.setPlaybackRate?.(this.rate);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pendingSeek = null;
    this.stopPolling();
    try {
      this.player?.destroy();
    } catch {
      // A player that never finished constructing has nothing to tear down.
    }
    this.player = null;
    this.host?.remove();
    this.host = null;
    this.ticks.clear();
    this.plays.clear();
    this.pauses.clear();
    this.ends.clear();
  }

  /* --------------------------------------------------------------- internals */

  private readTime(): number {
    const raw = this.player?.getCurrentTime?.();
    return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : this.t;
  }

  /** Applies a seek queued before the player was ready, then emits its tick. */
  private applyPendingSeek(): void {
    const target = this.pendingSeek;
    this.pendingSeek = null;
    if (target === null) {
      this.emitTime(this.readTime());
      return;
    }
    this.player?.seekTo(target, true);
    this.emitTime(target);
  }

  private emitTime(t: number): void {
    if (this.destroyed) return;
    this.t = t;
    this.ticks.emit(t);
  }

  private handleState(state: number): void {
    if (this.destroyed) return;
    switch (state) {
      case 1 /* PLAYING */:
        this.emitTime(this.readTime());
        this.plays.emit();
        this.startPolling();
        break;
      case 0 /* ENDED */:
        this.startPolling(IDLE_POLL_MS);
        this.emitTime(this.readTime());
        this.ends.emit();
        break;
      case 2 /* PAUSED */:
        this.startPolling(IDLE_POLL_MS);
        // One tick so a scrub made while paused still moves the overlay.
        this.emitTime(this.readTime());
        this.pauses.emit();
        break;
      case 3 /* BUFFERING */:
      case 5 /* CUED */:
        this.startPolling(IDLE_POLL_MS);
        this.emitTime(this.readTime());
        break;
      default:
        break;
    }
  }

  private startPolling(ms: number = POLL_MS): void {
    if (this.destroyed) return;
    if (this.timer !== null && this.timerMs === ms) return;
    this.stopPolling();
    this.timerMs = ms;
    this.timer = setInterval(() => this.emitTime(this.readTime()), ms);
  }

  private stopPolling(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

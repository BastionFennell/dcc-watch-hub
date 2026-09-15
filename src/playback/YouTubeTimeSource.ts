/**
 * The production `TimeSource`: a thin adapter over the YouTube IFrame Player API
 * (research R4, contracts/time-source.md).
 *
 * This file and `loadYouTubeApi.ts` are the ONLY modules allowed to reference the
 * `YT` global (constitution II). Nothing here knows about React or the overlay.
 */
import type { TimeSource } from './TimeSource';
import { createEmitter } from './TimeSource';
import { loadYouTubeApi } from './loadYouTubeApi';

const POLL_MS = 250;

export interface YouTubeTimeSourceOptions {
  /** Fired once the player is ready to accept commands. */
  onReady?: () => void;
  /** Fired when the player or the API fails; the host shows its own error UI. */
  onError?: (error: Error) => void;
}

export class YouTubeTimeSource implements TimeSource {
  private t = 0;
  private player: YT.Player | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

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
              this.emitTime(this.readTime());
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
    this.player?.seekTo(target, true);
    // Contract: a seek MUST produce a tick, even while paused.
    this.emitTime(target);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
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
        this.stopPolling();
        this.emitTime(this.readTime());
        this.ends.emit();
        break;
      case 2 /* PAUSED */:
        this.stopPolling();
        // One tick so a scrub made while paused still moves the overlay.
        this.emitTime(this.readTime());
        this.pauses.emit();
        break;
      case 3 /* BUFFERING */:
      case 5 /* CUED */:
        this.stopPolling();
        this.emitTime(this.readTime());
        break;
      default:
        break;
    }
  }

  private startPolling(): void {
    if (this.timer !== null || this.destroyed) return;
    this.timer = setInterval(() => this.emitTime(this.readTime()), POLL_MS);
  }

  private stopPolling(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}

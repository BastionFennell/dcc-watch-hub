/**
 * The only way overlay code learns about playback (constitution II).
 * Contract: specs/001-watch-hub-v1/contracts/time-source.md
 */
export interface TimeSource {
  /** Current playhead in seconds of content time (not wall time). Never negative. */
  getTime(): number;
  /** ~4 Hz while playing, once on pause, once after a seek. Returns unsubscribe. */
  onTick(cb: (t: number) => void): () => void;
  onPlay(cb: () => void): () => void;
  onPause(cb: () => void): () => void;
  onEnded(cb: () => void): () => void;
  /** Move the playhead; MUST emit a tick with the new time. */
  seek(t: number): void;
  /** Release timers, players, DOM. Idempotent. */
  destroy(): void;
}

export interface Emitter<T> {
  subscribe(cb: (value: T) => void): () => void;
  emit(value: T): void;
  clear(): void;
  readonly size: number;
}

/** Minimal listener set. Unsubscribe is safe to call more than once. */
export function createEmitter<T>(): Emitter<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    subscribe(cb) {
      listeners.add(cb);
      let live = true;
      return () => {
        if (!live) return;
        live = false;
        listeners.delete(cb);
      };
    },
    emit(value) {
      for (const cb of [...listeners]) cb(value);
    },
    clear() {
      listeners.clear();
    },
    get size() {
      return listeners.size;
    },
  };
}

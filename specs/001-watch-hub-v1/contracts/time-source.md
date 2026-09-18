# Contract: TimeSource

The only way overlay code learns about playback. Defined in `src/playback/TimeSource.ts`.

```ts
export interface TimeSource {
  /** Current playhead in seconds of content time (not wall time). Never negative. */
  getTime(): number;
  /** Called on every time update (~4 Hz while playing, once on pause, once after seek). Returns unsubscribe. */
  onTick(cb: (t: number) => void): () => void;
  onPlay(cb: () => void): () => void;
  onPause(cb: () => void): () => void;
  onEnded(cb: () => void): () => void;
  /** Move the playhead. Implementations MUST emit a tick with the new time synchronously or on the next frame. */
  seek(t: number): void;
  /** Release timers, players, DOM. Idempotent. */
  destroy(): void;
}
```

## Guarantees every implementation MUST provide

1. `onTick` fires at least once within 500 ms of any change to the playhead, including seeks made
   through the host player's own controls while paused.
2. `seek(t)` results in a tick whose value is within 1 s of `t`.
3. After `onEnded`, `getTime()` returns the final time and no further ticks fire until `seek`.
4. Content time pauses during host advertisements and while paused.
5. Unsubscribe functions are safe to call more than once.

## Implementations

- `YouTubeTimeSource(container: HTMLElement, videoId: string)` - production. The only module that
  may reference the global `YT` namespace or `@types/youtube`. ESLint enforces this with
  `no-restricted-globals` (`YT`) everywhere else.
- `FakeTimeSource(initial = 0)` - tests and dev scrubber. Extra methods: `set(t)`, `play()`
  (advances at 1× via `setInterval` 250 ms, or manually via `advance(dt)`), `pause()`, `end()`.

## Consumers

`usePlayhead(source): { t: number; playing: boolean; ended: boolean }`. Components receive `t`
(and, for the timeline, a `seek` callback) as props. No component imports a concrete TimeSource.

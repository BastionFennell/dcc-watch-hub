# Contract: Resume storage

Module `src/playback/resume.ts` (framework-free).

- Key: `dcc-watch-hub:resume:v1:<episodeId>`
- Value: `{ "episodeId": number, "t": number, "savedAt": ISO-8601 string }`
- `loadResume(episodeId): ResumeRecord | null` — null on missing, unparsable, wrong `episodeId`,
  non-finite or negative `t`, or any storage exception.
- `saveResume(episodeId, t): void` — writes; swallows exceptions.
- `clearResume(episodeId): void` — removes; swallows exceptions.
- `storage` is injectable (`createResumeStore(storage?: Storage)`) for tests; default is
  `globalThis.localStorage` resolved lazily inside try/catch.

Hook `useResume(meta: EpisodeMeta, source: TimeSource | null, playhead: Playhead)` returns
`{ pending: { t: number } | null; rejoin(): void; startOver(): void }`.

- Offer (`pending`) exists only when a loaded record has `30 <= t <= durationSec - 30`, until
  the viewer answers or the playhead moves past 5 s on its own.
- Save cadence: at most once per 5 s while `playing`; immediately on pause, `pagehide`,
  `visibilitychange` → hidden, episode change, and unmount. Never while `pending` is unresolved.
- Clear: when `ended`, or when `t >= durationSec - 30`, or on `startOver()`.
- `rejoin()` → `source.seek(record.t)`; if the source is null, retried once it is set.
- Nothing else is ever stored. Overlay state is recomputed from the playhead as usual.

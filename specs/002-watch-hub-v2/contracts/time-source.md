# Contract: TimeSource (v2 amendment)

Everything in `specs/001-watch-hub-v1/contracts/time-source.md` still applies, plus:

6. `seek(t)` MUST be accepted at any time, including before the host player is ready. An
   implementation that cannot act immediately MUST remember the latest requested `t` and apply
   it as soon as it can, then emit a tick. Only the most recent pending seek is kept.

`YouTubeTimeSource`: pending seek applied in `onReady` via `seekTo(t, true)`. Host behavior:
seeking a cued (unstarted) video starts playback from `t`; seeking a paused video keeps it paused.
`FakeTimeSource`: unchanged; `seek` always applies immediately.

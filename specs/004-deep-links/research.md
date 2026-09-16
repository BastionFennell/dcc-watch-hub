# Research: Deep links + share

## R1. Parsing and applying `?t=`
- **Decision**: `parseDeepLinkT(search, durationSec)` → integer seconds when `0 <= t <= duration`,
  else null (floor decimals). `useDeepLink(meta, source)` applies `source.seek(t)` exactly once per
  `(meta.id, location.search)` after `source` becomes non-null; the YouTube adapter queues it
  until ready (contract §6). Returns `linkedT` so the page can pass `suppressOffer` to `useResume`.
  In DEV with `?fake=1`, `FakeStage` keeps initializing at `t` (already implemented), and the
  one-shot seek is a no-op because the fake source already reports `t`.
- **Alternatives**: hash fragments (`#t=`) — survive fewer copy/paste paths; `start` playerVar —
  requires the value at player construction and is host-specific.

## R2. Autoplay behaviour
- Seeking a cued YouTube player starts playback (documented host behaviour) — a deep link
  therefore plays from `t`, which is what a shared clip should do. If the host blocks autoplay
  with sound, the player positions at `t` paused; overlay is correct either way.

## R3. Share delivery order
- **Decision**: `navigator.share` when available AND the pointer is coarse or the viewport ≤ 900 px
  (phones/tablets), else `navigator.clipboard.writeText`; if both fail → `'shown'` (notice with the
  URL in a read-only input, `select()`ed). `AbortError` from a cancelled share sheet is silent.
- **Rationale**: desktop users expect a copied link; phones expect the share sheet.

## R4. URL shape
- `momentUrl({ origin, base, episodeId, t })` → `${origin}${base}ep/${id}?t=${t}` with `base`
  from `import.meta.env.BASE_URL` (normalized to end with `/`). Never includes `fake`, `panel`,
  `record`.

## R5. Confirmation
- 2 s transient `ShareNotice` (`role="status" aria-live="polite"`), System voice:
  copied → "Moment marked. The link is on your clipboard." · shared → "Moment marked." ·
  shown → "Moment marked. Copy the link below." with the URL field. Timer lives in `useShare`
  (viewer notice, not overlay state). Reduced motion respected.

## R6. Tests
- `deepLink.test.ts`: parse table (valid, decimals, negative, NaN, > duration, empty).
- `share.test.ts`: URL building with base `/` and `/dcc-watch-hub/`; delivery order with stubbed
  `navigator.share`/`clipboard`; AbortError silent; fallback `'shown'`.
- `useDeepLink.test.tsx`: seeks once, not again on rerender, again on episode change with a new
  search; no seek when invalid.
- Page: `/ep/1?fake=1&t=156` → feed header 2:36 and no resume card even with a saved record;
  `/ep/1?fake=1` with a record → card (unchanged); caption share copies
  `http://localhost:3000/ep/1?t=156` (jsdom origin) and shows the notice; feed-row share copies
  the row's `t` and does not seek; dev params stripped from shared URLs.

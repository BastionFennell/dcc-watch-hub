# Contract: Deep links + share

## URL
`/ep/<id>?t=<seconds>` - integer seconds into the final edit. Unknown/invalid → ignored.
Dev-only params (`fake`, `panel`, `record`) may coexist in DEV and are never emitted by share.

## `src/playback/deepLink.ts`
- `parseDeepLinkT(search: string, durationSec: number): number | null`
- `momentSearch(t: number): string` → `?t=<floor(t)>`

## `src/playback/useDeepLink.ts`
- `useDeepLink(meta: EpisodeMeta | undefined, source: TimeSource | null): { linkedT: number | null }`
- Seeks once per `(meta.id, location.search)`; safe to call before `source` exists.

## `src/playback/useResume.ts`
- New option `{ suppressOffer?: boolean }` (4th/5th param - keep the store param position): when
  true, `pending` is always null for that visit and the stored record is left untouched.

## `src/share/share.ts`
- `momentUrl(args: { origin: string; base: string; episodeId: number; t: number }): string`
- `deliver(url: string, title: string, env?: { share?: typeof navigator.share; clipboard?: Clipboard; preferShare?: boolean }): Promise<'shared' | 'copied' | 'shown'>`

## Components
- `ShareButton({ onClick, label?, size? })` - icon button, `data-testid="share-moment"` (caption row) / `share-row` (feed rows).
- `ShareNotice({ status, url, onDismiss })` - `role="status"`, `data-testid="share-notice"`, read-only `input` with the URL when `status === 'shown'`.
- `EventFeed` props: `+ onShare(t: number): void`; each row renders the seek button and a sibling share button (no nesting).

## Amendment (wave 1, T404)
`deliver` returns a fourth result, `'cancelled'`, when the viewer dismisses the native share
sheet (`AbortError`). It is not a viewer-facing outcome: the UI shows nothing for it, which is how
"cancelling it is silent" (spec US2 scenario 3) is told apart from a successful copy. The union is
therefore `'shared' | 'copied' | 'shown' | 'cancelled'`.

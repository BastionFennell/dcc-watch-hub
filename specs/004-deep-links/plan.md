# Implementation Plan: Deep links to moments + share

**Branch**: `004-deep-links` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

## Summary
Parse `?t=` once per episode visit in `EpisodePage`, seek through the `TimeSource` when it exists
(the YouTube adapter already queues a seek until ready), and tell `useResume` to skip the offer
for that visit. Add a `share` module that builds the absolute moment URL and delivers it via
`navigator.share` → `navigator.clipboard` → a selectable notice, with a transient System-voice
confirmation. Wire a share control into the caption row and a share icon into each feed row.

## Technical Context
Unchanged stack. No storage. No new runtime dependencies. New: `src/playback/deepLink.ts`
(parse + one-shot apply hook `useDeepLink`), `src/share/share.ts` (URL + delivery, framework-free),
`src/share/useShare.ts` (confirmation state), `src/components/ShareButton/**`,
`src/components/ShareNotice/**`. Edits: `EpisodePage.tsx` (+css/test), `EventFeed`/`FeedItem`/
`SponsorSlot` (share slot beside the seek button), caption row, `useResume` (`suppressOffer`
option), `VideoStage` (drop the DEV-only `t` reading in favour of the shared parser), `copy.ts`.

## Constitution Check (1.2.1)
| Principle | Gate | Status |
|-----------|------|--------|
| I | The deep link only moves the playhead; overlay recomputed as usual | PASS |
| II | Seek goes through `TimeSource.seek`; adapter contract §6 (queued seek) covers readiness | PASS |
| III | Share controls are explicit; confirmation is a 2 s polite notice; no autoplay of audio | PASS |
| IV | No deps; Web Share/Clipboard APIs are browser-native with fallbacks | PASS |
| V | Only US1/US2; markers excluded per spec assumption | PASS |
| VI | No data-model change | N/A |

## Project Structure (additions)
```text
src/playback/deepLink.ts          # parseDeepLinkT(search, durationSec): number | null; stripDevParams(url)
src/playback/useDeepLink.ts       # useDeepLink(meta, source): { linkedT: number | null } - seeks once per (episodeId, search)
src/playback/useResume.ts         # + options.suppressOffer
src/share/share.ts                # momentUrl({ base, origin, episodeId, t }); deliver(url, title): Promise<'shared'|'copied'|'shown'>
src/share/useShare.ts             # { share(t), status, lastUrl, dismiss }; 2 s confirmation via setTimeout (viewer notice)
src/components/ShareButton/ShareButton.tsx (+css)   # icon button, aria-label copy.shareMoment
src/components/ShareNotice/ShareNotice.tsx (+css)   # polite live region; fallback shows selectable URL
src/components/icons.tsx          # + IconShare, IconLink
src/components/EventFeed/*        # share slot per row; onShare(t)
src/pages/EpisodePage.tsx         # caption-row share, feed onShare, deep link + resume wiring
```
**Structure Decision**: playback concerns stay in `src/playback/`; sharing is its own small
module so it can be reused by later surfaces (markers, gallery).

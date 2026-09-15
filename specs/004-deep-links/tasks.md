---
description: "Task list for deep links + share"
---
# Tasks: Deep links to moments + share

## Waves
| Wave | Tasks | Agent |
|------|-------|-------|
| 1 | T401–T408 | one agent (implementation) |
| 2 | T409–T411 | one agent (polish + verification) |

## Phase 1: Deep link (US1)
- [X] T401 `src/playback/deepLink.ts` (`parseDeepLinkT`, `momentSearch`) + `deepLink.test.ts`.
- [X] T402 `src/playback/useDeepLink.ts` + test (one-shot seek per episode+search; safe before source).
- [X] T403 `src/playback/useResume.ts`: `suppressOffer` option + tests; `EpisodePage.tsx`: `useDeepLink` wired, `suppressOffer={linkedT !== null}`; `VideoStage`/`FakeStage` keep DEV `?t=` init but read it through `parseDeepLinkT`.

## Phase 2: Share (US2)
- [X] T404 `src/share/share.ts` (`momentUrl`, `deliver` with share → clipboard → shown, AbortError silent) + `share.test.ts`; copy keys `shareMoment`, `shareRow(time)`, `shareCopied`, `shareShared`, `shareShown`, `shareTitle(episodeTitle, time)`.
- [X] T405 `src/share/useShare.ts` (status + url + 2 s timer + dismiss) + test; `src/components/icons.tsx` `IconShare`.
- [X] T406 `src/components/ShareButton/**`, `src/components/ShareNotice/**` (+tests): polite live region; fallback URL field selected on mount.
- [X] T407 Caption row: share control at the right beside the time (`share-moment`); `ShareNotice` rendered under the caption row; `EventFeed`/`FeedItemView`/`SponsorSlot`: `onShare` prop, sibling share button per row (`share-row`, `aria-label` `shareRow(time)`), no nested buttons, row grid keeps the seek button full-width minus the icon.
- [X] T408 Page tests: deep link with fake source (2:36, no resume card with a saved record; card still on a plain visit; invalid `t` ignored; new episode starts at 0); caption share copies the expected URL (stub `navigator.clipboard.writeText`) and shows the notice; feed-row share copies the row's `t` without seeking; shared URLs never contain `fake`/`panel`/`record`.

## Phase 3: Polish
- [ ] T409 README + quickstart (deep links, share, mobile share sheet); note the dev `?t=` flag is now a real feature.
- [ ] T410 Visual/a11y: caption row with the share control at 1440/500 px; feed rows with share icons (hover/focus, contrast ≥ 3:1 for the icon); notice placement; Lighthouse a11y 100 on `/ep/1` and `/ep/1?t=156` (preview build).
- [ ] T411 Final: gates green; SC-301..304 recorded under quickstart `## Results`; all tasks `[X]`.

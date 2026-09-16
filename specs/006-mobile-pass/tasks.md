---
description: "Task list for the mobile pass"
---
# Tasks: Mobile pass

## Waves
| Wave | Tasks | Ownership |
|------|-------|-----------|
| 1 | T601–T603 ∥ T604–T605 ∥ T606–T607 | "mini": `src/hooks/useIsPhone.ts`, `src/hooks/useMiniPlayer.ts` (+tests), `src/components/VideoStage/**`. "tabs": `src/components/MobileTabs/**`, `src/components/PartyRail/**` (grid layout only), `src/components/EpisodeLog/**` (`embedded` prop only). "sheet": `src/components/RailPanel/**`, `src/hooks/usePanel.ts` (only if needed for the sheet). Everyone appends to `src/copy.ts` at the END. Nobody touches `src/pages/**`. |
| 2 | T608–T609 | one agent: page composition + tests |
| 3 | T610–T612 | one agent: docs, visual/a11y at phone sizes, verification |

## Phase 1a: Mini-player
- [X] T601 `src/hooks/useIsPhone.ts` (+test) and `src/hooks/useMiniPlayer.ts` (+test) per `contracts/mobile.md` and research R1 (IO on a sentinel, header offset, `cancel`, `exitMini` reduced-motion aware, guards when IO/matchMedia missing).
- [X] T602 `VideoStage`: `mini`, `onExitMini`, `hideBadge` props; `data-mini` styling (fixed under the header, `min(45vw, 260px)`, 16:9, shadow, z-index 15), placeholder keeping the slot height, compact toast inside the mini frame, thin bottom bar with the return button; badge hidden when `hideBadge`; the `children` overlays still render (page decides what to pass). CSS scoped to `[data-mini='true']` so desktop is untouched.
- [X] T603 Tests for the mini stage (jsdom): `data-mini` toggles styles/testids, placeholder present, return button calls `onExitMini`, badge hidden with `hideBadge`.

## Phase 1b: Tabs + party grid + embedded log
- [X] T604 `src/components/MobileTabs/{MobileTabs.tsx, .module.css}` per contract/research R2 (roles, roving focus, arrows, Home/End, swipe with `touch-action: pan-y`, panels stay mounted and `hidden`); sheet-style tab strip (mono caps, `--brand-line` underline on the selected tab, ≥ 44 px tall tabs).
- [X] T605 `PartyRail` `layout` prop (`data-layout='grid'` two columns; odd last frame spans both; keep the desktop row behaviour and the ≤ 480 px strip for the non-tab path); `EpisodeLog` `embedded` prop (always open, toggle hidden, count shown). Tests: `MobileTabs.test.tsx` (roles/aria, click, keys, swipe left/right, vertical ignored, mounted panels), party grid attribute test, embedded log test.

## Phase 1c: Bottom sheet
- [X] T606 `RailPanel` `presentation='sheet'` per contract/research R3: portal, backdrop tap closes, handle + header drag-to-dismiss (25% threshold, snap back), height rules incl. short viewports, safe-area padding, reduced motion, `data-presentation`, keep `id="rail-panel"`/region semantics and the close control; body lock via the existing `panel-open` class.
- [X] T607 `RailPanel.test.tsx` (new or extended): sheet renders in a portal; drag past threshold closes; short drag snaps back; backdrop click closes; inner click doesn't; Escape still handled by `usePanel` (unchanged); rail presentation unchanged.

## Phase 2: Page composition
- [X] T608 `EpisodePage.tsx` (+css): `const phone = useIsPhone()`; when phone: stage slot with sentinel + `VideoStage mini={docked} hideBadge onExitMini`, caption row, timeline, then `MobileTabs` with panes [Feed: `EventFeed`; Party: `PartyRail layout="grid"` + glance opens via `usePanel` as before; Map: `FloorMap` inline (+ small heading with `sectorsRevealed`); Log: `EpisodeLog embedded`]; the rail panel renders with `presentation="sheet"` (dossier only; the map panel kind is not used on phones); the record dialog unchanged; the desktop full-width log and rail are not rendered on phones. `useMiniPlayer({ enabled: phone, cancel: resume.pending !== null || ended })`. When not phone: the existing tree exactly.
- [X] T609 Page tests (stub `matchMedia` to phone; stub `IntersectionObserver`): tabs present below the timeline and desktop rail/log absent; Feed default; Party → frames in grid → tap opens the sheet (`data-presentation="sheet"`) with the glance; record opens above; Map tab shows `floormap`, stage badge absent; Log tab shows the open embedded log; arrow keys and swipe switch tabs; docking toggles `data-mini` and the placeholder exists; mini cancelled when the resume card is pending; desktop suite unchanged (run it).

## Phase 3: Polish
- [X] T610 README ("On a phone" section) + quickstart verified (DevTools device-mode instructions, all URLs opened); test count 663 and the new bundle sizes recorded. Also the swipe-ignore fix: `MobileTabs` drops a gesture that starts inside `[data-swipe-ignore]`, `FloorMap`'s pan viewport carries it (+test).
- [X] T611 Headless Chrome at 400×800, 360×740, 430×932, 844×390 landscape (use an iframe harness for widths < 500): fold check (feed rows visible), tabs strip, dock/undock (drive `scrollTo` and check `data-mini`, iframe/fake node identity unchanged, slot height unchanged), sheet at 70/85 vh with the mini-player visible above, party grid, inline map, embedded log; no horizontal scroll; Lighthouse a11y 100 at phone width (Lighthouse mobile preset) on the preview build; axe on tabs/sheet/mini; desktop 1440 screenshot unchanged vs before (0 differing pixels vs the 005 tree). The harness was not needed — headless Chrome 152 honours `setViewport` below 500 px on a `width=device-width` page — so no file was added to the repo. Fixes made: phone map controls to 32 px, the mini frame capped on short viewports, and — on the author's decision after the first pass — the tab strip made sticky under the compact header with the mini frame docked below it (`--tabstrip-h` in `tokens.css` shared by both rules); research R1/R2 updated.
- [X] T612 Final: gates green; SC-501..504 recorded under quickstart `## Results`; all tasks `[X]`.

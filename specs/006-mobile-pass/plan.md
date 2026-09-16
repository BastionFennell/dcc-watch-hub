# Implementation Plan: Mobile pass

**Branch**: `006-mobile-pass` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

## Summary
Phone-only (≤ 900 px) layout built from three additive pieces: (1) `useMiniPlayer` — an
IntersectionObserver on a sentinel above the stage toggles `data-mini` on the stage wrapper,
whose CSS pins the same element under the header while a placeholder keeps the slot height;
(2) `MobileTabs` — a WAI-ARIA tab list with swipe, hosting the feed, a 2-column party grid, the
inline floor map, and the broadcast log; (3) `RailPanel` gains a `sheet` presentation used on
phones — a bottom sheet with handle, drag-to-dismiss, dim backdrop. `EpisodePage` composes the
phone layout behind a `useIsPhone()` media hook; desktop markup is untouched.

## Technical Context
Unchanged stack; no new deps. Media hook via `matchMedia('(max-width: 900px)')`. Gestures via
Pointer Events (as in `FloorMap`). Scroll-to-top via `window.scrollTo` honoring reduced motion.

## Constitution Check (1.2.1)
| Principle | Gate | Status |
|-----------|------|--------|
| I | All pane content is the same playhead-derived data; tab/mini/sheet state is viewer state | PASS |
| II | The player element is never re-parented; no adapter change | PASS |
| III | Mini-player and sheet keep the video visible; sheet opens by explicit tap; tabs are navigation, not auto-opening | PASS |
| IV | No deps | PASS |
| V | Phase 2 items only; no deep-linked tabs | PASS |

## Project Structure (additions / edits)
```text
src/hooks/useIsPhone.ts            # matchMedia('(max-width: 900px)') with change listener; SSR/jsdom guard
src/hooks/useMiniPlayer.ts         # { docked, sentinelRef, exitMini() } via IntersectionObserver (guarded)
src/components/MobileTabs/MobileTabs.tsx (+css, +test)   # tablist/tabs/tabpanels, roving focus, swipe
src/components/RailPanel/RailPanel.tsx (+css)            # + presentation: 'rail' | 'sheet'; sheet: handle, drag, backdrop
src/components/VideoStage/VideoStage.tsx (+css)          # + mini?: boolean → data-mini; placeholder keeps height; onExitMini
src/components/PartyRail/PartyRail.module.css            # + [data-layout='grid'] two-column variant (phone tab)
src/pages/EpisodePage.tsx (+css, +test)                  # phone composition
```
**Structure Decision**: keep one `EpisodePage` and branch on `useIsPhone()`; the desktop tree is
byte-identical when the hook is false (guarded by existing tests). Phone tree: header → stage slot
(sentinel + stage) → caption row → timeline → MobileTabs → (sheet portal) → (record dialog).

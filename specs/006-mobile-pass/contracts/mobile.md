# Contract: Mobile pass

## Hooks
- `useIsPhone(): boolean` — `(max-width: 900px)`; false when `matchMedia` is missing.
- `useMiniPlayer({ enabled, headerPx = 48, cancel }): { docked: boolean; sentinelRef: RefCallback<HTMLElement>; exitMini(): void }`
  — `docked` false when `!enabled || cancel`; `exitMini` scrolls to top (reduced-motion aware).

## VideoStage
- New props: `mini?: boolean`, `onExitMini?(): void`, `hideBadge?: boolean` (page passes on phones).
- Root gets `data-mini="true"` when docked; a placeholder `<div data-testid="stage-placeholder">`
  keeps the slot's aspect box. Mini frame includes `<button data-testid="mini-return">` (`copy.miniReturn`).

## MobileTabs
- Props: `{ tabs: { id: 'feed'|'party'|'map'|'log'; label: string; content: ReactNode }[]; initial?: TabId; onChange?(id) }`
- Testids: `mobile-tabs`, `tab-<id>` (role=tab), `tabpanel-<id>` (role=tabpanel, `hidden` when not selected).
- Keyboard: ArrowLeft/Right wrap, Home/End. Swipe threshold 40 px horizontal, ratio 2:1 vs vertical.

## RailPanel
- New prop `presentation?: 'rail' | 'sheet'` (default `'rail'`). Sheet: portal to `document.body`,
  `data-testid="sheet-backdrop"`, `sheet-handle`, root `rail-panel` keeps its id/role; `data-presentation="sheet"`.
- Drag-to-dismiss threshold: 25% of the sheet height. Height `70vh`, `85vh` when `(max-height: 500px)`.

## PartyRail
- New prop `layout?: 'row' | 'grid'` → `data-layout`; grid = two columns, odd last frame spans both.

## EpisodeLog
- New prop `embedded?: boolean` → always open, toggle hidden, header still shows the count.

## Copy
`miniReturn` "Return to the stage", `tabsLabel` "Broadcast panels", `tabFeed` "Feed", `tabParty` "Party",
`tabMap` "Map", `tabLog` "Log", `sheetHandle` "Drag down to close".

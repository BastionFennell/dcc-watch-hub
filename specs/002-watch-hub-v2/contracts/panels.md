# Contract: Right-rail panels

## State machine (`src/hooks/usePanel.ts`)

```ts
type Panel = { kind: 'none' } | { kind: 'dossier'; crawlerId: string } | { kind: 'map' };
interface PanelApi {
  panel: Panel;
  open(next: Exclude<Panel, { kind: 'none' }>, trigger: HTMLElement | null): void;   // switch or open
  toggle(next: Exclude<Panel, { kind: 'none' }>, trigger: HTMLElement | null): void; // same → close
  close(): void;                                                                    // focus returns to trigger
  isOpen(kind: Panel['kind'], crawlerId?: string): boolean;
}
```

- Exactly one panel at a time. `open` on a different target replaces without an intermediate close.
- `close()` focuses the trigger element captured by the most recent `open`/`toggle`, if it is
  still in the document.
- Escape (document `keydown`, not repeated): if a `header details[open]` exists, close that
  and stop; otherwise `close()`.
- Panel resets to `none` whenever the episode id changes.
- While a panel is open and the viewport is ≤ 900 px, `document.body` carries the class
  `panel-open` (`overflow: hidden`). Removed on close/unmount.

## Frame (`src/components/RailPanel/RailPanel.tsx`)

Props: `{ id: 'rail-panel'; title: string; kicker?: string; onClose(): void; children }`.
Renders `<section id="rail-panel" role="region" aria-labelledby=…>` with a header (mono caps
kicker, title, close button labelled from copy) and a scrollable body (`max-height` bound to
the viewport on desktop; full overlay ≤ 900 px). No panel content is animated except a 150 ms
fade-in honoring reduced motion.

## Triggers

| Trigger | Element | Attributes |
|---------|---------|------------|
| Crawler frame | `<button type="button">` | `aria-expanded`, `aria-controls="rail-panel"`, `data-crawler`, `data-panel-trigger="dossier:<id>"` |
| Minimap badge | `<button type="button">` | `aria-label` "Floor N — open the floor map" (visible text first: WCAG 2.5.3), `aria-expanded`, `aria-controls="rail-panel"`, `data-panel-trigger="map"` |

Both show pointer cursor, hover highlight, and a visible focus ring. Clicking an open trigger
closes its panel (toggle).

# Quickstart: Crawler Record

Same toolchain as before. Dev server: `npm run dev` (port 5180).

## Try it
- `http://localhost:5180/ep/1?fake=1&t=560&panel=dossier:harry` → the glance card (header, HP,
  rank + sparkline, debuffs, four ledger rows, three moments, **Open full record**).
- Click **Open full record** → the modal record in the sheet's landscape layout. Drag the
  scrubber while it is open; Inventory/History update live. Escape closes only the record.
- Resize to ≤ 900 px: the record fills the screen and stacks.

## Manual acceptance
1. SC-201: glance card height equal for Harry (most items) and The Actress (fewest) at 1440×900; no scroll.
2. SC-202: sweep `?t=` across Harry's event times; ledger counts/newest match the feed.
3. SC-203: open/close by Escape, backdrop, close button; Tab stays inside; playback unaffected.
4. SC-204: Lighthouse a11y 100; 360 px with the record open: no horizontal scroll.
5. SC-205: `npm test` green.

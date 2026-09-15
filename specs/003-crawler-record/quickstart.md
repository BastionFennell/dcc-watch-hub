# Quickstart: Crawler Record

Same toolchain as before. Dev server: `npm run dev` (port 5180).

## Try it

- `http://localhost:5180/ep/1?fake=1&t=560&panel=dossier:harry` → Harry's glance card in the
  rail. At 9:20 into `public/data/ep1.json` it reads, top to bottom:

  | Row | Value at `t=560` |
  |-----|------------------|
  | Header | Harry · Harold the Unhoused · Marcus · Compensated Anarchist · Lv 2 |
  | HP | 18/22 — nine of ten segments filled |
  | Rank | Current **#6402**, Best **#6402**, sparkline over three points (8890 → 7215 → 6402) |
  | Debuffs | "No debuffs on record." |
  | Hotlist | 1 · Bronze Box Runner |
  | Skills | 1 · Powerful Strike · Rank 1 |
  | Inventory | 2 · Torch |
  | Achievements | 1 · Gate Crasher · 2:34 |
  | Moments | 9:10 hotlist swap · 8:40 climbs to #6402 · 7:41 stows Torch |

  Then the one control: **Open full record**.

- `…&panel=dossier:actress` at the same time → the fixture's *thinnest* crawler: Hotlist 0 with
  the System's empty phrase, "Unranked" and no sparkline, two moments and one "—" placeholder.
  The card is the same height as Harry's (SC-201).
- Click **Open full record** → the modal record in the sheet's landscape layout. Drag the
  scrubber while it is open: past 7:41 backwards, Inventory swaps Torch back for the Enchanted
  Crowbar and History follows; the dialog neither closes nor moves. <kbd>Escape</kbd> closes only
  the record and focus lands back on **Open full record**.
- `http://localhost:5180/ep/1?fake=1&t=560&panel=dossier:harry&record=1` → the same, with the
  record already open on load (DEV only — the flag is stripped from production builds).
- Resize to ≤ 900 px: the record fills the screen and stacks.

## Manual acceptance

1. SC-201: glance card height equal for Harry (most items) and The Actress (fewest) at 1440×900; no scroll.
2. SC-202: sweep `?t=` across Harry's event times (72, 105, 154, 179, 240, 260, 290, 297, 394,
   410, 461, 520, 550); ledger counts/newest match the feed.
3. SC-203: open/close by Escape, backdrop, close button; Tab stays inside; playback unaffected.
4. SC-204: Lighthouse a11y 100; 360 px with the record open: no horizontal scroll.
5. SC-205: `npm test` green.

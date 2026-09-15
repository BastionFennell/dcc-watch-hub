# Quickstart: DCC Watch Hub v2

Same toolchain and commands as v1 (`specs/001-watch-hub-v1/quickstart.md`): Node 20.9.0,
`npm install`, `npm run dev` (port 5180), `typecheck`, `lint`, `test`, `build`, `preview`.

## Try the v2 features (dev scrubber)

Times below are verified against `public/data/ep1.json` (episode 1, 635 s). The `?t=` value is
seconds, so `t=560` opens the scrubber at 9:20.

- Dossier: `http://localhost:5180/ep/1?fake=1&t=560` → click **Harry** → the sheet, with a
  three-point rank sparkline (#8890 at 4:20, #7215 at 6:50, #6402 at 8:40; best #6402), Hotlist
  "Bronze Box Runner" (swapped in at 9:10), Skills "Powerful Strike", Inventory "Torch" (traded
  for the Enchanted Crowbar at 7:41), Achievements "Gate Crasher" (2:34), and History.
  Drag the scrubber back to 5:00 (300 s) → the sparkline drops to one point (#8890, current and
  best), the Hotlist reads "The Hoarder" again and the Enchanted Crowbar is back in Inventory.
  Back below 4:50 → the Hotlist is empty; below 4:20 → the rank reads "Unranked" and no
  sparkline is drawn; below 4:00 → the class reads "Unclassed"; below 2:34 → Achievements shows
  its System empty state.
  Press **Escape** → the feed returns and focus is on Harry's frame.
  For a skill that *changes rank*, click **X.O.** instead: Signal Discipline is Rank 1 until
  3:30 and Rank 2 after, and Breach Charge appears at 8:25.
- Map: same page → click the **Floor 1** badge → the expanded map with two labels, "The Meat
  District" (revealed 2:03) and "The Rot Market" (7:20). Scrub past 9:40 for the third, "The
  Gutter Stair". Zoom with the buttons or `+`/`-`, drag to pan, `0` or **Fit** to reset.
  Clicking a crawler frame while the map is open swaps it for the dossier — one panel at a time.
- Resume: open `/ep/1` (no `?t=`, no `?fake=1`), play past 0:30, reload → "Rejoin at m:ss" card;
  choose **Rejoin** → video and overlay land at that time. Play to the end, reload → no card.
  Note: opening with `?t=` starts the fake source past the 5 s grace window, which answers the
  offer by itself — use a plain `/ep/1` to see the card.
- Party rank: feed header shows "Party rank #61" from 5:17 (the episode's only party rank
  event); before that the line is omitted.

## Manual acceptance (spec §Success Criteria)

1. SC-101 dossier open/switch/close by mouse and keyboard; content sweep via `?t=` at event
   boundaries for one crawler.
2. SC-102 map labels at t; zoom/pan/fit; close restores feed.
3. SC-103 resume thresholds (under 30 s → no card; last 30 s → no card; end clears); private
   window → no card, no errors in console.
4. SC-104 sparkline points and summary text (inspect with the accessibility tree).
5. SC-105 all v1 checks still pass; Lighthouse ≥ 90; 360 px with a panel open: no horizontal scroll.
6. SC-106 ambient view unchanged except trigger affordances and the party rank line.

## Authoring

New CSV rows: `skill`, `class`, `hotlist` (see `contracts/sheet-csv.md`). Optional crawler sheet
fields go in the `--initial-state` file.

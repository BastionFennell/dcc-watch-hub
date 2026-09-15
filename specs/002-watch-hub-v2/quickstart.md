# Quickstart: DCC Watch Hub v2

Same toolchain and commands as v1 (`specs/001-watch-hub-v1/quickstart.md`): Node 20.9.0,
`npm install`, `npm run dev` (port 5180), `typecheck`, `lint`, `test`, `build`, `preview`.

## Try the v2 features (dev scrubber)

- Dossier: `http://localhost:5180/ep/1?fake=1&t=200` → click **Harry** → sheet with a
  three-point rank sparkline, Hotlist, Skills, Inventory, Achievements, History. Drag the
  scrubber back below 2:30 → items disappear. Press **Escape** → feed returns, focus on Harry.
- Map: same page → click the **Floor 1** badge → expanded map with two labels. Zoom with the
  buttons or `+`/`-`, drag to pan, `0` or **Fit** to reset.
- Resume: open `/ep/1`, play past 0:30, reload → "Rejoin at m:ss" card; choose **Rejoin** →
  video and overlay land at that time. Play to the end, reload → no card.
- Party rank: feed header shows "Party rank #…" once a party rank event has elapsed.

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

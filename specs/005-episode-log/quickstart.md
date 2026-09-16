# Quickstart: Broadcast log
- `http://localhost:5180/ep/1?fake=1&t=580` → scroll below the party rail: "Broadcast log · N moments". Open it; filter by type and crawler; click a row to seek; share a row.
- Drag the scrubber back: rows vanish; forward: rows append and the list follows unless you scrolled up.
- Reload: the log stays open (preference).
## Manual acceptance
1. SC-401 sweep at event boundaries (fake scrubber) — rows equal elapsed events.
2. SC-402 filters at t=200 (fixture) / t=580 (sample) give expected subsets and counts.
3. SC-403 row seek + share; opening the log leaves stage/rail rects unchanged.
4. SC-404 Lighthouse a11y 100 with the log open; 360 px no horizontal scroll.

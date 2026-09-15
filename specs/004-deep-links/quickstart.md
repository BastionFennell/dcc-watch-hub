# Quickstart: Deep links + share
- Deep link (dev scrubber): `http://localhost:5180/ep/1?fake=1&t=156` → starts at 2:36 with the overlay synced; no rejoin card even if one is saved.
- Deep link (real embed): `http://localhost:5180/ep/1?t=156` → the player seeks to 2:36 once ready (and starts playing per host behaviour).
- Share: caption row → "Share this moment" copies `http://localhost:5180/ep/1?t=<now>`; each feed row has a share icon for its event time. On a phone the share sheet opens instead.
## Manual acceptance
1. SC-301 deep link lands within 1 s with correct overlay (fake + real embed).
2. SC-302 caption and feed-row share copy the exact URL; notice appears ~2 s; screen reader announces once.
3. SC-303 resume suppressed only on deep-linked visits.
4. SC-304 tests green; Lighthouse a11y 100.

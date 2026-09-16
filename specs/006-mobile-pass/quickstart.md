# Quickstart: Mobile pass
Use Chrome DevTools device mode (or a phone on the LAN: `npm run dev -- --host`) at 400×800:
- `/ep/1?fake=1&t=580`: tabs (Feed / Party / Map / Log) directly under the timeline; Feed rows above the fold.
- Scroll down in the Feed or Log tab: the player docks top-right as a mini-player and keeps playing; tap "Return to the stage".
- Party tab → tap a frame → glance opens as a bottom sheet; drag it down to close; "Open full record" still opens full-screen.
- Map tab: inline floor map with zoom/pan. Log tab: the open broadcast log.
- Desktop unchanged.
## Manual acceptance
SC-501 dock/undock + slot height; SC-502 fold + tabs (tap/swipe/arrows) + pane sweep; SC-503 sheet open/close paths + video visible; SC-504 Lighthouse a11y 100 at 400 px, no horizontal scroll 360–430, desktop tests unchanged.

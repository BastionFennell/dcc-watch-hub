Dungeon Crawl Cast — UX Review Punch List
Context for the agent
This is a synced companion site for a Dungeon Crawler Carl actual-play. Routes observed: / (Broadcast archive), /ep/1, /ep/2, /ep/3, and a catch-all 404. Each episode page has a YouTube embed, a chapter-marker timeline strip, a party status row, and a right-rail panel that switches between the event feed, a "Crawler Glance" record, and a "System Cartography" floor map. Page state (HP, level, statuses, feed contents, map reveals) is derived from the video's current time, and clicking a timeline marker seeks the player and rewinds all derived state. That derivation engine works well — do not refactor it. Everything below is additive or a bug fix.
Before starting, locate these strings to orient yourself: "3 of 96 sectors revealed", "SYSTEM CARTOGRAPHY", "Open full record", "CRAWLER GLANCE", "Broadcast archive", "BROADCAST BOOKMARK", "Boss encounter at", "REPLACE_ME".
Work in the phase order given. Phases 0 and 1 are the ones that change whether the site works for a real viewer.

Phase 0 — Bugs
0.1 Empty history row renders as a bare dash
The Crawler Glance HISTORY list renders three <li> elements when only two have content; the third displays as –. Filter empty entries before render.
Accept: Stuntman at 2:36 shows exactly two history rows, no dash.
0.2 Floor map does not persist across episodes on the same floor
Episode 2 is Floor 1, but its map at 0:00 shows zero revealed sectors — the Meat District revealed during Episode 1 is gone. Floor reveal state must accumulate across all episodes on that floor, seeded from every prior episode's reveals up to the current playhead.
Accept: /ep/2 at 0:00 shows the Meat District already revealed; /ep/3 (Floor 2) starts empty.
0.3 Empty right rail on fresh episode load
/ep/2 and /ep/3 at 0:00 render only the header Event feed · synced 0:00 above a tall empty column. Add an in-world empty state.
Accept: Zero-event state shows copy in the System's voice (e.g. "Standing by. The System reports when the broadcast begins.") rather than blank space.
0.4 Map panel has no empty state and hides its own stat
SYSTEM CARTOGRAPHY with nothing revealed is an unexplained dark grid. Also, the string "3 of 96 sectors revealed" exists in the DOM (inside the minimap trigger button) but is never displayed in the expanded panel.
Accept: Panel displays the revealed/total count in its header, and shows an empty-state line when count is 0.
0.5 ACHIEVEMENTS row label truncated with space available
Renders as ACHIEVEMEN… in the Crawler Glance rail. Fix the column width or allow the label to shrink.
0.6 Full-record modal overlaps the still-open glance rail
Clicking Open full record leaves the Crawler Glance panel mounted behind the modal, and during the transition both layers of identical data are visible through each other. Either close/hide the rail on modal open, or make the modal opaque from the first frame.
Accept: No frame in which glance content is visible through the modal.
0.7 Screen-reader string concatenation
Accessible names compute as "Dungeon Crawler DannyDanny" and "UnclassedLv 1" — the visual · separators aren't in the accessibility tree. Add real separator text or restructure the markup.
0.8 Redundant crawler identity line
Dungeon Crawler Danny · Danny displays the player name twice in effect. Relabel to distinguish player from character, e.g. The Stuntman / played by Danny.
0.9 Party name truncation at mid widths
Between roughly 950–1050px, names clip to The Stu… / The Act…. Add an intermediate breakpoint that wraps to two rows of cards before truncating.
0.10 Status badge causes row height jitter
The Poisoned badge grows The Psychic's card taller than its siblings, so the row visibly jumps when a status applies or clears. Reserve a fixed-height badge slot on every card.
0.11 Video time overlay is illegible and collides with YouTube chrome
Ep 1 · Floor 1 · 4:12 is drawn on the player with no scrim, sits directly where YouTube's control bar and its own timestamp appear, and disappears against bright frames. Move it out of the player frame (above the timeline strip is the natural home) or add a gradient backing.
0.12 Placeholder Discord URL
https://discord.gg/REPLACE_ME is live in the header and in the mobile menu.
0.13 Episode title is visually hidden
The <h1> ("Episode 1 — The World Dungeon") is sr-only, so the episode name never appears on screen — only S1 · Floor 1 · Episode 1 in small header text. Make the title visible.

Phase 1 — Discoverability and legibility
1.1 Make the timeline strip readable — highest priority item on this list
Nine unlabeled colored dots with no legend, no hover state, and no click affordance. The state-rewind feature is the best thing the site does and is currently undiscoverable. Add:

Hover and keyboard-focus tooltips showing the marker label and timestamp
A compact legend mapping color to event type (chapter / achievement / level / loot / boss / map)
A visual affordance that markers are interactive (cursor, scale-on-hover, subtle ring)
A distinct playhead indicator, separate from the progress fill

Accept: A first-time visitor who has not read documentation can tell what the dots mean and that they're clickable.
1.2 One-time coach mark on the player
On first visit, briefly point at the timeline strip: "Jump to any moment — the System feed rewinds with you." Dismissible, persisted, never shown again.
1.3 HP bar reads as damaged at full health
The segmented bar runs red → green across its full width, so 22/22 still shows red segments on the left. Replace with a single fill color that changes by threshold (green above ~60%, amber ~25–60%, red below ~25%). Keep the existing aria-label="22 of 22 HP" pattern.
Accept: A crawler at full HP shows a uniformly healthy bar.
1.4 Label the rank values
Unranked floats under the vitals bar with no label, and Party rank #61 gives no scale or direction. Add a field label and a delta indicator (↑/↓ with change since last event) so the number carries meaning.
1.5 System feed header pill is decorative but looks interactive
It renders as a pill next to the logo and reads as a tab or toggle; it's a non-interactive generic. Either restyle it as a passive status badge (no border/button affordance) or make it a real control that focuses the feed.
1.6 Make event feed items clickable
Every feed entry has a timestamp behind it. Clicking should seek the player and rewind state, same as a timeline marker. Render the timestamp on each row.
Accept: Clicking "Harry earns Gate Crasher" jumps the broadcast to that moment.
1.7 Full episode log with scrollback
The feed is a rolling window of roughly eight items — by 8:59 the entire cold open is unreachable. Add a scrollable full log for the episode, filterable by event type and by crawler, with click-to-seek. All data already exists; it's being discarded.
1.8 Real spoiler-free mode
Current masking is good but leaky: future markers still expose type via color and their accessible name reads "Boss encounter at 6:14". Add a persisted toggle that, when on, renders future markers as neutral undifferentiated ticks with generic labels ("Upcoming moment"), revealing type, color, and name only once the playhead passes.
1.9 Deep-linkable moments + share
Support ?t=<seconds> on episode routes, hydrating the full derived state on load. Add a "Share this moment" action on the player, timeline markers, and feed rows that copies the deep link. This is the cheapest distribution win available — clips shared in Discord come back to the site pre-synced.
Accept: /ep/1?t=156 loads with the player at 2:36 and the feed, party, and map matching.
1.10 Settings panel
No preferences UI exists. Add one covering: spoiler-free mode, reduced motion, event sound cues (off by default), feed density, and toast duration.
1.11 Fill desktop dead space
Large empty region below the party row on every episode page. Use it for the episode log, an achievement strip, or the expanded map so new surfaces need no new navigation.

Phase 2 — Mobile
Tested at 420×860. This is probably the dominant form factor for a watch-along.
2.1 Sticky mini-player
Scrolling to read the feed scrolls the video off screen entirely. Pin the player to the top as a compact bar once it leaves the viewport.
Accept: The video remains visible and playing while the feed is scrolled.
2.2 Feed starts below the fold
The augmented content — the reason the site exists — requires a scroll to discover. Restructure to sticky player + swipeable tabs (Feed / Party / Map) directly beneath it.
2.3 Crawler panel is a full-screen takeover
Tapping a party card replaces the whole viewport and hides the video. Convert to a bottom sheet at ~70% height so the player stays visible.
2.4 Orphan party card row
Five cards wrap 3 + 2 at 420px, leaving a ragged row. Use a horizontally scrollable strip or a 2-column grid.

Phase 3 — New surfaces
The app tracks ranks, levels, classes, inventory, achievements, hotlists, and floor reveals across episodes, but none of it is reachable outside the player. These give the site a reason to exist between episodes.
3.1 Rebuild the homepage. Currently a bare list of three episodes with no thumbnails, durations, air dates, or synopses — and no explanation of what the site is. Add a hero that demonstrates the rewind mechanic, plus episode cards with artwork, runtime, and a spoiler-safe logline. Surface the existing BROADCAST BOOKMARK resume state here as "Continue watching."
3.2 Crawler roster page. Player, character, class, level and stat progression across episodes, full achievement and inventory history. Link from every party card and from the full-record modal.
3.3 Leaderboard page. Party and individual rank over time with a sparkline. You're already emitting Rank · X.O. climbs to #4188 overall events; nothing consumes them.
3.4 Achievement gallery. Unlocked achievements with flavor text and timestamp; locked ones as silhouettes. Very cheap on top of existing data, very satisfying to browse.
3.5 Interactive floor map. Sectors are currently inert — clicking a revealed cell does nothing. Make each sector show what happened there, with click-to-seek to the moment it was revealed, a traced party route, and a "current position" marker.

Phase 4 — Backlog
Bestiary of mobs encountered; loot and item tooltips with flavor text; "since last episode" recap card; crawler comparison view; premiere live mode with timestamp-anchored polls and predictions; System chime on new events (respecting 1.10); picture-in-picture; keyboard shortcuts (space, ←/→, J/K/L); per-episode hidden easter-egg hunt with a found counter.

Notes and non-goals
Console was clean across all routes — no errors or warnings during playback, seeking, or panel transitions. The time-derivation engine, the spoiler-aware marker labeling, the BROADCAST BOOKMARK resume prompt, the in-world 404, the sponsored/System announcement event types, the skip link, the focus rings, the HP aria-labels, the status live region, and Escape-to-close on the modal are all working well and should survive this work unchanged.
The video sources are Blender open movies, which I assume are intentional placeholders.
Two things I could not verify and you should check directly: whether focus returns to the triggering element when the full-record modal closes, and whether the feed's live region announces new events at a sane rate during playback rather than firing on every tick.

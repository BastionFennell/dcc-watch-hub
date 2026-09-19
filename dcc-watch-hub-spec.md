# Dungeon Crawl Cast - Watch Hub ("System Feed") - v1 Spec

Handoff doc for Claude Code. Build v1 exactly as scoped; v2/v3 items are parked at the bottom and must not leak into v1.

## 1. Concept

A watch-along site for the Dungeon Crawl Cast actual play show. The viewer watches an episode with a synchronized, interactive overlay styled as the in-fiction System's broadcast feed - party status, live event ticker, achievements, map, and sponsor slots, all derived from a per-episode event log synced to the video playhead. The viewer is positioned as a member of the (in-fiction) galactic audience.

**Design principles (non-negotiable):**
1. **Time-truth.** All overlay state is a pure function of the event log filtered to `event.t <= playhead`. Scrubbing backward rewinds the feed. Nothing may render ahead of the playhead (no spoilers).
2. **Ambient by default.** Default view = video + party rail + ticker. Everything deeper is opt-in via click. Lean-back broadcast, not a dashboard.
3. **Diegetic.** UI copy and styling are the System's voice. Nav is a "broadcast archive," ads are "sponsors," episodes are "recap episodes."
4. **Host-agnostic playback.** Components never reference YouTube directly; all timing flows through a `TimeSource` interface.

## 2. v1 Scope

- Static site. No backend, no accounts, no database.
- One page per episode + a hub homepage (episode archive) + site header.
- Data: one JSON file per episode (`/data/ep{N}.json`) + one show-level JSON (`/data/show.json`).
- Video: YouTube embed via IFrame Player API.

**v1 excludes:** character sheet deep-dive panels, interactive minimap, localStorage resume, live/premiere sync, self-hosted video, comments, accounts.

## 3. Architecture

- Stack: Vite + React + TypeScript (or Preact if bundle size matters; author's choice). Plain CSS or CSS modules - no heavy UI framework.
- Deploy target: static host (GitHub Pages / Netlify / Cloudflare Pages).
- All episode data fetched as static JSON at page load.

### 3.1 TimeSource interface

```ts
interface TimeSource {
  /** Current playhead in seconds (content time, not wall time). */
  getTime(): number;
  /** Subscribe to time updates (~4 Hz polling is fine). Returns unsubscribe. */
  onTick(cb: (t: number) => void): () => void;
  onPlay(cb: () => void): () => void;
  onPause(cb: () => void): () => void;
  onEnded(cb: () => void): () => void;
  seek(t: number): void;
}
```

v1 ships one implementation: `YouTubeTimeSource` wrapping the IFrame Player API (`getCurrentTime()` polled at 250ms while playing). Player ads pause content time, so sync holds automatically. All overlay components consume `TimeSource` only.

### 3.2 State model

```
state(t) = reduce(episode.initialState, events.filter(e => e.t <= t))
```

- Reducer is pure and deterministic. On seek, recompute from `initialState` (event counts are small; no memoization needed in v1 - do not prematurely optimize).
- A `selector` layer derives view models: party frames, ticker items (last N events, newest first), active toast (achievement within last 6s of playhead), timeline markers, map cell states, current sponsor.

## 4. Data schemas

### 4.1 show.json

```json
{
  "title": "Dungeon Crawl Cast",
  "seasons": [
    {
      "season": 1,
      "floors": [
        { "floor": 1, "label": "Floor 1", "episodes": [1, 2, 3, 4] },
        { "floor": 2, "label": "Floor 2", "episodes": [5, 6, 7] }
      ]
    }
  ],
  "episodes": [
    {
      "id": 1,
      "title": "Episode 1 - The World Dungeon",
      "youtubeId": "XXXXXXXXXXX",
      "floor": 1,
      "durationSec": 5400,
      "dataUrl": "/data/ep1.json"
    }
  ],
  "links": { "youtube": "...", "discord": "..." }
}
```

### 4.2 ep{N}.json

```json
{
  "episodeId": 1,
  "initialState": {
    "party": [
      {
        "id": "stuntman",
        "name": "The Stuntman",
        "handle": "Dungeon Crawler Danny",
        "player": "Danny",
        "level": 1,
        "hp": { "current": 20, "max": 20 },
        "portrait": "/img/crawlers/stuntman-bust.png",
        "class": null,
        "inventory": ["..."],
        "rank": null
      }
    ],
    "partyRank": null,
    "map": { "floor": 1, "grid": { "cols": 12, "rows": 8 }, "revealed": [] }
  },
  "events": [
    { "t": 141, "type": "system_message", "text": "Welcome, crawlers." },
    { "t": 300, "type": "achievement", "actor": "harry", "title": "Gate Crasher", "desc": "Killed 10 mobs with a door" },
    { "t": 462, "type": "loot", "actor": "harry", "item": "Enchanted Crowbar", "source": "Bronze Adventurer Box" },
    { "t": 500, "type": "hp", "actor": "harry", "current": 3, "max": 22 },
    { "t": 610, "type": "level_up", "actor": "xo", "level": 2 },
    { "t": 700, "type": "rank", "scope": "party", "rank": 61 },
    { "t": 820, "type": "map_reveal", "cells": [[3,2],[4,2]], "label": "The Meat District" },
    { "t": 900, "type": "sponsor", "text": "This death brought to you by Grull Industries", "durationSec": 20 },
    { "t": 1000, "type": "chapter", "label": "The Hoarder Fight", "kind": "boss" },
    { "t": 1100, "type": "status", "actor": "psychic", "add": ["Poisoned"], "remove": [] },
    { "t": 1200, "type": "inventory", "actor": "harry", "add": ["Torch"], "remove": ["Enchanted Crowbar"] },
    { "t": 1300, "type": "note", "text": "Freeform GM annotation, ticker-only" }
  ]
}
```

Rules:
- `t` = seconds into the **final edited video** (source of truth is the edit timeline, logged during the edit pass).
- `actor` references a party `id`. Events without `actor` are party/system scoped.
- Unknown event types must be ignored gracefully (forward compatibility).
- `chapter` events with `kind` in `{boss, loot, achievement, levelup, story}` render as colored timeline markers; all achievements/level_ups also auto-mark.

### 4.3 Authoring pipeline

Editor logs events in a Google Sheet during the edit pass with columns: `timecode (hh:mm:ss), type, actor, field1, field2, field3`. Provide `scripts/sheet-to-json.ts` that converts an exported CSV to `ep{N}.json` and validates it (unknown actors, non-monotonic HP without an event, timecodes past duration → warnings, not errors).

## 5. Components

```
<App>
  <SiteHeader/>            // persistent, slim, dark
  <EpisodePage>            // route: /ep/:id
    <VideoStage>           // 16:9, YouTube iframe
      <AchievementToast/>  // overlays stage, top-left, 6s, queued
      <MiniMapBadge/>      // bottom-right, static reveal state at t (non-interactive in v1)
      <NextEpisodeCard/>   // on ended: System-styled "Next recap episode →"
    </VideoStage>
    <EventTimeline/>       // marker bar under stage; markers seek on click
    <PartyRail/>           // 5 crawler frames: portrait, name, level, HP bar, status pips
    <EventFeed/>           // right rail; newest-first; System/loot/rank/sponsor/map items
  </EpisodePage>
  <HubPage>                // route: /
    <EpisodeArchive/>      // grouped by floor, from show.json
  </HubPage>
</App>
```

### SiteHeader (v1)
- Left: DCC mark → hub homepage.
- Center: `S1 · Floor {n} · Episode {n}` with prev/next episode arrows (plain links from show.json ordering; hidden at ends).
- Right: "Episodes" dropdown grouped by floor; YouTube + Discord links.
- Slim (≤48px), dark, collapses/shrinks on scroll. Mobile: collapses to mark + episode label + menu.

### Behavior details
- **PartyRail:** HP bar animates on change; frame border flashes danger color when HP < 25%; level-up pulses the frame. Clicking a frame is a no-op in v1 (cursor default - do not tease v2).
- **EventFeed:** shows last 8 events at playhead; scrubbing back removes future items. System messages styled as blue System boxes; sponsors as purple slots.
- **AchievementToast:** one at a time, FIFO queue if events cluster.
- **EventTimeline:** thin bar, chapter/event markers positioned by `t/durationSec`; click = `seek(t)`. Tooltip label on hover.
- **Sync:** all components re-render from `state(t)` on tick; UI must remain correct after arbitrary seeking in either direction.

## 6. Visual language

- Dark canvas (#131320-family), panel #1d1d28, hairline borders.
- System blue boxes: bg #0C447C, text #B5D4F4. Brand purple: #3C3489/#534AB7, text #CECBF6/#EEEDFE. Achievement amber: #633806/#FAC775. Danger #E24B4A, HP green #639922.
- Typography: clean sans; System boxes may use a slightly condensed/mono accent. All caps acceptable inside System boxes only.
- Sounds: none in v1 (autoplaying audio over a video player is hostile). Park stinger audio for v2 behind explicit user toggle.

## 7. v1 Acceptance checklist

- [ ] Loads an episode page from static hosting with only `show.json` + `ep{N}.json`.
- [ ] Overlay state is correct at t=0, mid-episode, after seeking backward, after seeking forward, and after refresh mid-episode.
- [ ] No event ever renders before its `t`.
- [ ] Party rail reflects HP/level/status at playhead within 500ms of any seek.
- [ ] Timeline markers seek correctly.
- [ ] Ended state shows Next Episode card; header prev/next navigate correctly; ends handled.
- [ ] Hub page lists episodes grouped by floor.
- [ ] Playable on desktop Chrome/Firefox/Safari; mobile shows stacked layout (video, rail, feed) without horizontal scroll.
- [ ] Sheet-to-JSON script converts the sample CSV and flags a deliberately broken row.
- [ ] Lighthouse perf ≥ 90 on episode page (static JSON, no blocking fonts).

## 8. Parked (v2/v3 - do not build)

- v2: click-open character sheets (inventory/skills/hot list history), interactive minimap with pan/labels, localStorage resume, stinger sounds (opt-in), roster page with commissioned art, per-crawler fame/rank sparklines.
- v3: self-hosted/alternate video sources (new TimeSource impls), live premiere sync, sponsor slot management, accounts.

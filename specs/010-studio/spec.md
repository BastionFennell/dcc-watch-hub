# Feature 010 - The Studio (event editor)

Author (2026-09-19): "It's time to make the editor/creator. We need an interface to easily make
these events synced with the video. Watch the video, pause it, add an event, pick an event type,
then pick the content that event type needs. That needs to be saved somewhere that I can eventually
upload to the site."

## What it is
A desktop authoring page at `/studio` that plays an episode's video, lets the author drop events at
the playhead through type-specific forms, previews the real overlay from the draft, autosaves
locally, and exports the exact `ep{N}.json` the viewer loads (plus the `show.json` entry).

## User stories
1. **Mark a moment** (P1): while watching, I press `E` (or the Add button). Playback pauses, a form
   opens with the time set to the playhead. I pick a type, fill only what that type needs, save.
   The event appears in the list and on the timeline; optionally playback resumes.
2. **Fix a moment** (P1): I click an event in the list; the video seeks there and the form opens.
   I can edit fields, retime it to the current playhead, nudge by a second, duplicate, or delete.
   Undo and redo cover everything.
3. **See what viewers see** (P1): a preview shows the party cards and feed computed from my draft
   at the playhead, using the viewer's own reducer and components.
4. **Keep my work** (P1): the draft autosaves in this browser. I can download `ep{N}.json`, or (in
   Chromium) pick the repo's `public/data/` folder once and save straight into it. I can reopen an
   exported file or a published episode and keep editing.
5. **Start an episode** (P2): I enter number, title, YouTube link, and floor, and choose where the
   party starts: the initial party of another episode, the final state of another episode, or
   empty. Duration fills in from the player.
6. **Catch mistakes** (P2): an issues list runs the viewer's validation on my draft (unknown actor,
   unknown spell or NPC ref, event past the duration, missing fields) and jumps to the offender.

## Requirements
- FR-1000 Route `/studio` (drafts list, new episode, open file, edit a published episode) and
  `/studio/ep/:id` (the editor). Lazy chunk; not linked from viewer navigation.
- FR-1001 Transport: play/pause, -5/-1/+1/+5 s, rate 0.5/1/1.5/2, mono timecode, all through the
  `TimeSource` transport extension. Works with the dev fake source (`?fake=1`).
- FR-1002 Hotkeys (ignored while typing, except modifier combos and Escape): Space play/pause,
  J/L -5/+5 s, Left/Right -1/+1 s, E add event at playhead, T retime selected to playhead,
  D duplicate selected at playhead, Delete/Backspace remove selected, Cmd/Ctrl+Z undo,
  Shift+Cmd/Ctrl+Z redo, Cmd/Ctrl+S save/export, Escape close form. In the form: Cmd/Ctrl+Enter
  save, Shift+Cmd/Ctrl+Enter save and resume playback.
- FR-1003 Every type in `KNOWN_EVENT_TYPES` has a form generated from one declarative table.
  Forms offer only valid choices: actors from the party, spells and NPCs from the registries,
  gear slots, chapter kinds, rooms of the current floor, removable entries from the actor's state
  at that time. Free text stays free. The last-used actor and type are remembered.
- FR-1004 Smart defaults from `reduceTo(draft, t)`: hp/mana prefill the actor's current values,
  level_up prefills level + 1, spell/skill prefill the next rank when the actor already has it.
- FR-1005 Times are whole seconds by default, editable as `m:ss` or `h:mm:ss`, clamped to
  `[0, duration]`. Events stay sorted by time; ties keep insertion order.
- FR-1006 Event list: time, type chip, the viewer's own feed sentence for that event, filters by
  type group and actor, click to seek and select. Timeline strip under the video shows markers.
- FR-1007 Undo/redo history (100 steps) over add, edit, retime, duplicate, delete, meta, and party
  edits.
- FR-1008 Autosave to `localStorage` under `dcc.studio.v1.*` within one second of a change, with a
  visible "saved" state and a clear error if storage fails. Drafts survive reloads.
- FR-1009 Export produces schema-valid episode JSON (`specs/009-mana/contracts/episode.schema.json`)
  with stable key order and two-space indentation, so diffs are clean. Also copies or saves the
  `show.json` entry. "Save to data folder" uses the File System Access API when present and is
  hidden otherwise; download always works.
- FR-1010 Import: an episode JSON file, or a published episode fetched from `show.json`.
- FR-1011 Party start: copy initial party of episode X, final state of episode X, or empty; plus a
  validated raw-JSON editor per crawler as the escape hatch.
- FR-1012 Below 1000 px width the editor shows a "needs a wider screen" notice. Authoring on a
  phone is a non-goal.
- FR-1013 Accessibility: every control is keyboard reachable and labelled; focus moves into the
  form on open and back to the trigger on close; axe clean on `/studio/ep/:id`.

## Non-goals (later milestones)
Editors for `npcs.json`, `spells.json`, floors/maps, or a full crawler-sheet form; publishing from
the browser (a GitHub commit button); collaboration; thumbnails or waveforms; CSV import.

## Acceptance
- Author a ten-event episode against the fake source using only the keyboard; export; the file
  validates against the schema and loads in the viewer at `/ep/:id` with identical overlay state.
- Every event type round-trips: form -> draft -> export -> `normalizeEpisode` -> same event.
- Reload mid-edit loses nothing. Undo returns to the exact prior draft.
- `npm run build` shows the Studio in its own chunk and the main chunk within 2 kB of before.

## Status (2026-09-23)
Shipped on PR #12 (author: "good enough for now"). Left for later milestones, in rough value order:
1. **Publish from the browser**: a GitHub commit button (needs a token flow and a decision on Pages
   / repo visibility, since `spells.json` carries book text).
2. **Crawler sheet form**: a proper per-crawler editor (identity, stats, HP/mana, hotlist, spells,
   skills, inventory, gear) replacing the raw-JSON escape hatch in the Episode tab.
3. **Registry editors**: NPCs (`npcs.json`) and spells (`spells.json`) with the same validate /
   export pipeline; floors and maps (`show.json` floors, rooms, reveal cells with a visual picker).
4. **Editor ergonomics**: waveform or thumbnail strip under the timeline; drag markers to retime;
   multi-select; delete confirmation option; CSV import through `sheet-to-json` in the browser.
5. **Persistence**: keep the data-folder handle across sessions (IndexedDB), draft export/import
   bundles, and a conflict check against the published file before overwriting.
6. **Small known gaps**: episode number is read-only once a draft exists; duration must be set
   before event times clamp; the preview rail's cards are narrower than the viewer's (835 px column).

# Plan - 010 Studio

Constitution check: I (preview uses `reduceTo`), II (transport extension; YouTube id parsing lives
in `src/playback/youtubeId.ts`), IV (no new deps, lazy chunk), VI (this is the pipeline), VII (all
rules). Stack unchanged.

## Layout
```
src/playback/TimeSource.ts        + Transport, ControllableTimeSource, hasTransport()
src/playback/{YouTube,Fake}TimeSource.ts  implement Transport
src/playback/youtubeId.ts         parseYouTubeId(urlOrId) -> string | null
src/studio/                        (React-free unless noted)
  draft.ts        StudioDraft, DraftEvent, newDraft(), draftFromEpisode(), toEpisodeData()
  history.ts      reducer + undo/redo (cap 100): add/update/retime/duplicate/remove event,
                  setMeta, setParty, replaceDraft
  timecode.ts     parseTimecode("1:02:03"|"4:05"|"245") / formatTimecode(sec)
  eventForms.ts   EVENT_FORMS table + field kinds + groups
  defaults.ts     defaultsFor(type, actorId, stateAtT, registries) (FR-1004)
  options.ts      actorOptions, spellOptions, npcOptions, slotOptions, roomOptions,
                  removableEntries(stateAtT, actorId, kind)
  buildEvent.ts   values -> raw event (omits empty optionals); eventToValues (for editing)
  validateDraft.ts issues[] {severity, message, uid?} using normalizeEpisode + registry checks
  exporter.ts     toEpisodeJson(draft) (stable key order), toShowEntry(draft)
  importer.ts     fromEpisodeJson(raw, meta?) -> draft (+warnings)
  partySource.ts  partyFromInitial(ep), partyFromFinalState(ep) (CrawlerState -> Crawler)
  storage.ts      listDrafts/loadDraft/saveDraft/deleteDraft under dcc.studio.v1.*
  files.ts        downloadJson, openJsonFile, canPickFolder, pickDataFolder, writeToFolder
  copy.ts         Studio UI strings (plain functional voice; not in the viewer's copy.ts)
  hooks/          useStudioDraft (reducer + autosave), useTransport, useStudioHotkeys  (React)
  components/     Transport, EventList, StudioTimeline, EventForm, TypePicker, fields/*,
                  PreviewPane, IssuesPanel, StudioHeader, NewEpisodeDialog, PartyEditor (React)
  pages/          StudioHomePage, StudioEpisodePage (React, default exports for React.lazy)
```

## Contracts
```ts
// TimeSource.ts
export interface Transport {
  play(): void; pause(): void; isPaused(): boolean;
  getDuration(): number | null;      // null until the host knows
  setRate(rate: number): void; getRate(): number;
}
export type ControllableTimeSource = TimeSource & Transport;
export function hasTransport(s: TimeSource): s is ControllableTimeSource;

// draft.ts
export interface DraftMeta { id: number; title: string; youtubeId: string; floor: number; durationSec: number }
export interface DraftEvent { uid: string; event: Record<string, unknown> & { t: number; type: string } }
export interface StudioDraft { version: 1; meta: DraftMeta; initialState: unknown /* raw, as exported */; events: DraftEvent[]; updatedAt: string }

// eventForms.ts
export type FieldKind = 'actor' | 'text' | 'longtext' | 'int' | 'select' | 'bool'
  | 'spellRef' | 'npcRef' | 'slot' | 'room' | 'chapterKind' | 'entryAdd' | 'entryRemove';
export interface FieldSpec { key: string; kind: FieldKind; label: string; required?: boolean;
  min?: number; options?: readonly string[]; help?: string; entryKind?: 'inventory' | 'hotlist' }
export interface EventFormSpec { type: EventType; group: 'story' | 'crawler' | 'items' | 'abilities' | 'world';
  label: string; fields: readonly FieldSpec[] }
export const EVENT_FORMS: Record<EventType, EventFormSpec>;

// components (props)
EventForm:   { draft, registries, t, editing?: DraftEvent, lastActor?, lastType?, onSave(event, opts:{resume:boolean}), onCancel(), onRetimeToPlayhead?() }
PreviewPane: { draft, registries, t }
IssuesPanel: { issues, onSelect(uid) }
EventList:   { draft, registries, selectedUid?, t, onSelect(uid), filters }
```
The event field lists come from `src/data/types.ts` and `validate.ts`; the table must cover every
field those accept. A table-driven test builds each type from its required fields and asserts
`normalizeEvent` returns the same type (not `unknown`) and the export validates against the schema.

## Screen (>= 1000 px)
Header: Studio / episode title / save state / Undo Redo / Import / Export menu.
Left column (flex 3): VideoStage (reused, `?fake=1` in dev) -> Transport bar with the big timecode
and "Add event at m:ss (E)" -> StudioTimeline markers -> PreviewPane (PartyRail + EventFeed from the
draft at t; collapsible).
Right column (flex 2, min 380 px): tabs Events | Issues (count) | Episode (meta + party). Opening
the form replaces the tab body; closing returns to the list with the event selected and scrolled
into view.
Visual language: the existing tokens and panel styles; functional, dense, no System-voice copy.

## Waves (sequential; one Opus agent each; orchestrator commits between waves)
- **A - foundations**: T1001-T1012 (playback transport, all React-free `src/studio/*.ts`, tests).
- **B - forms, preview, issues**: T1013-T1019 (`EventForm`, `TypePicker`, `fields/*`, `PreviewPane`,
  `IssuesPanel`, studio copy for them, component tests).
- **C - shell and integration**: T1020-T1030 (routes + lazy, pages, hooks, Transport, EventList,
  StudioTimeline, header/export/import, NewEpisodeDialog, PartyEditor, hotkeys, narrow notice,
  README, axe, bundle check, end-to-end round-trip test).

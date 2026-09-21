# Tasks - 010 Studio

## Wave A - foundations
- [X] T1001 `Transport` + `hasTransport` in `TimeSource.ts`; contract note in `specs/010-studio/plan.md` is authoritative
- [X] T1002 `FakeTimeSource` implements Transport (+tests: play/pause/rate/duration)
- [X] T1003 `YouTubeTimeSource` implements Transport (playVideo/pauseVideo/getDuration/setPlaybackRate) (+tests with the existing player mock)
- [X] T1004 `src/playback/youtubeId.ts` parse watch/short/embed/live URLs and bare ids (+tests)
- [X] T1005 `draft.ts`, `timecode.ts` (+tests)
- [X] T1006 `history.ts` reducer with undo/redo, sorted insert, stable ties (+tests)
- [X] T1007 `eventForms.ts` table for all KNOWN_EVENT_TYPES (+coverage test)
- [X] T1008 `options.ts`, `defaults.ts` using `reduceTo` (+tests)
- [X] T1009 `buildEvent.ts` values<->event; every type round-trips through `normalizeEvent` (+tests)
- [X] T1010 `validateDraft.ts` issues incl. unknown refs, actor, t > duration, duplicates (+tests)
- [X] T1011 `exporter.ts`, `importer.ts`, `partySource.ts`; export validates against the schema; published ep1-3 import -> export is semantically identical (+tests)
- [X] T1012 `storage.ts`, `files.ts` (guards, quota error, feature detection) (+tests)

## Wave B - forms, preview, issues
- [ ] T1013 `src/studio/copy.ts` (form/preview/issues strings)
- [ ] T1014 `fields/*` one component per FieldKind, labelled, keyboard friendly
- [ ] T1015 `TypePicker` grouped grid with type-to-filter and remembered last type
- [ ] T1016 `EventForm` (add + edit, time field with nudge and "set to playhead", defaults, sticky actor, Cmd+Enter / Shift+Cmd+Enter, Escape, focus management)
- [ ] T1017 `PreviewPane` reusing PartyRail + EventFeed from the draft at t
- [ ] T1018 `IssuesPanel`
- [ ] T1019 Component tests: every type can be authored through the form; defaults; validation messages

## Wave C - shell and integration
- [ ] T1020 Routes `/studio`, `/studio/ep/:id` via `React.lazy` in `App.tsx`; viewer imports nothing from `src/studio`
- [ ] T1021 `useStudioDraft` (reducer + autosave + save state), `useTransport`, `useStudioHotkeys`
- [ ] T1022 `Transport` bar, `StudioTimeline`
- [ ] T1023 `EventList` with filters, selection, seek, scroll-into-view
- [ ] T1024 `StudioHeader` (save state, undo/redo, import, export menu: download, save to folder, copy show entry)
- [ ] T1025 `StudioHomePage` (drafts, new, open file, edit published)
- [ ] T1026 `NewEpisodeDialog` + `PartyEditor` (FR-1011), duration from transport
- [ ] T1027 `StudioEpisodePage` layout + narrow-screen notice
- [ ] T1028 End-to-end test on the fake source: keyboard-author events, undo, reload, export, load the export through the viewer's loader and compare `reduceTo`
- [ ] T1029 README "The Studio" section (workflow, hotkeys, how to publish a file)
- [ ] T1030 Gates: typecheck, lint, test, build (chunk split + main chunk delta), axe on the editor, Lighthouse a11y on `/ep/1` unchanged

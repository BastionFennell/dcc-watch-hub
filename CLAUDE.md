<!-- SPECKIT START -->
Active feature: `specs/010-studio/` (branch `010-studio`, stacked on `009-mana`); features 001-008 are merged on
`main` and documented under `specs/00[1-8]-*/` (008 = real crawlers, spell registry, tooltips).
Read, in order: `.specify/memory/constitution.md`, then `spec.md`, `plan.md`, `research.md`,
`data-model.md`, `contracts/`, `quickstart.md`, `tasks.md` under the newest `specs/NNN-*/` when a feature is active; otherwise read `specs/008-real-crawlers/spec.md` for the current data model.
Earlier contracts still apply where later features do not amend them.
The author's handoff spec is `dcc-watch-hub-spec.md`; the wireframe is `specs/001-watch-hub-v1/wireframe.html`.

Stack: Node 20.9.0 (asdf, `.tool-versions`), Vite 6, React 19, TypeScript strict, react-router 7,
CSS Modules, Vitest 3. Commands: `npm run dev | typecheck | lint | test | build | sheet-to-json`.

Hard rules (constitution): overlay state is a pure function of `events.filter(e => e.t <= t)`;
only `src/playback/YouTubeTimeSource.ts` (and `loadYouTubeApi.ts`) may reference YouTube; nothing beyond
the active feature scope (tooltips landed in 008; still parked: stingers, roster, spoiler toggle, v3);
no audio; panels never cover the stage on desktop except the modal full record; storage holds the
playhead only;
no UI frameworks or webfonts; System-voice copy lives in `src/copy.ts`.
Studio exception (constitution VII): `src/studio/**` is a lazy authoring chunk the viewer never
imports; it may store drafts under `dcc.studio.*`, uses `src/studio/copy.ts`, and controls playback
only through the `Transport` extension of `TimeSource`.
<!-- SPECKIT END -->

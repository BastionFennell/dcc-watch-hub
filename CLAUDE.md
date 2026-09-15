<!-- SPECKIT START -->
Active feature: `specs/003-crawler-record/` (branch `003-crawler-record`); v1 and v2 are merged on
`main` and documented in `specs/001-watch-hub-v1/` and `specs/002-watch-hub-v2/`.
Read, in order: `.specify/memory/constitution.md`, then `spec.md`, `plan.md`, `research.md`,
`data-model.md`, `contracts/`, `quickstart.md`, `tasks.md` under `specs/003-crawler-record/`.
Earlier contracts still apply where later features do not amend them.
The author's handoff spec is `dcc-watch-hub-spec.md`; the wireframe is `specs/001-watch-hub-v1/wireframe.html`.

Stack: Node 20.9.0 (asdf, `.tool-versions`), Vite 6, React 19, TypeScript strict, react-router 7,
CSS Modules, Vitest 3. Commands: `npm run dev | typecheck | lint | test | build | sheet-to-json`.

Hard rules (constitution): overlay state is a pure function of `events.filter(e => e.t <= t)`;
only `src/playback/YouTubeTimeSource.ts` (and `loadYouTubeApi.ts`) may reference YouTube; nothing beyond
the active feature scope (003: glance card + full-record dialog — no tooltips, stingers, roster, or v3);
no audio; panels never cover the stage on desktop except the modal full record; storage holds the
playhead only;
no UI frameworks or webfonts; System-voice copy lives in `src/copy.ts`.
<!-- SPECKIT END -->

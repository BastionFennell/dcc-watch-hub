<!-- SPECKIT START -->
Active feature: `specs/001-watch-hub-v1/` (branch `001-watch-hub-v1`).
Read, in order: `.specify/memory/constitution.md`, `specs/001-watch-hub-v1/plan.md`,
`specs/001-watch-hub-v1/research.md`, `specs/001-watch-hub-v1/data-model.md`,
`specs/001-watch-hub-v1/contracts/`, `specs/001-watch-hub-v1/quickstart.md`, `specs/001-watch-hub-v1/tasks.md`.
The author's handoff spec is `dcc-watch-hub-spec.md`; the wireframe is `specs/001-watch-hub-v1/wireframe.html`.

Stack: Node 20.9.0 (asdf, `.tool-versions`), Vite 6, React 19, TypeScript strict, react-router 7,
CSS Modules, Vitest 3. Commands: `npm run dev | typecheck | lint | test | build | sheet-to-json`.

Hard rules (constitution): overlay state is a pure function of `events.filter(e => e.t <= t)`;
only `src/playback/YouTubeTimeSource.ts` may reference YouTube; no v2/v3 features; no audio;
no UI frameworks or webfonts; System-voice copy lives in `src/copy.ts`.
<!-- SPECKIT END -->

# Tasks - 012 crawler dossier

## Wave A
- [X] T1201 Types (`DossierCard`, `DossierFile`, `AuthoredUpdate`), schemas (content + compiled), `Embedded.dossier`
- [X] T1202 `content/status/README.md` + sample `content/status/<id>.json` for all five (System voice, present tense, sample episodes 1-3; Ronald ep2 quiet authored; one crawler with an empty file)
- [X] T1203 `scripts/dossier.ts`: `lintUpdates`, `compileDossier` (auto quiet cards, derived levels, aired filter, sticky condition) (+tests)
- [X] T1204 `scripts/build-dossier.ts` (levels via reducer per episode end; writes `public/data/dossier/*.json`; exits 1 on lint errors), wired into `predev`, `build:dossier`, and `postbuild.mjs` before prerender; `.gitignore`
- [X] T1205 Prerender embeds `dossier` for the crawler route; `readEmbedded` + `fetchDossier` fallback; `validateDossier` lenient
- [X] T1206 `src/site/dossier/derive.ts` (+tests incl. the sticky-condition case 9 + 12)
- [X] T1207 `src/site/dossier/reveals.ts` (+tests: persistence shape, caughtUpThrough, throw -> memory)
- [X] T1208 Remove `CrawlerProfile.status`, `StatusPill`, `StatusLine`, roster chips; update `crawlers.json`, schema, tests
- [X] T1209 Vitest lint over `content/status/*.json` against the live `show.json`
- [X] T1210 Gates; `deploy.yml` weekly schedule

## Wave B
- [X] T1211 `src/site/copy.ts` dossier strings (eyebrow, headings by pronoun, banner, strip labels, LOCKED/REVEAL/UPDATE/QUIET, footer, launch line, quiet card text via `quiet.ts`)
- [X] T1212 `DossierStrip` (grey pills when unrevealed)
- [X] T1213 `DossierRow` locked + revealed states, a11y, focus handoff, motion
- [X] T1214 `Dossier` panel (header, banner, strip, rows, footer, bulk control, launch state)
- [X] T1215 Mount on `CrawlerPage`; hero pill gone; <= 560 px layout
- [X] T1216 Snapshot test: locked render identical across two crawlers after name/id substitution
- [X] T1217 Leak tests: no forbidden strings in locked markup/labels; head/OG/JSON-LD contain no card text; nothing revealed in the DOM before reveal
- [X] T1218 Keyboard test: reveal by Enter and Space; focus lands on the heading
- [X] T1219 Persistence test: reload + navigation between crawler pages; storage throw
- [X] T1220 Prerender check: two crawler pages differ only in name/id inside the panel
- [X] T1221 README: the dossier (authoring, lint, reveal store, leak rules)
- [X] T1222 Gates + screenshots (1440, 375; locked, partially revealed, all revealed) + axe

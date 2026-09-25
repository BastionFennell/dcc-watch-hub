# Plan - 012 crawler dossier

Constitution 1.5.0. No new dependencies.

## Layout
```
content/status/{harry,mimi,ronald,xo,veil}.json   authored cards (sample content for ep1-3 at first)
content/status/README.md                          authoring rules
scripts/dossier.ts                                pure: lintUpdates(), compileDossier(show, crawler, authored, levels, now)
scripts/build-dossier.ts                          tsx entry: reads files, runs reducer for levels, writes public/data/dossier/<id>.json
scripts/postbuild.mjs                             runs dossier before prerender; prerender embeds dossier per crawler
package.json                                      predev + build:dossier; .gitignore public/data/dossier/
src/data/types.ts                                 DossierCard, DossierFile, Embedded.dossier?
src/data/roster.ts                                validateDossier(raw), fetchDossier(id); CrawlerProfile.status removed
src/site/dossier/derive.ts                        deriveStrip(revealedCards), headingFor(pronouns)
src/site/dossier/reveals.ts                       store: load/save, isRevealed, reveal, revealAll, hideAll (try/catch, memory fallback)
src/site/dossier/quiet.ts                         quiet-card strings (shared by script + UI)
src/site/components/Dossier/{Dossier,DossierRow,DossierStrip}.tsx + css + tests
src/site/pages/CrawlerPage.tsx                    mounts <Dossier> under the achievement; hero pill removed
src/site/components/RosterCard.tsx                StatusPill removed; StatusLine deleted
src/site/pages/CrawlersPage.tsx                   status chips removed
specs/012-crawler-dossier/contracts/{dossier.schema.json, content.schema.json}
.github/workflows/deploy.yml                      + schedule (weekly)
```

## Waves
- **A (data, build, derivation, store)**: T1201-T1210.
- **B (component, page, leak tests, gates)**: T1211-T1222.

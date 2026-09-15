# Implementation Plan: Crawler Record (glance card + full record)

**Branch**: `003-crawler-record` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

## Summary

Split the v2 dossier into (a) a fixed-height **glance card** in the rail panel, built from a new
pure `crawlerGlance` selector over the existing `Dossier`, and (b) a modal **full record dialog**
that re-lays the existing dossier sections in the official sheet's landscape arrangement. The
dialog is the one overlay allowed to cover the stage (constitution 1.2.0), is focus-trapped via a
small `useModalDialog` hook, keeps updating with the playhead, and closes with the panel or the
episode. No new runtime dependencies; no data-model changes.

## Technical Context

Unchanged from v2 (Node 20.9, Vite 6, React 19, TS strict, CSS Modules, Vitest). Storage: none
new. Performance: the dialog renders the same lists the v2 dossier already rendered; the glance
card renders less. Scale: +1 selector, +2 components, +1 hook, ~+30 tests.

## Constitution Check (1.2.0)

| Principle | Gate | Status |
|-----------|------|--------|
| I | Glance and record derive from `crawlerDossier`/`crawlerGlance` per render; no stored lists | PASS |
| II | No playback changes; the dialog never touches the `TimeSource` | PASS |
| III | Glance card opens as before; the record is the single permitted stage-covering overlay, explicit, modal, focus-returning, playback untouched | PASS (amended 1.2.0) |
| IV | Inline CSS/JSX only; no dialog library | PASS |
| V | Only glance + record; tooltips parked (FR-214 reserves structure only) | PASS |
| VI | No schema/converter change | N/A |

## Project Structure (additions and edits)

```text
src/engine/selectors.ts                   # + crawlerGlance(dossier): Glance; types Glance, LedgerRow
src/engine/selectors.test.ts              # + glance cases
src/hooks/useModalDialog.ts               # focus trap, Escape (capture), backdrop, inert page, scroll lock, focus return
src/hooks/useModalDialog.test.tsx
src/components/CrawlerDossier/sections.tsx   # refactor: exported DossierHeader, DossierVitals, DossierStats, DossierList, DossierAchievements, DossierHistory (from CrawlerDossier.tsx)
src/components/CrawlerDossier/CrawlerDossier.tsx  # becomes the stacked composition of sections (used by the record on ≤900px)
src/components/CrawlerGlance/CrawlerGlance.tsx (+css, +test)   # the rail card; props { glance, onOpenRecord }
src/components/FullRecord/FullRecordDialog.tsx (+css, +test)   # props { dossier, meta, onClose, returnFocusTo }
src/pages/EpisodePage.tsx                 # rail 'dossier' renders CrawlerGlance; record state; dialog mount
src/pages/EpisodePage.test.tsx            # + glance/record tests
src/copy.ts                               # + glance/record strings (append)
README.md, specs/003-crawler-record/quickstart.md
```

**Structure Decision**: keep the v2 dossier's section components as the single source of the
sheet's rendering; the glance card is a new, smaller component; the dialog composes the
sections into columns. `usePanel` is untouched; the record is separate page state that is
cleared whenever `panel.kind !== 'dossier'` or the episode changes.

## Complexity Tracking

None.

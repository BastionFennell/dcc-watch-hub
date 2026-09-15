---
description: "Task list for the Crawler Record feature (glance card + full record)"
---

# Tasks: Crawler Record

**Input**: `/specs/003-crawler-record/` (spec, plan, research, data-model, contracts/dialog.md, quickstart).
**Tests**: REQUIRED (selector, hook, components, page).

## Execution waves

| Wave | Tasks | Agents / ownership |
|------|-------|--------------------|
| 1 | T301–T304 ∥ T305–T308 | "glance": `src/engine/selectors.ts` (+test, append only), `src/components/CrawlerGlance/**`, append-only `src/copy.ts`. "record": `src/hooks/useModalDialog.ts` (+test), `src/components/CrawlerDossier/sections.tsx` + `CrawlerDossier.tsx` refactor (+css), `src/components/FullRecord/**`, append-only `src/copy.ts`, `src/styles/global.css` (body.dialog-open only) |
| 2 | T309–T312 | one agent: `src/pages/EpisodePage.tsx` (+css, +test), README, quickstart |
| 3 | T313–T315 | one agent: polish + verification |

## Phase 1: Glance (US1)

- [X] T301 [P] [US1] `src/engine/selectors.ts`: add `LedgerRow`, `Glance`, `crawlerGlance(dossier: Dossier): Glance` per data-model.md (newest = last list element; skills newest text = `name` + ` · Rank N` when present; achievements newest = `{ text: title, t }`; `recentHistory = history.slice(0, 3)`). Tests in `src/engine/selectors.test.ts`: Harry at 200 (hotlist 1 "Crawbar"? — use the fixture: at 200 hotlist ['Crowbar'], skills 1, inventory contents, achievements 1 with t=60), at 110 (hotlist ['Door']), at 20 (all zero except initial skills/inventory), X.O. skills newest "Understudy Strike · Rank 2" at 160.
- [X] T302 [P] [US1] Append copy: `glanceKicker` "CRAWLER GLANCE", `openRecord` "Open full record", `ledgerCount(n)` → `${n}`, `ledgerNewest(text)` → text (identity, kept for voice edits), `historyPlaceholder` "—", `recordKicker` "CRAWLER RECORD", `recordTitle(name)` → `${name} — full record`, `debuffsMore(n)` → `+${n}`.
- [X] T303 [US1] `src/components/CrawlerGlance/CrawlerGlance.tsx` + `.module.css`: props `{ glance: Glance; onOpenRecord(trigger: HTMLButtonElement): void }`; layout per research R4 (header row with portrait 40/48 px, name, handle · player, class · Lv; `HpSegments` + numbers; rank block with `RankSparkline` (import from CrawlerDossier) and current/best or "Unranked"; debuff chips max 2 rows then `debuffsMore`; ledger: four rows `<dl>` with `dt` label, `dd` count + newest (ellipsis), achievements newest with `formatTime`; history: exactly three rows using `FeedItemView` compact or plain text lines, placeholders when fewer; primary button `data-testid="open-record"` `aria-haspopup="dialog"` `aria-controls="crawler-record"`). Fixed-height rules: single-line rows, no lists. testids `crawler-glance`, `ledger-<kind>`, `glance-history`.
- [X] T304 [US1] `src/components/CrawlerGlance/CrawlerGlance.test.tsx`: ledger counts/newest from a fixture-derived glance; empty rows show `dossierEmpty.*`; three history rows always; button calls `onOpenRecord` with the element; no `<ul>` of full lists inside.

## Phase 2: Record (US2)

- [X] T305 [P] [US2] `src/hooks/useModalDialog.ts` per contracts/dialog.md (portal helper not needed in the hook; the component portals). API: `useModalDialog({ open, onClose, returnFocusTo }: { open: boolean; onClose(): void; returnFocusTo: HTMLElement | null }) → { dialogRef: RefObject<HTMLDivElement>; onBackdropClick(e): void }`. Effects: inert siblings of the dialog's portal node (every child of `#root`, guarded), `body.dialog-open`, focus close control (`[data-testid="record-close"]` or first focusable), Tab wrap, Escape capture on document with `stopPropagation`, focus return. Test `src/hooks/useModalDialog.test.tsx` per research R6.
- [X] T306 [P] [US2] Refactor `src/components/CrawlerDossier/CrawlerDossier.tsx` into `src/components/CrawlerDossier/sections.tsx` exporting `DossierHeader({ dossier, meta })`, `DossierVitals({ dossier })`, `DossierStats({ stats })`, `DossierList({ kind: 'hotlist'|'skills'|'inventory'; items; ... })`, `DossierAchievements`, `DossierHistory`; every list item `<li data-item={kind} data-name={…}><span class=itemLabel>…</span>…</li>` (FR-214). `CrawlerDossier` keeps its export and renders the stacked composition (all existing dossier tests must pass unchanged — keep testids).
- [X] T307 [US2] `src/components/FullRecord/FullRecordDialog.tsx` + `.module.css`: props `{ dossier: Dossier; meta: EpisodeMeta; open: boolean; onClose(): void; returnFocusTo: HTMLElement | null }`; `createPortal` to `document.body`; backdrop (`data-testid="record-backdrop"`, dims `rgb(19 19 32 / 78%)`), dialog `role="dialog" aria-modal="true" aria-labelledby id="crawler-record" data-testid="crawler-record"`, header row (kicker `recordKicker`, title `recordTitle(name)`, close button `data-testid="record-close"` with `IconClose`), body grid per research R5 (top band: header + vitals + stats; columns a/b/c), `≤ 900px` full-screen stacked; internal scroll; 150 ms fade honoring reduced motion. Width `min(1200px, 94vw)`, `max-height: 90vh`. `body.dialog-open { overflow: hidden }` in `global.css`.
- [X] T308 [US2] `src/components/FullRecord/FullRecordDialog.test.tsx`: renders sections and all list items (not truncated); close button, Escape, backdrop close; inner click doesn't; focus on close at open; Tab wraps; `aria-labelledby` resolves to the title.

## Phase 3: Page wiring (wave 2)

- [X] T309 `src/pages/EpisodePage.tsx`: `const [record, setRecord] = useState<string | null>(null)`; rail `case 'dossier'` renders `RailPanel` (kicker `glanceKicker`) + `CrawlerGlance` with `glance = crawlerGlance(dossier)` and `onOpenRecord = (el) => { recordTrigger.current = el; setRecord(dossier.id); }`; mount `<FullRecordDialog open={record !== null} dossier=… meta=… onClose={() => setRecord(null)} returnFocusTo={recordTrigger.current} />` when `record` matches an existing crawler; clear `record` on episode change and whenever `panel.kind !== 'dossier'` or `panel.crawlerId !== record`. Dev flag: `?panel=dossier:<id>&record=1` opens the record on load (DEV only).
- [X] T310 `src/pages/EpisodePage.test.tsx`: frame → `crawler-glance` (and no `dossier-history` list beyond three rows); open record → `crawler-record` with `dossier-inventory` etc.; Escape closes only the dialog, glance stays, focus on `open-record`; backdrop closes; live update (seek while open changes the Inventory items in the dialog); switching crawler (click X.O.) closes the record; Escape again closes the glance (menu-first rule intact); episode change closes both; `body.dialog-open` toggles.
- [X] T311 `README.md` (Lean-forward section: glance card vs full record, keys) and `specs/003-crawler-record/quickstart.md` (verify times against `public/data/ep1.json`).
- [X] T312 Remove any now-unused v2 dossier-only styles/copy that the refactor orphaned (keep `CrawlerDossier` export and tests).

## Phase 4: Polish (wave 3)

- [ ] T313 [P] Visual/accessibility pass with headless Chrome at 1440×900 and 500 px: glance card height equal for Harry vs The Actress at t=560 (record the px), no scroll; record layout columns; contrast of new elements; Lighthouse a11y 100 on `/ep/1`.
- [ ] T314 [P] Responsive: 360/400 px with the record open — no horizontal scroll, close reachable, stacked order; glance card at 360 px.
- [ ] T315 Final: `typecheck && lint && test && build`; quickstart walk; SC-201..SC-205 under quickstart `## Results`; all tasks `[X]`.

## Notes
- No git write commands by agents; orchestrator commits per wave. No new dependencies. Copy only from `src/copy.ts` (append at end).
- The dialog must never call the `TimeSource`; playback is untouched.

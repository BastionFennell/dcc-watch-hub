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

- [X] T313 [P] Visual/accessibility pass with headless Chrome at 1440×900 and 500 px: glance card height equal for Harry vs The Actress at t=560 (record the px), no scroll; record layout columns; contrast of new elements; Lighthouse a11y 100 on `/ep/1`.
- [X] T314 [P] Responsive: 360/400 px with the record open — no horizontal scroll, close reachable, stacked order; glance card at 360 px.
- [X] T315 Final: `typecheck && lint && test && build`; quickstart walk; SC-201..SC-205 under quickstart `## Results`; all tasks `[X]`.

## Notes
- No git write commands by agents; orchestrator commits per wave. No new dependencies. Copy only from `src/copy.ts` (append at end).
- The dialog must never call the `TimeSource`; playback is untouched.

---

# Revision 2 tasks (author feedback: equipped items, latest achievement, art, hotbar, tiles, list views)

## Waves

| Wave | Tasks | Ownership |
|------|-------|-----------|
| R2-1 | T316–T321 | one agent: types/validate/state/reducer/selectors (+tests), converter + schema + samples + fixtures + placeholder art, copy |
| R2-2 | T322–T323 ∥ T324–T327 | "glance": `src/components/CrawlerGlance/**`. "record": `src/components/FullRecord/**`, `src/components/CrawlerDossier/sections.tsx` (+css) |
| R2-3 | T328–T331 | one agent: page tests, docs, polish, verification |

## Phase R2-1: Foundation

- [X] T316 `src/data/types.ts`: `GearSlot`, `Gear`, `Crawler.gear?`, `Crawler.art?`, `EquipEvent`, `UnequipEvent`; extend `Event`, `EventType`, `KNOWN_EVENT_TYPES`. `src/data/validate.ts`: normalize both events (unknown slot → `unknown`), `normalizeCrawler` drops malformed `gear`/`art`. Tests appended.
- [X] T317 `src/engine/state.ts` + `reducer.ts`: `CrawlerState.gear` normalized `{ head|torso|arms|hands|legs|feet: string | null; accessories: string[] }` seeded from `Crawler.gear`; `equip`/`unequip` per data-model.md (accessory cap 10, dedupe, remove by name or last). Tests appended.
- [X] T318 `src/engine/selectors.ts`: `Dossier` gains `gear`, `art?`; `toFeedItem` handles equip/unequip (`copy.feedText.equip(actor, slot, item)`, `unequip(actor, slot, item?)`); **revise** `Glance` per data-model Revision 2 (remove `ledger`; add `equipped` in sheet order with accessories expanded, `latestAchievement`); add `hotbarSlots(hotlist, n = 10): { slots: (string | null)[]; overflow: number }`; `GEAR_SLOT_ORDER` const. Update existing `crawlerGlance` tests; add hotbar tests.
- [X] T319 `src/copy.ts` (append): `labels.equip` "Equip", `labels.unequip` "Unequip", `feedText.equip/unequip`, `gearSlotLabels { head: 'Head', torso: 'Torso', arms: 'Arms', hands: 'Hands', legs: 'Legs', feet: 'Feet', accessory: 'Accessory' }`, `dossierSections.equipped` "EQUIPPED", `dossierSections.gear` "GEAR", `dossierSections.latestAchievement` "LATEST ACHIEVEMENT", `dossierSections.recent` "RECENT MOMENTS", `dossierEmpty.equipped` "Nothing equipped.", `dossierEmpty.gearSlot` "—", `hotbarSlot(n)` → `${n}`, `hotbarOverflow(n)` → `+${n}`, `viewAll(n)` → `View all (${n})`, `backToRecord` "Back to record", `recordListTitle(name, category)` → `${name} — ${category}`, `artAlt(name)` → `${name}, full figure`.
- [X] T320 Contracts + converter + samples: add `equip`/`unequip` branches and `gear`/`art` crawler fields to `specs/003-crawler-record/contracts/episode.schema.json` (copy v2 schema and extend; point `samples.test.ts` and `sheet-to-json.test.ts` at it); converter rows per data-model (unknown slot ERROR; accessory unequip without item WARN); `scripts/samples/*` rows; `public/data/ep{1,2,3}.json`: starting `gear` for all crawlers, ≥ 2 `equip` and ≥ 1 `unequip` per file, `art` for at least two crawlers per file, X.O. with ≥ 9 skills in ep1, Harry with 11 hotlist entries late in ep1; keep counts ≤ 60 (raise the samples ceiling to 80 if needed, and note it).
- [X] T321 Fixtures + art: `src/test/fixtures.ts` per data-model Revision 2 (Harry gear/equip/unequip times, X.O. nine skills by 200, Harry 11 hotlist entries at 210, `art` for actress + harry); placeholder art SVGs `public/img/crawlers/{stuntman,psychic,harry,xo,actress}-art.svg` (tall 200×500 monochrome full-figure silhouettes, distinct per crawler, brand-tinted background) and README placeholder list update.

**Checkpoint**: typecheck/lint/test/build green; all prior tests pass (glance tests updated).

## Phase R2-2a: Glance card (US1)

- [ ] T322 [P] `src/components/CrawlerGlance/CrawlerGlance.tsx` + css: per R2 US1 — remove the ledger and placeholders; add EQUIPPED (≤ 7 rows `slot · item`, sheet order; "Nothing equipped."), LATEST ACHIEVEMENT (title bold, desc, time; empty phrase), RECENT MOMENTS (up to three, no placeholders, `min-height` for three rows so the card height holds), sparkline on its own row. testids: `glance-equipped`, `glance-latest-achievement`, `glance-history` (rows `glance-history-row`).
- [ ] T323 [P] `CrawlerGlance.test.tsx`: update for the new shape (equipped rows and order, latest achievement, no dashes, three-row min-height class present, button).

## Phase R2-2b: Record (US2)

- [ ] T324 [P] `src/components/CrawlerDossier/sections.tsx` + css: add `DossierHotbar({ hotlist })` (ten numbered square slots, `+N`), `DossierGear({ gear })` (seven slot rows, accessories joined, "—" when empty), `DossierTiles({ kind, items, max = 8, onViewAll? })` for skills/inventory/achievements (square tiles: name, mono footer rank/time; "View all (N)" button when over max), `DossierHistory` gains `max?` and `onViewAll?`. Keep existing exports working (the stacked `CrawlerDossier` keeps using full lists).
- [ ] T325 [P] `src/components/FullRecord/FullRecordDialog.tsx` + css: art column (`art` or bust fallback; `alt` from `artAlt`), top band (identity, vitals, stats) beside it; sheet body: Hotbar, Gear, then Skills / Inventory / Achievements tile grids and History (8 rows) with "View all"; `view` state per contracts/dialog.md Revision 2 (list views reuse `DossierList`/`DossierAchievements`/`DossierHistory` full lists with a "Back to record" button, heading focus, focus return, Escape → back before close); title switches to `recordListTitle`; ≤ 900 px art banner + stacking; hotbar wraps 5×2.
- [ ] T326 [P] `FullRecordDialog.test.tsx`: art img/alt and bust fallback; hotbar 10 slots + order + `+N`; gear rows; tiles capped at 8 with "View all (9)" for X.O. skills; list view open/back/Escape order/focus; live update in a list view; title changes.
- [ ] T327 [P] `useModalDialog.ts`: allow the component to intercept Escape first (e.g. accept an `onEscape?: () => boolean` returning true when consumed) so list views can step back before the dialog closes; test.

## Phase R2-3: Wiring, docs, polish

- [ ] T328 `src/pages/EpisodePage.test.tsx`: update glance assertions (equipped, latest achievement, no ledger), record assertions (hotbar, gear, tiles, view all → list view → back), sweep for equipped/latest achievement at fixture boundaries.
- [ ] T329 README + quickstart: glance/record descriptions, new events and CSV rows, `gear`/`art` fields, placeholder art list, `?t=` values re-verified against `public/data/ep1.json`.
- [ ] T330 [P] Visual/a11y/responsive pass (headless Chrome 1440×900 + 500 px): card heights equal Harry vs Actress (px), no dashes; record with art at 1440; list view; 360 px no horizontal scroll in sheet and list views; Lighthouse a11y 100 (preview ambient + dev record); contrast of hotbar numbers/tiles ≥ 4.5:1.
- [ ] T331 Final: gates green; R2-SC-201..204 recorded under quickstart `## Results (revision 2)`; all tasks `[X]`.

## Carry-overs from the revision 1 polish (fold into R2-2b / R2-3)

- [ ] T332 [P] `FullRecordDialog`: anchor the dialog to a fixed top offset (e.g. `margin-top: 5vh`, `align-items: flex-start`) so a shrinking seek never re-centres it vertically (US2 scenario 2).
- [ ] T333 [P] `RankSparkline`: accept `preserveAspectRatio="none"` (or a `stretch` prop) so the glance row draws full width; keep the dialog's vitals usage as is.

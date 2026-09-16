---
description: "Task list for NPC encounters + System Registry"
---
# Tasks: NPC encounters + System Registry

## Waves
| Wave | Tasks | Ownership |
|------|-------|-----------|
| 1 | T701–T707 | one agent: data/engine/loader/converter/schemas/samples/fixtures/copy |
| 2 | T708–T711 ∥ T712–T714 | "episode": `src/components/EncounterRail/**`, `src/components/NpcRecord/**`, `src/hooks/usePanel.ts`, `src/components/MobileTabs/**` (TabId only), `src/pages/EpisodePage*`. "registry": `src/engine/registry.ts` (+test), `src/pages/RegistryPage*`, `src/components/RegistryEntry/**`, `src/App.tsx` (route), `src/components/SiteHeader/**` (link). Both append to `src/copy.ts` at the END. |
| 3 | T715–T717 | one agent: docs, visual/a11y, verification |

## Phase 1: Foundation
- [X] T701 `src/data/types.ts`: `EntityKind`/`ENTITY_KINDS` (`boss`, `vendor`, `ally`), `Entity`, `Registry`, `Show.registryUrl?`, `NpcAction`/`NPC_ACTIONS`, `NpcEvent`; extend `Event`, `EventType`, `KNOWN_EVENT_TYPES`.
- [X] T702 `src/data/validate.ts`: `normalizeEvent` for `npc` (id + action required; `unlock` string list; `note` optional; `actor` optional), `normalizeRegistry`/`isRegistry` (drop malformed entities/facts with warn; `kind` must be known), `normalizeShow` keeps `registryUrl`. Tests.
- [X] T703 `src/data/load.ts`: `fetchRegistry(show)` (null when absent; resolves against BASE_URL; `DataError` on failure). `src/data/RegistryContext.tsx`: `RegistryProvider` (fetches when the show is available), `useRegistry()`. Wire the provider in `src/App.tsx` inside `ShowProvider` (App.tsx edit allowed in wave 1 only for the provider). Tests for `fetchRegistry`.
- [X] T704 `src/engine/state.ts` + `reducer.ts`: `OverlayState.npcs`, `NpcState`; `npc` transitions per research R2. Tests.
- [X] T705 `src/engine/selectors.ts`: `FeedItem.npcId?`; `toFeedItem` for `npc` (names resolved from an optional `registry` param — add `registry?: Registry | null` as a trailing optional param to `feedItems`, `logItems`, `crawlerHistory`? Only `feedItems`/`logItems`/`npcMoments` need names; keep signatures backward compatible by appending the param); `encounteredNpcs`, `npcMoments`, `npcRecord`. Tests incl. never-early sweep for encounters and facts, missing-registry id omitted from encounters but present in feed with the raw id.
- [X] T706 Contracts + converter + samples: `specs/007-npc-registry/contracts/{episode,show,npcs}.schema.json` (copy prior schemas, add `npc` branch, `registryUrl`, and the registry schema); repoint `samples.test.ts`/`sheet-to-json.test.ts`; converter `npc` row (field2 `action[:fact,fact]`), `--registry <path>` optional validation (WARN unknown id/fact); `scripts/samples/*` rows (clean + a warning case with `--registry`); `public/data/npcs.json` (8 invented entities across the 3 sample episodes: ≥ 3 bosses, 2 vendors/guides, 3 allies/factions, diegetic intros, 2–4 facts each, a few aliases, 2 with placeholder portraits under `public/img/npcs/`); `public/data/ep{1,2,3}.json` `npc` events (each episode ≥ 4: met/seen/update with unlock/defeated; one entity spans two episodes; one `update` in ep2 unlocks a fact for an ep1 entity); `show.json` `registryUrl`; samples test extended (registry validates; every `npc` id in samples exists in the registry except one deliberate unknown in ep1; every `unlock` fact exists).
- [X] T707 `src/test/fixtures.ts` (data-model fixture facts + `makeRegistry()`), copy keys per `contracts/npc.md` (append at END; `labels.npc` and `feedText.npc*` inside the nested objects).

**Checkpoint**: gates green; existing tests untouched.

## Phase 2a: Episode page (US1)
- [X] T708 `src/components/EncounterRail/**` per research R3 + contract (row and grid layouts, kind tints, defeated marker, trigger semantics, empty line).
- [X] T709 `src/components/NpcRecord/**` per research R4 + contract (glance-style; moments reuse `FeedItemView` with seek + share; registry link uses `useEpisodePath`-like base handling → plain `Link to={\`/registry#\${id}\`}`).
- [X] T710 `usePanel` kind `npc`; `MobileTabs` `TabId` gains `'npcs'`; `EpisodePage.tsx`: strip under the party rail (desktop) / NPCs tab (phone, only when a registry exists), panel kind `npc` → `RailPanel` (kicker `npcKicker`, title entity name) + `NpcRecord`; feed/log get the registry for names; `data-panel-trigger="npc:<id>"` focus return works.
- [X] T711 Page tests: strip after the party rail; standby before the first npc event; chip order and defeated marker at fixture times; chip → panel with facts at t and after a backward seek; unknown id absent from the strip, present in the feed; phone NPCs tab; registry absent → no strip/tab.

## Phase 2b: Registry page (US2)
- [X] T712 `src/engine/registry.ts`: `registryIndex` per research R5 + tests (ordering by first appearance across episodes, fact tags = first unlocking episode, appearances sorted, omitted entities, missing episode reported).
- [X] T713 `src/pages/RegistryPage.tsx` (+css) and `src/components/RegistryEntry/**`: loads show (context), registry (context), all episodes (`Promise.allSettled(fetchEpisode)`); sections per episode with counts; search input (`aria-label`), kind chips (`aria-pressed`, counts), expandable entries (button + region, `id=<entity id>`), facts with `Ep N` tags, appearances as `Link`s to `/ep/N?t=`, `registry-missing` notice, empty state, hash handling (`location.hash` → expand + `scrollIntoView` after load). Route `/registry` in `App.tsx`; header link (desktop right cluster + phone menu) only when `show.registryUrl`; document title.
- [X] T714 Tests: `RegistryPage.test.tsx` (stubbed fetch for show/registry/episodes: sections, search incl. alias, chips, expand, hash, missing episode notice, empty); `App.test.tsx` link presence/absence.

## Phase 3: Polish
- [X] T715 README ("Entities and the Registry" section: data file, event/CSV row, strip, record, registry) + quickstart URLs verified against the samples; test count and bundle.
- [X] T716 Headless Chrome: strip at 1440 (chips, tints, defeated), record panel, NPCs tab at 400 px, registry page at 1440 and 400 (sections, chips wrapping, expanded entry, hash landing); contrast of kind tints ≥ 3:1 / text ≥ 4.5:1; Lighthouse a11y 100 on `/registry` and `/ep/1`; axe on the record and registry.
- [X] T717 Final: gates green; SC-601..604 under quickstart `## Results`; all tasks `[X]`.

## Revision 2 — episode-scoped Registry (single wave)
- [X] T718 `src/engine/registry.ts`: `RegistryScope`, `parseRegistryScope`, `scopeParam`, `scopeRegistry` per contract; tests (through/only on the fixture + on `public/data` via the samples).
- [X] T719 RegistryPage: scope `<select>` bound to `?scope=`; index → `scopeRegistry` → search/chips; option labels with episode titles; tests (scope from URL, select changes URL, subsets/counts, empty).
- [X] T720 Episode page: `NpcRecord` `episodeId` prop and scoped link; `EncounterRail` `registryHref` link (desktop strip header and phone NPCs tab); page tests for both hrefs.
- [X] T721 README (scope paragraph), quickstart (scoped URLs), Results addendum; gates green; all ticked.

## Revision 3 — Registry panel beside the broadcast (single wave + verification)
- [X] T722 `src/data/RegistryIndexContext.tsx` (+test): lazy, idempotent `load()`; caches `{ index, loading, error }` for the visit; uses `useShow`/`useRegistry`/`fetchEpisode`; mount in `App.tsx` inside `RegistryProvider`; `RegistryPage` switches to it (no behaviour change).
- [X] T723 `usePanel` kind `registry` (`focusId?`); `RegistryBrowser` component (+css, +test) per contract R3: scope select (panel state, default through-current), search, chips, entries (reuse `RegistryEntry` with a new optional `renderAppearance` or `onSeek`+`currentEpisodeId` props so current-episode appearances become seek buttons with share), loading/missing/empty lines, footer `registry-browser-full` link (`/registry?scope=…` + `#focusId` when set); `focusId` → expanded + scrolled into view on open.
- [X] T724 Episode page wiring: strip `onBrowse` trigger (`encounter-browse`, replaces the strip link; the link moves to the panel footer), record `onOpenRegistry` → `panelApi.open({ kind: 'registry', focusId })`, rail `case 'registry'` → `RailPanel` (kicker `registryPanelKicker`, title `registryTitle`, sheet on phones) + `RegistryBrowser`; `load()` on open; tests: open from strip (video source untouched — assert `getTime()` unchanged and no `seek` call), default scope through-current, entry expand, current-episode appearance seeks the fake source, other-episode appearance is a link, record → panel with `focusId` expanded, Escape/close/focus return, phone sheet.
- [X] T725 Docs (README + quickstart) and verification: headless screenshots at 1440 (rail panel) and 400 (sheet), Lighthouse a11y 100 on `/ep/1` with the panel open (dev) and `/registry` (preview), axe on the panel; Results (revision 3); all tasks `[X]`.

## Revision 4 — newest first; panel follows the playhead
- [X] T726 `src/engine/registry.ts`: `registrySections` newest-episode-first with latest-first entries; `clipEpisodeToPlayhead(episode, t)`; `registryIndexAt(show, registry, episodes, currentEpisodeId, t)`; tests (ordering on fixtures and `public/data`; clipping at boundaries; facts/defeated/appearances respect `t`).
- [X] T727 `RegistryIndexContext` exposes `episodes`; `RegistryBrowser` takes `t` and `currentEpisode`, uses `registryIndexAt`; `EpisodePage` passes `t` and `episode`; the standalone page uses the unclipped index. Tests: browser/page sweep at the fixture boundaries (112, 118, 122, 135, 185, 195) forward and back; ordering assertions updated everywhere (RegistryPage sections order, browser order).
- [X] T728 README/quickstart notes (ordering; panel follows the playhead); Results (revision 4); gates green; all ticked.

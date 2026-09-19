# Feature Specification: NPC encounters + System Registry

**Feature Branch**: `007-npc-registry`  
**Created**: 2026-09-16  
**Status**: Draft  
**Input**: Author: "I want a good way to show NPC information, both as they're encountered and
long term as a sort of glossary." Clarified: on the episode page, what is revealed is tied to the
current episode's playhead; the glossary is NOT tied to what the device has opened — it lists
everything published, ordered by episode. Entity kinds: **Boss**, **Vendor / Guide**, **Ally / Faction**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meet an entity during the broadcast (Priority: P1)

While watching, an NPC event elapses ("The Hoarder enters the broadcast"). The feed shows it, and
an **Encountered** strip under the party rail (a fifth **NPCs** tab on phones) gains that entity:
portrait or initial, name, kind badge. Tapping it opens an **entity record** in the rail (a bottom
sheet on phones): portrait, name, kind, floor, the spoiler-free intro, the facts unlocked so far
in this episode, whether it has been defeated, and its moments (every event about it, newest
first, each seek-able and shareable). Scrubbing backward removes entities not yet met and facts
not yet unlocked.

**Acceptance Scenarios**:

1. **Given** the playhead before the first `npc` event, **Then** the Encountered strip shows the
   standby line "No entities tagged yet." and the NPCs tab is empty-stated.
2. **Given** an `npc` `met` event elapses, **Then** the feed shows "Entity · {name} enters the
   broadcast{ — note}" and the strip shows the entity first (newest first).
3. **Given** the entity record is open at t, **When** an `update` event with `unlock` elapses,
   **Then** the newly unlocked fact appears within 500 ms; seeking before it removes the fact.
4. **Given** a `defeated` event elapses, **Then** the strip badge and the record show "Defeated"
   and the feed says "{name} is no more{ — note}".
5. **Given** an `npc` event for an id missing from the registry, **Then** the feed still shows
   the row (using the id as the name) and nothing crashes; no strip entry is created for it.
6. **Given** the record is open, **When** the viewer activates "Open in the Registry", **Then**
   the registry page opens scrolled to that entity.
7. **Given** the record, **When** the viewer taps a moment, **Then** playback seeks there; the
   share action copies that moment's link.

---

### User Story 2 - Browse the System Registry (Priority: P2)

From the header, the viewer opens **System Registry**: every entity from every published
episode, grouped by the episode in which it first appears (in broadcast order), with a search
box (name and aliases) and kind chips. Each entry card shows portrait, name, kind, floor, intro,
and expands to its facts (each tagged with the episode that reveals it) and its appearances
(episode + time, deep-linked to the moment). Entities that never appear in any published
episode are not listed.

**Acceptance Scenarios**:

1. **Given** three published episodes, **Then** the registry shows sections "Episode 1 — …",
   "Episode 2 — …", … containing entities by first appearance, and a count per section.
2. **Given** a search term matching an alias, **Then** only matching entries remain (across
   sections); an empty result shows "The Registry has no such entity."
3. **Given** a kind chip selected, **Then** only that kind remains; chips show counts; multiple
   chips combine as any-of.
4. **Given** an entry expanded, **Then** facts are listed with "Ep N" tags (facts never unlocked
   in a published episode are omitted) and appearances list episode + time with links
   `/ep/N?t=…`.
5. **Given** `/registry#hoarder`, **Then** the page opens with that entry expanded and scrolled
   into view.
6. **Given** episode data for one episode fails to load, **Then** the registry still renders the
   others and notes "One recap episode could not be indexed."

---

### Edge Cases

- Registry file absent (`show.json` has no `registryUrl`): no strip, no tab, no header link; the
  episode page works as before; `npc` events still show in the feed with their id.
- Duplicate `met` events for the same entity: the strip keeps one entry; the record's moments
  list shows both.
- Facts referenced by `unlock` that do not exist on the entity: ignored (converter warns).
- Very many entities on one floor: the strip scrolls horizontally on desktop (no wrap); the
  registry sections paginate naturally by scrolling.
- The registry page on a phone: single column, chips wrap, search full width.
- Reduced motion: no expand animation.

## Requirements *(mandatory)*

**Data**
- **FR-600**: A show-level registry file (`registryUrl` in `show.json`, optional) MUST define
  entities: `id`, `name`, `kind ∈ boss | vendor | ally`, optional `portrait`, `floor`, `aliases`,
  `intro` (spoiler-free), and `facts[] { id, text }`.
- **FR-601**: A new episode event `npc` MUST be supported end to end: `{ t, id, action ∈ met |
  seen | update | defeated, note?, unlock?: string[], actor? }`; converter row `npc` with field1 id,
  field2 `action` optionally followed by `:fact-id,fact-id`, field3 note; unknown ids and unknown
  fact ids are warnings.
- **FR-602**: Overlay state MUST track per entity: first-met time, encounter count, unlocked
  facts, defeated — all pure functions of the playhead.

**Episode page**
- **FR-610**: An Encountered strip (desktop, under the party rail; phone: NPCs tab) MUST list
  entities met so far, newest first, with kind badge and a defeated marker; standby line when empty.
- **FR-611**: An entity record panel (rail / sheet) MUST show portrait, name, kind, floor, intro,
  unlocked facts, defeated state, moments (seek + share), and an "Open in the Registry" link.
- **FR-612**: `npc` events MUST render in the feed and the log with the "Entity" label and the
  action-specific System-voice text.

**Registry**
- **FR-620**: Route `/registry` with a header link, grouped by first-appearance episode in
  broadcast order, search (name + aliases), kind chips with counts, expandable entries with
  facts tagged by revealing episode and deep-linked appearances; `#<id>` opens an entry.
- **FR-621**: The registry MUST derive everything from the published data files (show, registry,
  every episode); nothing device-specific gates what is shown.
- **FR-622**: Static delivery, System voice, Lighthouse accessibility 100, no horizontal scroll at 360 px.

### Key Entities
- **Entity (registry)**, **NPC event**, **Entity state (derived per episode)**, **Encounter
  (derived: entity + state + moments)**, **Registry entry (derived across episodes: first
  episode, facts with revealing episode, appearances)**.

## Success Criteria *(mandatory)*
- **SC-601**: Strip, record, and feed rows match the event log ≤ t at every `npc` boundary in a
  scripted sweep, forward and back (facts included).
- **SC-602**: The registry lists every entity that appears in any sample episode, in the right
  section, with correct fact tags and appearance links; search and chips behave.
- **SC-603**: `/registry#<id>` opens and scrolls to the entry; "Open in the Registry" from an
  episode lands there.
- **SC-604**: All prior tests pass; Lighthouse a11y 100 on `/registry` and the episode page.

## Assumptions
- Kinds are exactly boss / vendor (label "Vendor / Guide") / ally (label "Ally / Faction").
- No "mob" kind: ordinary mobs are not registry entities (the author's choice).
- Portraits are optional; an initial on a kind-colored disc stands in.
- The registry page loads every episode file; at tens of episodes this is a few small JSON fetches.

---

# Revision 2 (2026-09-16) — episode-scoped Registry views

Author: "I want something like the registry to look at NPCs for a given episode or seen up to this
episode vs tying it only to the event."

## R2 User Story - Scope the Registry by episode (P1)

**Acceptance Scenarios**
1. **Given** `/registry`, **Then** a scope control offers **All episodes**, **Through Episode N**
   (one entry per published episode), and **Only Episode N** (one per episode); default All.
2. **Given** "Through Episode 2", **Then** only entities whose first appearance is in episode ≤ 2
   are listed; facts revealed in episodes > 2 and appearances in episodes > 2 are omitted; a
   "Defeated in episode N" line shows only when N ≤ 2; chip counts and section counts follow.
3. **Given** "Only Episode 2", **Then** only entities that appear in episode 2 (any action) are
   listed, grouped under that one section, with appearances limited to episode 2 and facts
   revealed through episode 2 (so context from earlier episodes is kept, nothing later leaks).
4. **Given** a scope, **Then** the URL carries it (`?scope=through-2` / `?scope=ep-2`; absent =
   all) so the view is shareable; search, chips, and `#<id>` combine with it.
5. **Given** an entity record on episode N's page, **When** the viewer activates "Open in the
   Registry", **Then** the Registry opens at `?scope=through-N#<id>`.
6. **Given** the Encountered strip on episode N's page, **Then** it offers "Registry for this
   episode" → `/registry?scope=ep-N`.
7. **Given** a scope that removes every entry, **Then** the empty state reads "The Registry has
   no such entity." with the scope still selected.

## R2 Requirements
- **R2-FR-630**: A pure `scopeRegistry(entries, scope, episodeOrder)` trims entries, facts,
  appearances, and defeated lines per scenarios 2–3.
- **R2-FR-631**: Scope is URL state (`scope` search param), parsed leniently (unknown → all).
- **R2-FR-632**: The record's Registry link and a new strip link carry the episode scope.
- **R2-FR-633**: The control is a labelled `<select>` (System voice), keyboard-first, with the
  episode title in each option.

## R2 Success Criteria
- **R2-SC-605**: Scoped views match hand-computed subsets for the sample data at every scope.
- **R2-SC-606**: Links from the episode page land scoped and expanded; a11y stays 100.

---

# Revision 3 (2026-09-16) — browse the Registry without stopping the video

Author: "Ideally they can look at this registry without stopping the video."

## R3 User Story - The Registry as a panel beside the broadcast (P1)

**Acceptance Scenarios**
1. **Given** the episode page, **When** the viewer activates "Browse the Registry" on the
   Encountered strip (or in the NPCs tab), **Then** the rail (a bottom sheet on phones) shows the
   Registry scoped to **Through this episode** by default, with the scope select, search, kind
   chips, and expandable entries — and the video keeps playing.
2. **Given** the panel, **When** the viewer expands an entry and activates an appearance from the
   **current** episode, **Then** playback seeks to that moment (no navigation); appearances from
   other episodes are links that open that episode at the moment.
3. **Given** an entity record open in the rail, **When** the viewer activates "Open in the
   Registry", **Then** the Registry panel replaces it with that entity expanded and scrolled into
   view (still on the episode page); the panel footer offers "Open the full Registry" (scoped link).
4. **Given** the panel, **Then** Escape, the close control, or the trigger close it and focus
   returns; opening the panel never pauses or seeks playback by itself.
5. **Given** the panel is open, **When** the playhead moves, **Then** the panel's content does
   not change (it is publication-scoped, not playhead-scoped) — the strip beneath still does.
6. **Given** the registry index needs other episodes' files, **Then** they are fetched once,
   lazily, when the panel first opens, with a System-voice loading line; a failed file yields the
   existing "could not be indexed" notice inside the panel.

## R3 Requirements
- **R3-FR-640**: New panel kind `registry` (`{ kind: 'registry'; focusId?: string }`) in the
  rail/sheet system; one panel at a time as before.
- **R3-FR-641**: A `RegistryBrowser` component reusing the scope/search/chips/entries of the
  page in a narrow layout; default scope `through-<current episode>`; scope changes are panel
  state (not URL) here.
- **R3-FR-642**: Appearances in the current episode render as seek buttons (share too); other
  episodes as links.
- **R3-FR-643**: The record's "Open in the Registry" opens the panel with `focusId`; the strip's
  control is a panel trigger with `aria-expanded`; the panel footer links to the full page with
  the same scope.
- **R3-FR-644**: Episode files for the index are loaded lazily and cached for the visit
  (`RegistryIndexProvider`), shared by the page and the panel.

## R3 Success Criteria
- **R3-SC-607**: Opening the panel leaves `source` untouched (no seek/pause) and the stage rect
  unchanged; entries, scope, search, chips behave as on the page.
- **R3-SC-608**: Current-episode appearances seek the fake source; others are links; a11y 100.

---

# Revision 4 (2026-09-16) — newest episode first; the panel follows the playhead

Author: "Reverse the order of the registry so the current episode is on top; tie things showing
up in the registry to events/timestamps in the actual show as well."

## R4 Requirements
- **R4-FR-650**: Registry sections (page and panel) are ordered **newest episode first**; within a
  section, entries are ordered by first appearance **latest first**. Scope semantics are unchanged.
- **R4-FR-651**: In the Registry **panel** on an episode page, the current episode's contribution
  (appearances, fact unlocks, defeated) is limited to events with `t ≤ playhead`; earlier episodes
  contribute in full. An entity whose only appearances are later in the current episode is not
  listed; a fact unlocked later is not listed; the panel updates as the playhead moves (forward
  and back). The standalone page is unchanged (publication-scoped).
- **R4-FR-652**: Appearance rows keep their `mm:ss` timestamps; in the panel, current-episode
  appearances still seek in place.

## R4 Acceptance
1. **Given** `/registry` with three episodes, **Then** sections read Episode 3, Episode 2,
   Episode 1 top to bottom; within Episode 1 the entity met last appears first.
2. **Given** the panel on episode 1 at 2:00 (The Hoarder is met at 2:10), **Then** The Hoarder is
   absent; at 2:10 it appears with one appearance; at 6:20 its `lair` fact appears; at 9:00 it
   reads Defeated; scrubbing back to 5:00 removes the fact and the defeated line.
3. **Given** the panel scoped "Through Episode 2" while watching episode 2 at 1:00, **Then**
   episode 1's entities and facts are all present, and episode 2's are limited to ≤ 1:00.

## R4 Success Criteria
- **R4-SC-609**: A scripted sweep across the fixture's `npc` boundaries shows the panel's entries,
  facts, and defeated lines matching `events ≤ t` for the current episode at every step.

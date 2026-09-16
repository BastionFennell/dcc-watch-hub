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

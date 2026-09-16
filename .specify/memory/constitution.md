<!--
Sync Impact Report
- Version change: 1.2.0 → 1.2.1 (2026-09-15): PATCH — active-feature pointer moved to 004; no principle changes

Previous report (1.2.0):
- Version change: 1.1.0 → 1.2.0 (2026-09-15)
- Modified principles: III. Ambient & Diegetic — a modal "full record" dialog MAY cover the stage when the
  viewer explicitly asks for it from an already-open panel; it is the only overlay allowed to do so;
  V. Scope Discipline — active feature is now 003 (crawler record: glance card + full-record dialog)
- Added sections: none · Removed sections: none · Templates: none

Previous report (1.1.0):
- Version change: 1.0.0 → 1.1.0 (2026-09-15)
- Modified principles: V. Scope Discipline now binds to the ACTIVE feature spec rather than the v1 list;
  I. Time-Truth gains an explicit rule for persisted playhead (resume) — storage may hold the playhead only,
  never overlay state; III. Ambient & Diegetic clarified: opt-in panels (dossier, map) are allowed when opened by
  an explicit click and closed by an explicit action
- Added sections: none
- Removed sections: none
- Templates requiring updates: none (plan-template Constitution Check derives from Principles I–VI)
- Follow-up TODOs: none

Previous report (1.0.0):
- Version change: (template) → 1.0.0
- Modified principles: none (initial ratification)
- Added sections: Core Principles (I–VI), Technical Constraints, Development Workflow & Quality Gates, Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate list is derived from Principles I–VI at plan time (no structural change needed)
  - ✅ .specify/templates/spec-template.md — no change needed; scope-boundary rule (Principle V) is enforced in spec Assumptions/Out-of-scope
  - ✅ .specify/templates/tasks-template.md — no change needed; test tasks remain optional except where Principle I mandates reducer/selector tests
- Follow-up TODOs: none
-->

# DCC Watch Hub Constitution

## Core Principles

### I. Time-Truth (NON-NEGOTIABLE)
All overlay state MUST be a pure, deterministic function of the episode's `initialState` and the
event log filtered to `event.t <= playhead`. Concretely:
- The reducer MUST be pure: no I/O, no clocks, no randomness, no reads of component or DOM state.
- On any seek (forward or backward) state MUST be recomputed from `initialState`; incremental
  patching that could drift from the pure result is forbidden.
- Nothing MAY render information derived from an event whose `t` is greater than the current
  playhead. Prefetching data is allowed; displaying it is not.
- The reducer and selector layer MUST have automated unit tests covering t=0, mid-episode,
  backward seek, forward seek, and the "no event before its `t`" invariant.
- Persisted viewer state (for example a resume position in `localStorage`) MAY hold the playhead
  and viewer preferences only. It MUST NOT hold overlay state or anything derived from events;
  on resume the overlay is recomputed from `initialState` at the restored playhead.

Rationale: the product promise is a spoiler-free synchronized broadcast. Any state that is not a
pure function of the playhead can leak future events or desynchronize after scrubbing.

### II. Host-Agnostic Playback
Every overlay component MUST consume time exclusively through the `TimeSource` interface.
- No component, selector, or reducer MAY import from, reference, or type against the YouTube
  IFrame API. Only the `YouTubeTimeSource` adapter may.
- A deterministic fake `TimeSource` MUST exist for tests and MUST be sufficient to drive the full
  episode page without a network.
- Adding a new video host MUST require only a new `TimeSource` implementation and a factory
  change; no component changes.

Rationale: v3 parks alternate video sources. The seam must exist now or it will never be clean.

### III. Ambient by Default, Diegetic Always
- The default episode view is video + party rail + ticker. Anything deeper is opt-in via an
  explicit click and MUST NOT auto-open, auto-expand, or animate for attention beyond what the
  spec lists (toast, HP change, danger flash, level-up pulse).
- All user-facing copy and chrome MUST use the in-fiction System voice as specified (broadcast
  archive, sponsors, recap episodes). Generic web-app copy ("Dashboard", "Home", "Ads") is a defect.
- No audio MAY play in v1.
- Interactions reserved for later versions MUST NOT be teased: no hover affordances, pointer
  cursors, or tooltips on elements that do nothing in the active feature's scope.
- Opt-in panels (a crawler glance card, an expanded map) MUST open only from an explicit click or
  keypress, MUST close from an explicit action (close control, Escape, or click-away), and MUST
  never cover the video stage on desktop. One panel at a time.
- Exactly one overlay MAY cover the stage: the full crawler record dialog, and only when the
  viewer asks for it from the glance card. It MUST be modal (focus trapped, Escape/backdrop/close
  dismiss it, focus returns to its trigger), MUST keep updating with the playhead while open, and
  MUST NOT pause or otherwise touch playback.

Rationale: the experience is lean-back broadcast; teasing unbuilt features erodes trust.

### IV. Static, Dependency-Light Delivery
- The site MUST build to static assets deployable to any static host with no server code,
  no accounts, and no database. All episode data is static JSON fetched at load.
- UI frameworks beyond the chosen view library and router are forbidden; styling is plain CSS or
  CSS Modules. Any new runtime dependency MUST be justified in the plan's Complexity Tracking.
- Fonts MUST NOT block first render. Lighthouse performance on the episode page MUST be ≥ 90.
- Unknown event types MUST be ignored gracefully; schema evolution MUST NOT crash a page.

Rationale: the spec fixes the deploy target and performance bar; a heavy toolchain adds nothing
to a single-page broadcast overlay.

### V. Scope Discipline
- The active feature spec (`.specify/feature.json` → `specs/<feature>/spec.md`) defines scope.
  Items the handoff spec parks beyond the active feature MUST NOT be built, stubbed, or partially
  wired, even "for later." As of 2026-09-16 the active feature is 006 (`specs/006-mobile-pass`): the phone layout — sticky
  mini-player, tabs beneath it, bottom-sheet panels. v1, v2, 003, 004, and 005 are merged. Still parked: stinger sounds, roster page,
  tooltips/explanations inside the record, and all v3 items.
- Optimizations not required to meet an acceptance item (memoization, virtualization, caching)
  MUST NOT be added. The spec explicitly says recompute from `initialState` on seek.
- Every functional requirement MUST trace to a v1 acceptance-checklist item or spec section.

Rationale: the handoff spec is deliberately scoped; leakage from parked items is the primary risk.

### VI. Author-Friendly Data Pipeline
- Episode data is authored by editors, not engineers. `scripts/sheet-to-json.ts` MUST convert
  the documented CSV shape to `ep{N}.json` and MUST validate it.
- Validation findings the spec labels as warnings (unknown actor, non-monotonic HP without an
  event, timecode past duration) MUST be reported as warnings that still produce output; only
  malformed input (unparseable timecode, unknown required column) is an error.
- The converter MUST have a sample CSV and an automated check proving it flags a deliberately
  broken row.

Rationale: acceptance item 9 and the reality that the editor, not the developer, owns the data.

## Technical Constraints

- Runtime: Node 20.9 (pinned in `.tool-versions`); the toolchain MUST install and build on it.
- Stack: Vite + React + TypeScript (strict mode). Router and view library are the only UI
  runtime dependencies. Plain CSS / CSS Modules only.
- Data contracts: `show.json` and `ep{N}.json` schemas in the handoff spec are the source of
  truth. Changes require a spec amendment and a converter update in the same change.
- Visual language: colors, typography rules, and layout constraints in spec Section 6 are
  requirements, not suggestions.
- Browser support: current desktop Chrome, Firefox, Safari; mobile stacked layout with no
  horizontal scroll.

## Development Workflow & Quality Gates

- Spec-driven: constitution → spec → plan → tasks → implement. Implementation MUST NOT begin
  until `tasks.md` exists and traces to the spec.
- Every change MUST pass: `tsc --noEmit`, lint, and the unit test suite. Reducer/selector tests
  are mandatory (Principle I); component and script tests are required where the spec's
  acceptance checklist names the behavior.
- Each task in `tasks.md` is committed as a small, reviewable unit with the task ID in the
  commit message. Tasks are marked `[X]` when done.
- The plan's Constitution Check MUST enumerate Principles I–VI as gates with a pass/fail note.
  Any violation MUST be recorded in Complexity Tracking with the simpler alternative rejected.
- The v1 acceptance checklist (spec Section 7) is the definition of done for the feature.

## Governance

This constitution supersedes all other practices for this repository. Amendments require:
1. A written rationale in the pull request or commit that changes this file.
2. A version bump per semantic versioning: MAJOR for principle removals or incompatible
   redefinitions, MINOR for new principles or materially expanded guidance, PATCH for
   clarifications and wording.
3. Propagation to dependent templates and `CLAUDE.md` in the same change, with the Sync Impact
   Report comment at the top of this file updated.

Compliance is reviewed at every plan (Constitution Check gate) and at implementation completion
(acceptance checklist). Use `CLAUDE.md` for runtime development guidance and pointers to the
active plan.

**Version**: 1.2.1 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-15

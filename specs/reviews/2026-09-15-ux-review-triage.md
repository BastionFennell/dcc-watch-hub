# Triage of the automated UX review (2026-09-15)

Source: `2026-09-15-ux-review.md` (automated). Evaluated against the constitution (1.2.0), the
handoff spec, and the author's stated context. Author-supplied correction folded in: **there is no
party rank in DCC, only individual rank** — all party-rank references are removed (see task T334).

Legend: **Do now** = folded into feature 003 revision 2 polish · **Milestone** = proposed as a
later feature · **Decline / context** = not adopted, with the reason · **Done** = already true.

## Phase 0 — bugs

| # | Finding | Verdict | Notes |
|---|---------|---------|-------|
| 0.1 | Dash placeholder rows in glance history | Done (R2) | Placeholders removed in revision 2; height held by `min-height`. |
| 0.2 | Floor map does not carry reveals across episodes on the same floor | Do now (data + docs), decline engine change | The data model already provides this: each episode's `initialState.map.revealed` is authored to include prior reveals (that is what `initialState` is for). Sample ep2 simply omitted ep1's reveals. Fix the samples and document the authoring rule; no cross-episode fetching in the engine (it would break the one-file-per-episode contract and load spoilers for viewers who skipped ahead). |
| 0.3 | Empty feed at 0:00 | Do now | System-voice standby line. |
| 0.4 | Map panel: no count, no empty state | Do now | Count in the panel header; empty-state line. |
| 0.5 | ACHIEVEMEN… truncation | Done (R2) | Ledger rows are gone. |
| 0.6 | Glance visible through the modal during fade | Do now | Backdrop opaque from frame one; only the dialog box fades/moves. |
| 0.7 | Accessible-name concatenation ("DannyDanny", "UnclassedLv 1") | Do now | Real separator text (aria-hidden "·" plus sr-only comma) instead of CSS-only separators. |
| 0.8 | Handle · player reads redundant | Do now | "played by {player}" label; also a sample-data artifact (handle contains the player's name). |
| 0.9 | Name truncation 950–1050 px | Do now | Wrap the rail to 3 + 2 below ~1100 px when the feed column is present. |
| 0.10 | Status pip row jitters card height | Do now | Reserve a fixed pips row on every frame. |
| 0.11 | Stage caption collides with YouTube chrome / illegible | Do now (with a spec deviation) | Move the caption out of the player into a slim row above the timeline: left "Ep 1 · Floor 1 — The World Dungeon", right playhead time. Also resolves 0.13. Deviates from v1 §5 (caption inside the stage); recorded here as an amendment. |
| 0.12 | Placeholder Discord URL | Author | Needs the real invite. |
| 0.13 | Episode title never visible | Do now | See 0.11. |

## Phase 1 — discoverability

| # | Finding | Verdict | Notes |
|---|---------|---------|-------|
| 1.1 | Timeline markers unlabeled / no affordance | Partly wrong, partly Do now | Markers already have `title` tooltips, pointer cursor, scale-on-hover, focus rings (the review missed native tooltips). Adopt: a custom hover/focus tooltip (instant, works on touch), a compact color legend, and a distinct playhead marker separate from the fill. |
| 1.2 | One-time coach mark | Milestone (low) | Allowed (viewer preference), diegetic copy possible; low priority. |
| 1.3 | Segmented red→green HP reads as damaged at full health | Author decision | The strip deliberately mirrors the official sheet's 10 %…100 % HP boxes. Alternative: single threshold color. Recommend keeping sheet fidelity and adding an "HP" label; author to confirm. |
| 1.4 | Rank values unlabeled; party rank meaningless | Do now (individual rank only) | Add a "RANK" label and a ↑/↓ delta since the previous rank event. Party rank removed entirely (author). |
| 1.5 | "System feed" pill looks interactive | Decline | It is inside the brand link to the archive, so it is interactive. Minor restyle possible later. |
| 1.6 | Feed items click-to-seek, show timestamps | Do now | Cheap; every item carries `t`. |
| 1.7 | Full episode log with filters and scrollback | Milestone (high) | Strong candidate for the next feature; also fills the desktop dead space (1.11). Time-truth holds (only elapsed events). |
| 1.8 | Spoiler-free mode toggle for future markers | Milestone (medium) | v1 spec chose colored markers as navigation; a persisted toggle for neutral ticks is reasonable later, with 1.10. |
| 1.9 | Production deep links `?t=` + share | Milestone (high, cheap) | The queued seek already exists in the adapter; deep link should win over the resume offer. Share buttons copy the link. |
| 1.10 | Settings panel | Milestone (low) | Sounds remain parked (author). |
| 1.11 | Desktop dead space | Milestone | Solved by 1.7. |

## Phase 2 — mobile

| # | Finding | Verdict |
|---|---------|---------|
| 2.1 | Sticky mini-player | Milestone (high) |
| 2.2 | Sticky player + Feed / Party / Map tabs | Milestone (high, with 2.1) |
| 2.3 | Bottom sheet instead of full-screen panels | Milestone (with 2.1) |
| 2.4 | Ragged 3 + 2 party row at 420 px | Do now (horizontal strip) |

The v1 spec only required a stacked mobile layout; a proper mobile milestone is warranted.

## Phase 3 — new surfaces

| # | Finding | Verdict |
|---|---------|---------|
| 3.1 | Homepage rebuild (hero, cards, continue watching) | Milestone; needs thumbnails/loglines from the author |
| 3.2 | Roster page | Parked by the author until art exists |
| 3.3 | Leaderboard | Milestone; individual rank only (no party rank); needs cross-episode data rules |
| 3.4 | Achievement gallery | Milestone (cheap) |
| 3.5 | Interactive sectors (click-to-seek, route, position) | Milestone; the log has no position data yet |

## Notes on the review's open questions
- Focus returns to the trigger on modal close: verified by tests and a real-browser check (003 Results).
- Feed live region rate: the feed is not a live region; only the achievement toast (`role="status"`)
  and the map zoom readout are, so there is no per-tick announcement problem.

/**
 * One draft event as the viewer would say it (010, T1022 / T1023).
 *
 * The event list, the timeline markers and the form's preview all have to read
 * the same sentence, and there is only one place that sentence exists: the
 * viewer's `feedItems` selector. So this wraps it rather than re-deriving it -
 * if the feed changes wording, every Studio surface changes with it
 * (constitution VII, "same truth").
 *
 * React-free: it is a selector call and a string.
 */
import type { Registry } from '../data/types';
import { normalizeEvent } from '../data/validate';
import { feedItems } from '../engine/selectors';
import type { SpellIndex } from '../engine/spells';
import { spellIndex } from '../engine/spells';
import type { RawEvent, StudioDraft } from './draft';
import { draftParty } from './draft';
import { eventTypeLabel } from './eventForms';
import type { StudioRegistries } from './options';

export interface FeedLineContext {
  /** `[{ id, name }]` - what the feed needs to name a crawler. */
  party: { id: string; name: string }[];
  npcs: Registry | null;
  spells: SpellIndex;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** The context a draft implies, built once per draft by its callers. */
export function feedContext(
  draft: StudioDraft,
  registries?: StudioRegistries,
): FeedLineContext {
  const party: { id: string; name: string }[] = [];
  for (const raw of draftParty(draft)) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (id === '') continue;
    party.push({ id, name: typeof raw.name === 'string' ? raw.name : id });
  }
  return {
    party,
    npcs: registries?.npcs ?? null,
    spells: spellIndex(registries?.spells ?? null),
  };
}

/** The feed's own `{ label, text }` for one raw event, or `null` when it has none. */
export function feedLine(
  event: RawEvent,
  ctx: FeedLineContext,
): { label: string; text: string } | null {
  const normalized = normalizeEvent(event);
  if (normalized.type === 'unknown') return null;
  const item = feedItems([normalized], event.t, 1, ctx.party, ctx.npcs, ctx.spells)[0];
  return item === undefined ? null : { label: item.label, text: item.text };
}

/**
 * One line for a row or a marker label. An event the viewer would ignore still
 * needs to be findable, so it falls back to its type's own label - the author
 * has to be able to click the broken row to fix it.
 */
export function feedSentence(event: RawEvent, ctx: FeedLineContext): string {
  const line = feedLine(event, ctx);
  if (line === null) return eventTypeLabel(event.type);
  return `${line.label} ${line.text}`;
}

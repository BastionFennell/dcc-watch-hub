/**
 * What the dossier's status strip says (012), derived from the cards the reader
 * has **revealed** and from nothing else.
 *
 * That restriction is the whole point. The compiled file on disk knows exactly
 * where every crawler stands; the strip is not allowed to. It reports what the
 * reader has actually opened, so someone three episodes behind sees the world
 * as it was three episodes ago, and someone who has opened nothing sees three
 * grey pills.
 *
 * Two rules the brief learned the hard way:
 *  - **accumulate, never take the latest.** Reading condition off the newest
 *    revealed card printed "Alive" next to a posthumous merch update.
 *  - **death is sticky.** Any revealed `deceased` card makes the answer
 *    `deceased`, whatever the cards around it say. The build enforces the same
 *    rule in the data, so this is belt and braces on purpose.
 *
 * Pure and framework-free: the panel is Wave B's, these answers are not.
 */
import type { CrawlerCondition, DossierCard } from '../../data/types';

export interface StripValues {
  /** The last revealed level in episode order; `null` when nothing is revealed. */
  level: number | null;
  /** `deceased` if any revealed card says so; `null` when nothing is revealed. */
  condition: CrawlerCondition | null;
  /** The highest revealed episode they were on screen for; `null` for none. */
  lastOnCamera: number | null;
}

/**
 * @param revealed the revealed cards, in any order - this sorts its own copy,
 *   because "the last revealed level" has to mean the last *episode*, not the
 *   last click.
 */
export function deriveStrip(revealed: readonly DossierCard[]): StripValues {
  if (revealed.length === 0) return { level: null, condition: null, lastOnCamera: null };

  const ordered = [...revealed].sort((a, b) => a.episode - b.episode);

  let level: number | null = null;
  let condition: CrawlerCondition = 'alive';
  let lastOnCamera: number | null = null;

  for (const card of ordered) {
    if (typeof card.level === 'number') level = card.level;
    if (card.condition === 'deceased') condition = 'deceased';
    if (card.onCamera && (lastOnCamera === null || card.episode > lastOnCamera)) {
      lastOnCamera = card.episode;
    }
  }

  return { level, condition, lastOnCamera };
}

/**
 * Which pronoun the panel's heading uses: "Where is *he* now?", "Where is
 * *she* now?", "Where are *they* now?".
 *
 * Reads the first token of the roster's existing `pronouns` field ("he/him",
 * "she/her", "they/them"), and falls back to "they" for anything else, which is
 * also what an unwritten field gets. No new data, and nothing to keep in sync.
 */
export function headingFor(pronouns?: string): 'he' | 'she' | 'they' {
  const first = (pronouns ?? '').trim().toLowerCase().split(/[^a-z]+/)[0];
  if (first === 'he') return 'he';
  if (first === 'she') return 'she';
  return 'they';
}

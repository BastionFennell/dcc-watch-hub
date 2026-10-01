/**
 * The auto quiet card's words (012), in one module because two very different
 * places say them: `scripts/build-dossier.ts` bakes them into every aired
 * episode a crawler has no authored card for, and the panel reads the same
 * strings back out of the compiled file.
 *
 * They matter more than their length suggests. A quiet card is what keeps
 * absence from being a signal: it is the same card, in the same words, for a
 * crawler who stepped out of frame and for one who is never coming back, so a
 * reader counting rows learns nothing either way.
 *
 * Framework-free on purpose - `scripts/**` may not import React.
 */

/** The tag line of a card with no news in it. Present tense, System voice. */
export const quietTitle = 'Off camera this episode';

/** @param characterName the crawler's in-fiction name ("Harold \"Harry\" Wallace"). */
export function quietBody(characterName: string): string {
  return `${characterName} sits this one out. No status change.`;
}

/**
 * The cast's two derived facts (014), as pure functions: who plays a crawler,
 * and where that person's card lives. Framework-free, like `gate.ts`.
 *
 * The reference runs one way only - a member names their crawler, a crawler
 * says nothing about people - so "who plays Ronald" is always a lookup here,
 * never a field to keep in step with another one.
 */
import type { CastMember } from '../data/types';

/**
 * The first member who plays `crawlerId`, or `undefined` when nobody does (no
 * cast file yet, or a roster the cast has not caught up with). The build lint
 * makes "nobody" and "two people" unreachable in a real build; at runtime the
 * first match wins and the crawler page simply shows no credit for none.
 */
export function playerOf(cast: readonly CastMember[], crawlerId: string): CastMember | undefined {
  return cast.find((member) => member.crawlerId === crawlerId);
}

/** `madio` -> `/cast#madio`: the address of one person's card. */
export function castAnchor(id: string): string {
  return `/cast#${id}`;
}

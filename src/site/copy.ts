/**
 * Marketing copy (011). Plain voice: the System speaks only inside a SystemBox,
 * and these strings are what a stranger reads on the way in.
 *
 * `src/copy.ts` stays the hub's voice; this file is the front door's, so a
 * change to one never disturbs the other. Wave B appends to the end of this
 * object, exactly as the hub's copy file is extended.
 */
export const siteCopy = {
  // The gated call to action (011 §2.1). Before `hubLiveAt` the only place to
  // watch is YouTube; after it, the System feed opens.
  watchOnYouTube: 'Watch on YouTube',
  openSystemFeed: 'Open the System feed',

  // The head every prerendered route starts from, before its own <Seo> (if it
  // has one) overwrites it. The show's own `title` / `pitch` win when present.
  defaultTitle: 'Dungeon Crawl Cast',
  defaultDescription: 'A Dungeon Crawler Carl actual play.',
} as const;

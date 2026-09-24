/**
 * The vocabulary a page's `<head>` needs, and nothing else (011).
 *
 * It sits in its own module for a reason a reader deserves up front: the hub is
 * one entry chunk and the front door is a set of lazy ones, and any module both
 * sides import is hoisted into the entry chunk. `siteCopy` is a page's worth of
 * marketing prose; the header's nav labels and the episode page's head need
 * about a dozen strings of it. Splitting those dozen out is what keeps the
 * other 2.9 kB off a viewer who only ever opens `/ep/3`.
 *
 * `siteCopy` spreads this in, so every call site still reads `siteCopy.x`.
 *
 * Strings only, for the same reason: a helper here would drag whatever it needs
 * into the entry chunk with it. The share-image resolvers live in `media.ts`,
 * and the header's nav labels in `src/copy.ts`, which the header already has.
 */
export const metaCopy = {
  /** The brand, spelled once. */
  siteName: 'Dungeon Crawl Cast',

  // The head every prerendered route starts from, before its own <Seo> (if it
  // has one) overwrites it. The show's own `title` / `pitch` win when present.
  defaultTitle: 'Dungeon Crawl Cast',
  defaultDescription: 'A Dungeon Crawler Carl actual play.',
  pageTitle: (page: string) => `${page} · Dungeon Crawl Cast`,
  /** The 404's head; the page's body copy stays the System's (src/copy.ts). */
  notFoundTitle: 'Not found',


  // The share images `scripts/og.mjs` writes into `dist/og/`.
  ogSiteImage: '/og/site.png',
  ogCrawlerImage: (id: string) => `/og/crawler-${id}.png`,
  ogEpisodeImage: (id: number) => `/og/ep${id}.png`,
} as const;

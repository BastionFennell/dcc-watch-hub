/** Types for the pure half of `sitemap.mjs` (the script itself is plain ESM). */
export declare function canonicalBase(siteUrl?: string, base?: string): string;
export declare function buildSitemap(routes: string[], base: string): string;
export declare function buildRobots(base: string): string;

/** Types for the pure half of `prerender.mjs` (the script itself is plain ESM). */
export declare const STATIC_ROUTES: string[];
export declare function routesFor(crawlers: unknown): string[];
export declare function embedScript(data: unknown): string;
export declare function injectPage(
  template: string,
  page: { head: string; html: string; data: unknown },
): string;
export declare function outputPath(distDir: string, route: string): string;

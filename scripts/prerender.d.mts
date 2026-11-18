/** Types for the pure half of `prerender.mjs` (the script itself is plain ESM). */
export declare const STATIC_ROUTES: string[];
export declare function crawlerIdIn(route: string): string | null;
export declare function routesFor(crawlers: unknown): string[];
/** Files relative to the build output, e.g. `assets/CastPage-abc.css`. */
export interface RouteAssets {
  styles: string[];
  scripts: string[];
}
export declare const PAGE_MODULES: Record<string, string>;
export declare function modulesFor(route: string): string[];
export declare function assetsFor(manifest: unknown, route: string): RouteAssets;
export declare function assetPrefix(template: string): string;
export declare function embedScript(data: unknown): string;
export declare function injectPage(
  template: string,
  page: { head: string; html: string; data: unknown; assets?: RouteAssets },
): string;
export declare function outputPath(distDir: string, route: string): string;

/** Types for the pure half of `og.mjs` (the script itself is plain ESM). */
export declare const CHROME_CANDIDATES: string[];
export declare function findChrome(env?: NodeJS.ProcessEnv): Promise<string | null>;
export declare function shotList(
  show: unknown,
  crawlers: unknown,
): { route: string; file: string }[];

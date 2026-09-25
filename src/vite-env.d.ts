/// <reference types="vite/client" />

/**
 * The front door's build-time environment (011). Every one is optional: the
 * site builds and runs without them, with the defaults named below.
 */
interface ImportMetaEnv {
  /** Canonical origin for canonical / og:url tags and the sitemap. */
  readonly VITE_SITE_URL?: string;
  /** Plausible's site domain. Unset means no analytics script at all. */
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

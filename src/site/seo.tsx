/**
 * Per-route head tags (011 §7). One component, two consumers:
 *
 * - In the browser, React 19 hoists `<title>`, `<meta>` and `<link>` out of the
 *   tree into `<head>` on its own, so `<Seo>` is written wherever it belongs
 *   and lands where it must.
 * - On the server, `renderToString` emits those hoistables somewhere in the
 *   returned HTML string - which is no use to a prerenderer that has to put
 *   them inside `<head>` of a template. So `<Seo>` also registers the same
 *   values with a `HeadCollector` when one is in context, and `render()` hands
 *   the collector's output back as `head`. The collected string is built from
 *   the props by a pure function, in a fixed order, so it is identical no
 *   matter what `renderToString` decides to do with the elements themselves.
 */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { joinBase } from '../data/load';

export interface SeoProps {
  title: string;
  description: string;
  /** Root-relative, e.g. `/crawlers/harry`. The deploy base is added here. */
  canonicalPath: string;
  /** Root-relative or absolute. Root-relative is resolved against the site. */
  ogImage?: string;
  /** `website` (default), `article`, `video.episode`, ... */
  ogType?: string;
  /** Emitted verbatim as `application/ld+json`. */
  jsonLd?: unknown;
}

const DEFAULT_SITE_URL = 'https://dungeoncrawlcast.com';

/** The canonical origin, with no trailing slash. */
export function siteOrigin(): string {
  const raw = import.meta.env?.VITE_SITE_URL ?? DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

/** An absolute URL for a root-relative path, deploy base included. */
export function absoluteUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  const base = import.meta.env?.BASE_URL ?? '/';
  const rooted = path.startsWith('/') ? path : `/${path}`;
  return `${siteOrigin()}${joinBase(base, rooted)}`;
}

/* ------------------------------------------------------ the collector */

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * JSON-LD sits inside a `<script>`, so the one sequence that must never survive
 * is the closing tag; `<` is escaped wholesale, which JSON readers accept.
 */
function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** `[key, html]` pairs, in the order the head should read. */
function headPairs(props: SeoProps): [string, string][] {
  const { title, description, canonicalPath, ogImage, ogType } = props;
  const url = absoluteUrl(canonicalPath);
  const image = ogImage === undefined ? undefined : absoluteUrl(ogImage);
  const pairs: [string, string][] = [
    ['title', `<title>${escapeText(title)}</title>`],
    ['meta:description', `<meta name="description" content="${escapeAttribute(description)}" />`],
    ['link:canonical', `<link rel="canonical" href="${escapeAttribute(url)}" />`],
    ['og:title', `<meta property="og:title" content="${escapeAttribute(title)}" />`],
    [
      'og:description',
      `<meta property="og:description" content="${escapeAttribute(description)}" />`,
    ],
    ['og:url', `<meta property="og:url" content="${escapeAttribute(url)}" />`],
    ['og:type', `<meta property="og:type" content="${escapeAttribute(ogType ?? 'website')}" />`],
    ['og:site_name', `<meta property="og:site_name" content="Dungeon Crawl Cast" />`],
    [
      'twitter:card',
      `<meta name="twitter:card" content="${image === undefined ? 'summary' : 'summary_large_image'}" />`,
    ],
  ];
  if (image !== undefined) {
    pairs.push(['og:image', `<meta property="og:image" content="${escapeAttribute(image)}" />`]);
    pairs.push([
      'twitter:image',
      `<meta name="twitter:image" content="${escapeAttribute(image)}" />`,
    ]);
  }
  /*
   * JSON-LD is deliberately NOT collected. React does not hoist an inline
   * script, so `renderToString` leaves it exactly where the tree put it - in
   * the body - and the client renders it there too. Collecting it as well would
   * put the same block on the page twice; it is valid anywhere on the page, so
   * the body copy is the one that stays.
   */
  return pairs;
}

/**
 * Collects head tags during a server render. Keyed, so a route that renders two
 * `<Seo>` elements ends with the last one's values rather than both.
 */
export class HeadCollector {
  private readonly tags = new Map<string, string>();

  collect(props: SeoProps): void {
    for (const [key, html] of headPairs(props)) this.tags.set(key, html);
  }

  /** The head, one tag per line, in a fixed order. */
  toString(): string {
    return [...this.tags.values()].join('\n');
  }
}

const HeadCollectorContext = createContext<HeadCollector | null>(null);

export function HeadCollectorProvider({
  collector,
  children,
}: {
  collector: HeadCollector;
  children: ReactNode;
}) {
  return <HeadCollectorContext.Provider value={collector}>{children}</HeadCollectorContext.Provider>;
}

/* ----------------------------------------------------------- the tags */

export function Seo(props: SeoProps) {
  const collector = useContext(HeadCollectorContext);
  // Server-only, and the server renders each element once: collecting during
  // render is what makes `head` available the moment `renderToString` returns.
  if (collector !== null) collector.collect(props);

  const { title, description, canonicalPath, ogImage, ogType, jsonLd } = props;
  const url = absoluteUrl(canonicalPath);
  const image = ogImage === undefined ? undefined : absoluteUrl(ogImage);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType ?? 'website'} />
      <meta property="og:site_name" content="Dungeon Crawl Cast" />
      <meta name="twitter:card" content={image === undefined ? 'summary' : 'summary_large_image'} />
      {image === undefined ? null : (
        <>
          <meta property="og:image" content={image} />
          <meta name="twitter:image" content={image} />
        </>
      )}
      {jsonLd === undefined ? null : (
        <script
          type="application/ld+json"
          // The JSON is ours, built from show.json; `<` is escaped so the
          // closing tag can never be forged out of a title.
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(jsonLd) }}
        />
      )}
    </>
  );
}

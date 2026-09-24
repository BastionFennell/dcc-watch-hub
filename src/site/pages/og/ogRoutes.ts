/**
 * The share-image routes, for Wave C to spread into the router:
 *
 *   {ogRoutes.map(({ path, Component }) => (
 *     <Route key={path} path={path} element={<Component />} />
 *   ))}
 *
 * They exist only so `scripts/og.mjs` has something to screenshot; nothing
 * links to them and they carry no head tags.
 */
import type { ComponentType } from 'react';
import { OgCrawlerPage } from './OgCrawlerPage';
import { OgEpisodePage } from './OgEpisodePage';
import { OgSitePage } from './OgSitePage';

export interface OgRoute {
  path: string;
  Component: ComponentType;
}

export const ogRoutes: OgRoute[] = [
  { path: '/_og/site', Component: OgSitePage },
  { path: '/_og/crawler/:id', Component: OgCrawlerPage },
  { path: '/_og/episode/:id', Component: OgEpisodePage },
];

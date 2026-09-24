import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useMatch } from 'react-router';
import { ShowProvider, useShow } from './data/ShowContext';
import type { Embedded } from './data/types';
import { RegistryProvider } from './data/RegistryContext';
import { RegistryIndexProvider } from './data/RegistryIndexContext';
import { findEpisode } from './data/show';
import { SiteHeader } from './components/SiteHeader/SiteHeader';
import { SystemNotice } from './components/SystemNotice/SystemNotice';
import { HubPage } from './pages/HubPage';
import { EpisodePage } from './pages/EpisodePage';
import { RegistryPage } from './pages/RegistryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { copy } from './copy';
import styles from './App.module.css';

/*
 * The Studio (010, constitution VII): the author's event editor, behind
 * `React.lazy` so not one byte of it reaches a viewer who never opens it. These
 * two imports are the ONLY place outside `src/studio/**` that names it, and
 * nothing inside it is imported statically from anywhere else.
 *
 * The routes sit inside the providers below, so the Studio reads the same
 * `show.json`, entity registry and spell registry the viewer does.
 */
const StudioHomePage = lazy(() => import('./studio/pages/StudioHomePage'));
const StudioEpisodePage = lazy(() => import('./studio/pages/StudioEpisodePage'));

function AppShell() {
  const { show, error, reload } = useShow();
  const match = useMatch('/ep/:id');
  const rawId = match?.params.id;
  // Same rule as EpisodePage: digits only, so header and page agree on what is an episode.
  const current =
    show && rawId !== undefined && /^\d+$/.test(rawId) ? findEpisode(show, Number(rawId)) : undefined;

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        {copy.skipToContent}
      </a>
      <SiteHeader show={show} current={current} />
      <main id="main" className={styles.main}>
        {error ? (
          <section className={styles.failure}>
            <SystemNotice tone="error">
              <p>{copy.archiveUnavailable}</p>
              <p className={styles.retryRow}>
                <button type="button" onClick={reload} className={styles.retry}>
                  {copy.retry}
                </button>
              </p>
            </SystemNotice>
          </section>
        ) : (
          <Routes>
            <Route path="/" element={<HubPage />} />
            <Route path="/ep/:id" element={<EpisodePage />} />
            <Route path="/codex" element={<RegistryPage />} />
            {/*
              The Studio is not in the site navigation and never will be: it is
              a tool the author reaches by typing the URL (FR-1000).
            */}
            <Route
              path="/studio"
              element={
                <Suspense fallback={null}>
                  <StudioHomePage />
                </Suspense>
              }
            />
            <Route
              path="/studio/ep/:id"
              element={
                <Suspense fallback={null}>
                  <StudioEpisodePage />
                </Suspense>
              }
            />
            <Route path="/registry" element={<Navigate to="/codex" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export interface AppProps {
  /**
   * The prerenderer's payload (011). The browser leaves it undefined and the
   * providers read the page themselves; `entry-server` passes it in, because
   * there is no page to read on the server.
   */
  embedded?: Embedded | null;
}

export function App({ embedded }: AppProps = {}) {
  return (
    <ShowProvider embedded={embedded}>
      {/* The registry needs the show's `registryUrl`, so it nests inside (007 R1). */}
      <RegistryProvider>
        {/* The index is lazy: nothing is fetched until the page or the panel
            asks for it (007 R3, R3-FR-644). */}
        <RegistryIndexProvider>
          <AppShell />
        </RegistryIndexProvider>
      </RegistryProvider>
    </ShowProvider>
  );
}

export default App;

import { Route, Routes, useMatch } from 'react-router';
import { ShowProvider, useShow } from './data/ShowContext';
import { findEpisode } from './data/show';
import { SiteHeader } from './components/SiteHeader/SiteHeader';
import { SystemNotice } from './components/SystemNotice/SystemNotice';
import { HubPage } from './pages/HubPage';
import { EpisodePage } from './pages/EpisodePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { copy } from './copy';
import styles from './App.module.css';

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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ShowProvider>
      <AppShell />
    </ShowProvider>
  );
}

export default App;

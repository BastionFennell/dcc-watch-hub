import { Link, Route, Routes } from 'react-router';
import { ShowProvider, useShow } from './data/ShowContext';
import { SystemNotice } from './components/SystemNotice/SystemNotice';
import { IconBroadcast } from './components/icons';
import { HubPage } from './pages/HubPage';
import { EpisodePage } from './pages/EpisodePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { copy } from './copy';
import styles from './App.module.css';

/**
 * Header slot — a placeholder for <SiteHeader/> (tasks.md T025/T028).
 * It already carries the mark, the show title, and the System feed pill so the
 * chrome height and colors are fixed before the real header lands.
 */
function HeaderSlot() {
  return (
    <header className={styles.headerSlot}>
      <Link to="/" className={styles.mark}>
        <img src={`${import.meta.env.BASE_URL}img/dcc-mark.svg`} alt="" width={22} height={22} />
        <span className={styles.markTitle}>{copy.siteTitle}</span>
      </Link>
      <span className={styles.pill}>
        <IconBroadcast />
        {copy.systemFeedPill}
      </span>
    </header>
  );
}

function AppShell() {
  const { error, reload } = useShow();

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        {copy.skipToContent}
      </a>
      <HeaderSlot />
      <main id="main" className={styles.main}>
        {error ? (
          <section style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-7)' }}>
            <SystemNotice tone="error">
              <p>{copy.archiveUnavailable}</p>
              <p style={{ marginTop: 'var(--space-4)' }}>
                <button type="button" onClick={reload} style={{ color: 'var(--brand-fg)' }}>
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

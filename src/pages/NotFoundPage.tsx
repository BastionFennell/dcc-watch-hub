import { Suspense } from 'react';
import { Link, useLocation } from 'react-router';
import { SystemNotice } from '../components/SystemNotice/SystemNotice';
import { HubHead } from '../site/pages/lazy';
import { copy } from '../copy';

/**
 * The System's shrug (FR-053), and since 011 the site's 404 as well: an unknown
 * crawler id lands here too. It carries a head because a static host serves
 * `404.html` for anything it cannot find, and `noindex` because the one thing a
 * search engine must not do with this page is keep it.
 */
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-7)' }}>
      <Suspense fallback={null}>
        <HubHead kind="notFound" path={pathname} />
      </Suspense>
      <SystemNotice>
        <p>{copy.notFoundTitle}</p>
        <p style={{ marginTop: 'var(--space-3)' }}>{copy.notFoundBody}</p>
        <p style={{ marginTop: 'var(--space-4)' }}>
          {/* The archive moved to `/watch` when `/` became the front door (011 §1). */}
          <Link to="/watch">{copy.returnToArchive}</Link>
        </p>
      </SystemNotice>
    </section>
  );
}

export default NotFoundPage;

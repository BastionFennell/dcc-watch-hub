import { Suspense } from 'react';
import { Link, useLocation } from 'react-router';
import { HubHead } from '../site/pages/lazy';
import { copy } from '../copy';
import styles from './NotFoundPage.module.css';

/**
 * The System's shrug (FR-053), and since 011 the site's 404 as well: an unknown
 * crawler id lands here too. It carries a head because a static host serves
 * `404.html` for anything it cannot find, and `noindex` because the one thing a
 * search engine must not do with this page is keep it.
 */
export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <section className={styles.page}>
      <Suspense fallback={null}>
        <HubHead kind="notFound" path={pathname} />
      </Suspense>
      <div className={styles.box}>
        <span className={styles.tag}>{copy.systemTag}</span>
        <h1 className={styles.title}>{copy.notFoundTitle}</h1>
        <p className={styles.body}>{copy.notFoundBody}</p>
        <p className={styles.actions}>
          {/* The archive moved to `/watch` when `/` became the front door (011 §1). */}
          <Link className={styles.action} data-primary to="/watch">
            {copy.returnToArchive}
          </Link>
          <Link className={styles.action} to="/">
            {copy.notFoundHome}
          </Link>
        </p>
      </div>
    </section>
  );
}

export default NotFoundPage;

import { Link } from 'react-router';
import { SystemNotice } from '../components/SystemNotice/SystemNotice';
import { copy } from '../copy';

export function NotFoundPage() {
  return (
    <section style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-7)' }}>
      <SystemNotice>
        <p>{copy.notFoundTitle}</p>
        <p style={{ marginTop: 'var(--space-3)' }}>{copy.notFoundBody}</p>
        <p style={{ marginTop: 'var(--space-4)' }}>
          <Link to="/">{copy.returnToArchive}</Link>
        </p>
      </SystemNotice>
    </section>
  );
}

export default NotFoundPage;

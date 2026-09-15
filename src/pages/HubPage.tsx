import { copy } from '../copy';

/**
 * Stub (tasks.md T018). T026 replaces this with the floor-grouped archive.
 */
export function HubPage() {
  return (
    <section style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-7)' }}>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--text-3)',
        }}
      >
        {copy.archiveKicker}
      </p>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginTop: 'var(--space-2)' }}>
        {copy.archiveTitle}
      </h1>
      <p style={{ color: 'var(--text-2)', marginTop: 'var(--space-3)' }}>{copy.archiveLead}</p>
    </section>
  );
}

export default HubPage;

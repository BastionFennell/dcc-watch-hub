import { useParams } from 'react-router';
import { useShow } from '../data/ShowContext';
import { findEpisode, seasonOf } from '../data/show';
import { NotFoundPage } from './NotFoundPage';
import { copy } from '../copy';

/**
 * Stub (tasks.md T018). T023 replaces this with the stage, timeline, party rail
 * and event feed driven by a `TimeSource`.
 */
export function EpisodePage() {
  const { id } = useParams();
  const { show } = useShow();
  const episodeId = Number(id);

  if (!Number.isInteger(episodeId)) return <NotFoundPage />;
  if (!show) return null;

  const meta = findEpisode(show, episodeId);
  if (!meta) return <NotFoundPage />;

  return (
    <section style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-6)' }}>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--text-3)',
        }}
      >
        {copy.episodeLabel(seasonOf(show, meta.id), meta.floor, meta.id)}
      </p>
      <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginTop: 'var(--space-2)' }}>
        {meta.title}
      </h1>
    </section>
  );
}

export default EpisodePage;

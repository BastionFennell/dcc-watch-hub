import type { RankSeries } from '../../engine/selectors';
import { copy } from '../../copy';
import styles from './CrawlerDossier.module.css';

export interface RankSparklineProps {
  /** `rankSeries(events, t, scope)` - elapsed points only (FR-140). */
  series: RankSeries;
  /**
   * Fill the caller's row instead of keeping the 120×32 box's ratio (T333): the
   * glance card gives the chart a row of its own, so it may stretch to it.
   * Default off - the dossier's vitals keep the v2 proportions.
   */
  stretch?: boolean;
}

const WIDTH = 120;
const HEIGHT = 32;
const PAD = 4;

/**
 * A dependency-light rank chart (research R4): x is the point index, so a burst
 * of updates stays readable, and y is inverted because a lower rank number is a
 * better rank. Zero points renders nothing - the dossier prints "Unranked".
 */
export function RankSparkline({ series, stretch = false }: RankSparklineProps) {
  const { points, current, best } = series;
  if (points.length === 0 || current === null || best === null) return null;

  const ranks = points.map((point) => point.rank);
  const worst = Math.max(...ranks);
  const span = worst - best;
  const last = points.length - 1;
  const bestIndex = ranks.indexOf(best);

  const x = (index: number) =>
    points.length === 1 ? WIDTH / 2 : PAD + (index * (WIDTH - 2 * PAD)) / last;
  // best → top, worst → bottom; a flat series sits on the middle line.
  const y = (rank: number) =>
    span === 0 ? HEIGHT / 2 : PAD + ((rank - best) * (HEIGHT - 2 * PAD)) / span;

  const line = points.map((point, index) => `${x(index)},${y(point.rank)}`).join(' ');

  return (
    <svg
      className={stretch ? `${styles.sparkline} ${styles.sparklineStretch}` : styles.sparkline}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      /*
       * An SVG root clips to its viewBox, and the end dot sits PAD from the
       * right edge with a radius that outgrows PAD as soon as `stretch` scales
       * the box up - so the current-rank dot rendered sliced (T330 visual
       * review). Painting outside the box keeps every dot whole and leaves the
       * record's unstretched chart exactly as it was.
       */
      overflow="visible"
      preserveAspectRatio={stretch ? 'none' : undefined}
      role="img"
      aria-label={copy.sparklineSummary(points[0].rank, current, points.length, best)}
      data-testid="rank-sparkline"
      focusable="false"
    >
      {/*
        A hairline floor, so a single point or a flat run still reads as a chart
        rather than a stray dot (T131 visual review). Decorative: the summary in
        `aria-label` already carries the whole series.
      */}
      <line
        className={styles.sparkBaseline}
        x1={0}
        y1={HEIGHT - 0.5}
        x2={WIDTH}
        y2={HEIGHT - 0.5}
        data-testid="sparkline-baseline"
      />
      {points.length > 1 ? (
        <polyline
          points={line}
          fill="none"
          stroke="var(--brand-line)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <circle
        cx={x(bestIndex)}
        cy={y(best)}
        r={4}
        fill="none"
        stroke="var(--marker-levelup)"
        strokeWidth={1.5}
        data-testid="sparkline-best"
      />
      <circle
        cx={x(last)}
        cy={y(points[last].rank)}
        r={3}
        fill="var(--brand-line)"
        data-testid="sparkline-current"
      />
    </svg>
  );
}

export default RankSparkline;

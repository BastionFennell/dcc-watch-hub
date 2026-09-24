/**
 * The live line (011 §5): "Level 2 · 4/6 HB · Floor 1", read from the
 * build-time `status.json` and never computed at runtime. A crawler with no
 * episode data has no status, and the caller renders nothing.
 */
import type { CrawlerStatus } from '../../data/types';
import { siteCopy } from '../copy';
import styles from './StatusLine.module.css';

export interface StatusLineProps {
  status: CrawlerStatus;
}

export function StatusLine({ status }: StatusLineProps) {
  return (
    <p className={styles.line} data-testid="status-line">
      {siteCopy.statusLine(status.level, status.hp.current, status.hp.max, status.floor)}
    </p>
  );
}

export default StatusLine;

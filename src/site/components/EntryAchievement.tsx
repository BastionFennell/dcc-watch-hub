/**
 * The entry achievement, as the System awarding it (011 R2).
 *
 * It borrows the hub's `AchievementToast` on purpose - System-blue panel,
 * hairline frame, mono kicker, trophy glyph, the title large, the verbatim text
 * under it - because a viewer who has watched an episode has seen this exact
 * object slide in over the stage. It is the one System-styled element on the
 * front door's crawler page, which is what keeps it meaning something.
 *
 * It is a copy of the toast's *look*, never the toast itself: the toast is a
 * hub overlay with a 6 s window, a queue and a fade-in, and none of that has
 * any business on a static page. Nothing here animates.
 */
import type { CrawlerEntryAchievement } from '../../data/types';
import { IconRank } from '../../components/icons';
import { siteCopy } from '../copy';
import styles from './EntryAchievement.module.css';

export interface EntryAchievementProps {
  achievement: CrawlerEntryAchievement;
}

/** "Reward: Golden Monster Box → Liquid Latex", or whichever half exists. */
function payout({ box, item }: CrawlerEntryAchievement): string | null {
  if (box !== undefined && item !== undefined) return siteCopy.reward(box, item);
  if (box !== undefined) return siteCopy.rewardBox(box);
  if (item !== undefined) return siteCopy.rewardItem(item);
  return null;
}

export function EntryAchievement({ achievement }: EntryAchievementProps) {
  const line = payout(achievement);

  return (
    <div className={styles.frame} data-testid="entry-achievement">
      <p className={styles.kicker}>
        <IconRank className={styles.glyph} />
        <span>{siteCopy.achievementKicker}</span>
      </p>
      <p className={styles.title}>{achievement.title}</p>
      <p className={styles.text}>{achievement.text}</p>
      {line === null ? null : <p className={styles.payout}>{line}</p>}
      {achievement.reward === undefined ? null : (
        <p className={styles.rewardText}>{achievement.reward}</p>
      )}
    </div>
  );
}

export default EntryAchievement;

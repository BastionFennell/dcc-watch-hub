/**
 * `/_og/crawler/:id` - the crawler share image (011 §4).
 *
 * Nothing but the roster card's third render. That is the whole point of the
 * component: a fan who shares a crawler link gets the same object they saw on
 * the page, not a second design that drifts from it.
 */
import { useParams } from 'react-router';
import { useCrawlers } from '../../../data/CrawlersContext';
import { RosterCard } from '../../components/RosterCard';
import { OgFrame } from './OgFrame';

export function OgCrawlerPage() {
  const { id = '' } = useParams();
  const { profiles } = useCrawlers();
  const profile = profiles.find((candidate) => candidate.id === id);

  // No frame element means "skip this shot" to scripts/og.mjs, which is exactly
  // what an unknown id should do: no picture is better than a picture of an error.
  if (profile === undefined) return null;

  return (
    <OgFrame>
      <RosterCard profile={profile} variant="og" hook={profile.concept} />
    </OgFrame>
  );
}

export default OgCrawlerPage;

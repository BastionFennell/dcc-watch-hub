/**
 * The head for a hub route (011 T1126): the episode page, the Codex and the
 * 404 get the same `<Seo>` the front door uses, so a `/ep/3` link shared into a
 * chat previews like a `/crawlers/mimi` one.
 *
 * It is a lazy chunk, and that is deliberate. Hub routes are client-rendered -
 * their head was already written after mount, by the effect this replaces - so
 * a tick's delay costs nothing, while `<Seo>` and the JSON-LD builders sitting
 * in the viewer's entry chunk would cost every viewer about 2.5 kB they only
 * need for a link preview. `src/site/pages/lazy.tsx` explains the two-state
 * wrapper; the prerenderer preloads this one along with the pages.
 */
import type { EpisodeMeta } from '../data/types';
import { Seo } from './seo';
import { episodeJsonLd } from './jsonLd';
import { episodeOgImage } from './media';
import { metaCopy } from './meta';
import { copy } from '../copy';

export type HubHeadProps =
  | { kind: 'episode'; episode: EpisodeMeta }
  | { kind: 'codex' }
  | { kind: 'notFound'; path: string };

export function HubHead(props: HubHeadProps) {
  if (props.kind === 'episode') {
    const { episode } = props;
    return (
      <Seo
        title={copy.hubPageTitle(episode.title)}
        description={
          episode.summary === undefined || episode.summary === ''
            ? metaCopy.defaultDescription
            : episode.summary
        }
        canonicalPath={`/ep/${episode.id}`}
        ogImage={episodeOgImage(episode)}
        /* The page is a video with an overlay, not a video page on YouTube. */
        ogType="video.other"
        jsonLd={episodeJsonLd(episode)}
      />
    );
  }

  if (props.kind === 'codex') {
    return (
      <Seo
        title={copy.pageTitle(copy.registryTitle)}
        description={copy.registryLead}
        canonicalPath="/codex"
      />
    );
  }

  return (
    <Seo
      title={metaCopy.pageTitle(metaCopy.notFoundTitle)}
      description={copy.notFoundBody}
      canonicalPath={props.path}
      /* A static host answers every unknown path with the 404; none of them
         should be kept, and none of them should self-canonicalize. */
      noindex
    />
  );
}

export default HubHead;

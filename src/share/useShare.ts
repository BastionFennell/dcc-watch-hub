/**
 * The share action's viewer-facing state (004 US2, FR-302/304, research R5).
 *
 * This is a transient viewer notice, not overlay state: a short timer is
 * explicitly allowed for it (spec Assumptions), and nothing here is derived
 * from the event log, so constitution I is untouched. Playback is never
 * touched either (FR-306) - the hook is handed a second and hands back a link.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '../engine/time';
import { copy } from '../copy';
import type { DeliverResult, ShareEnv } from './share';
import { deliver, momentUrl } from './share';

/** How long a confirmation stands before it clears itself. */
export const SHARE_NOTICE_MS = 2_000;

export type ShareStatus = 'idle' | 'copied' | 'shared' | 'shown';

export interface ShareApi {
  /** Mark the moment at `t`: build the link, deliver it, confirm. */
  share(t: number): Promise<void>;
  status: ShareStatus;
  /** The link the last share produced, or null while idle. */
  url: string | null;
  dismiss(): void;
}

export interface UseShareArgs {
  episodeId: number;
  /** Used for the native share sheet's title (`shareTitle`). */
  episodeTitle: string;
  /** Test seam: the platform capabilities `deliver` should use. */
  env?: ShareEnv;
}

interface ShareState {
  status: ShareStatus;
  url: string | null;
}

const IDLE: ShareState = { status: 'idle', url: null };

export function useShare({ episodeId, episodeTitle, env }: UseShareArgs): ShareApi {
  const [state, setState] = useState<ShareState>(IDLE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // A share in flight when the page goes away must not set state afterwards.
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const dismiss = useCallback(() => {
    clearTimer();
    setState(IDLE);
  }, [clearTimer]);

  const share = useCallback(
    async (t: number) => {
      const url = momentUrl({
        origin: window.location.origin,
        base: import.meta.env.BASE_URL,
        episodeId,
        t,
      });
      const title = copy.shareTitle(episodeTitle, formatTime(Math.max(0, Math.floor(t))));

      let result: DeliverResult;
      try {
        result = await deliver(url, title, env);
      } catch {
        // `deliver` is total, but a stubbed env in a future caller may not be.
        result = 'shown';
      }
      if (!liveRef.current) return;

      // A new share supersedes whatever the last one was still saying.
      clearTimer();

      if (result === 'cancelled') {
        // The viewer dismissed the share sheet: the System says nothing.
        setState(IDLE);
        return;
      }

      setState({ status: result, url });

      // A copy or a native share is self-evident, so the confirmation clears
      // itself. The fallback notice carries the only copy of the link the
      // viewer has, so it stands until it is dismissed (FR-304).
      if (result === 'shown') return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setState(IDLE);
      }, SHARE_NOTICE_MS);
    },
    [episodeId, episodeTitle, env, clearTimer],
  );

  return { share, status: state.status, url: state.url, dismiss };
}

export default useShare;

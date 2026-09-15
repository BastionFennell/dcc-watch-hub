/**
 * Idempotent loader for the YouTube IFrame Player API (research R4).
 *
 * This file and `YouTubeTimeSource.ts` are the ONLY modules allowed to reference
 * the `YT` global or `onYouTubeIframeAPIReady` (constitution II, enforced by the
 * `no-restricted-globals` rule in eslint.config.js).
 */

/** The global `YT` namespace object, once the API script has run. */
export type YouTubeApi = typeof YT;

interface YouTubeWindow {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
}

const SCRIPT_SRC = 'https://www.youtube.com/iframe_api';
const TIMEOUT_MS = 15_000;

let pending: Promise<YouTubeApi> | null = null;

function ytWindow(): YouTubeWindow {
  return window as unknown as YouTubeWindow;
}

function ready(api: YouTubeApi | undefined): api is YouTubeApi {
  return typeof api?.Player === 'function';
}

/**
 * Injects the API script once and resolves with the `YT` namespace. Repeated
 * calls share one promise; a failure clears it so a later call can retry.
 */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (pending) return pending;

  const w = ytWindow();
  if (ready(w.YT)) {
    pending = Promise.resolve(w.YT);
    return pending;
  }

  pending = new Promise<YouTubeApi>((resolve, reject) => {
    let settled = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pending = null;
      reject(new Error(message));
    };

    const timer = setTimeout(() => fail(`The YouTube player API did not load within ${TIMEOUT_MS} ms.`), TIMEOUT_MS);

    // Chain any callback a host page (or a second loader) already installed.
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (settled) return;
      const api = ytWindow().YT;
      if (!ready(api)) {
        fail('The YouTube player API loaded without a Player constructor.');
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(api);
    };

    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => fail(`Could not load ${SCRIPT_SRC}.`);
    (document.head ?? document.body).appendChild(script);
  });

  return pending;
}

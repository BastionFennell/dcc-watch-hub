/**
 * Video id extraction for the Studio's "new episode" form (010, FR-1000).
 *
 * The author pastes whatever the browser gave them - a watch URL with a
 * playlist and a timestamp, a share link, an embed snippet's src, or the bare
 * id. Only the id reaches `show.json`.
 *
 * Constitution II: this file is named for the host, so it is allowed to know
 * YouTube's URL shapes. It touches no API and no global - it is pure string
 * work, which is why it lives here rather than inside the adapter.
 */

/** YouTube ids are eleven characters of the URL-safe base64 alphabet. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

/** `/embed/ID`, `/shorts/ID`, `/live/ID`, and the legacy `/v/ID`. */
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v'];

function idOrNull(candidate: string | null | undefined): string | null {
  return typeof candidate === 'string' && ID_RE.test(candidate) ? candidate : null;
}

/**
 * The video id in `input`, or `null` when there is none.
 *
 * Accepts a bare id, `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`
 * and `/v/`, with any extra query parameters, on http, https, or no scheme at
 * all. Anything else - another host, a channel URL, a playlist-only URL - is
 * `null` rather than a guess.
 */
export function parseYouTubeId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // The common case: the author pasted the id itself.
  const bare = idOrNull(trimmed);
  if (bare !== null) return bare;

  // `new URL` needs a scheme; "youtu.be/x" and "//youtu.be/x" are both common.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/\//, '')}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split('/').filter((segment) => segment !== '');

  // youtu.be/ID - the whole path is the id.
  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    return idOrNull(segments[0]);
  }

  if (segments.length === 0 || segments[0] === 'watch') {
    return idOrNull(url.searchParams.get('v'));
  }

  if (PATH_PREFIXES.includes(segments[0])) {
    return idOrNull(segments[1]);
  }

  // Some share links look like /shorts/ID/ or /embed/ID?start=30 handled above;
  // everything else (channels, playlists, results) has no single video.
  return null;
}

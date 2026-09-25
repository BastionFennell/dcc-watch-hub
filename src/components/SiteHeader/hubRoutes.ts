/**
 * Which routes are the hub, and which are the front door (011 §1).
 *
 * The header is one piece of chrome across both, but the hub's own controls -
 * the episode-context slot, the Codex link and the show channels - only make
 * sense while a viewer is inside the broadcast. Off those routes they are
 * clutter on a page whose job is to convert a stranger.
 */
const HUB_ROUTE = /^\/(?:ep(?:\/|$)|codex(?:\/|$)|registry(?:\/|$)|studio(?:\/|$))/;

export function isHubRoute(pathname: string): boolean {
  return HUB_ROUTE.test(pathname);
}

import '@testing-library/jest-dom/vitest';
import { preloadSitePages } from '../site/pages/preload';

/*
 * 011: the front door's pages - and the hub's `<HubHead>` - are `React.lazy`
 * chunks in a browser, and plain modules on disk here. Resolving them once, up
 * front, is what the prerenderer does too (`src/entry-server.tsx`): every
 * render in a test is then synchronous, so a hub test can never race the
 * import's commit, and a marketing test asserts markup rather than a fallback.
 */
await preloadSitePages();

# Contract: Routes and static hosting

| Path | Page | Data |
|------|------|------|
| `/` | HubPage — "Broadcast archive" grouped by floor | show.json |
| `/ep/:id` | EpisodePage | show.json + episode `dataUrl` |
| `*` | NotFoundPage (System voice) | show.json (for header) |

- `:id` is the integer `EpisodeMeta.id`. Non-integer or unknown → NotFoundPage with a link to `/`.
- All links are `<Link>`s relative to `basename = import.meta.env.BASE_URL`.
- `dataUrl` values beginning with `/` are resolved against `BASE_URL` at fetch time.
- Static-host fallback: `dist/404.html` is a copy of `dist/index.html` (GitHub Pages);
  `public/_redirects` = `/* /index.html 200` (Netlify, Cloudflare Pages).
- Dev only: `/ep/:id?fake=1` swaps the YouTube stage for the fake scrubber stage.

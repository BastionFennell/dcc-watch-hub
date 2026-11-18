# Quickstart - 014 cast page

## See it
```
npm run dev            # http://localhost:5173/cast , /cast#madio , /crawlers/ronald
npm run build && npm run preview   # the prerendered page; view source: bios are in the HTML
```

## Check it
```
npm run typecheck && npm run lint && npm test
npm run lint:cast      # the cast lint on its own
```
By hand, at 375 px and 1440 px:
1. Nav shows Watch / Crawlers / Cast / Community on one line; no sideways scroll on any page.
2. `/cast`: five cards, Lulu, Madio, Danny, Sarah, Bastion. Lulu and Bastion show photo, name,
   role, pronouns and nothing else.
3. Madio's, Sarah's (two paragraphs) and Danny's bios match spec FR-014 word for word.
4. "Plays Ronald Hudson" goes to `/crawlers/ronald`; "The System AI" is plain text.
5. Link pills: Madio "Links", Danny "Links", Sarah "Instagram"; each opens in a new tab.
6. Load `/cast#sarah` cold: Sarah's card is under the header, not behind it. Same from
   `/crawlers/veil` by clicking the name in "Played by Sarah".
7. Each crawler page: small headshot + "Played by {name}"; no pronouns/bio line, no link row.
8. Disable JavaScript, reload `/cast` and `/cast#danny`: content and anchor still work.
9. `ls -l public/img/cast`: each `<id>.webp` <= 45 kB, each `<id>-sm.webp` <= 8 kB.

## Change the content later (no code)
Edit `public/data/cast.json`:
- **A bio**: put each paragraph in the member's `bio` array.
- **A link**: add `{ "kind": "instagram", "url": "https://..." }` to `links`. Kinds: `youtube`,
  `discord`, `tiktok`, `bluesky`, `instagram`, `linktree`, `beacons`, or `links` for any other link hub or personal site.
- **Order**: reorder the array.
- **A photo**: replace `public/img/cast/<id>.webp` (480x480) and `<id>-sm.webp` (96x96).

Then `npm test` (the lint tells you what is wrong, by member id) and rebuild.

## Prove the lint bites
Temporarily set Madio's `crawlerId` to `"harry"`: `npm run lint:cast` must fail naming `madio`
and the unknown crawler, and also report that `ronald` has no player. Revert.

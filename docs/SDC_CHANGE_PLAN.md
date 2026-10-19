# Sleepy Dogs Club change plan

Baseline commit: `0fd1198` on `main`. Work continues on `feature/sleepy-dogs-club-refinement`.

## Keep

Entrance overlay, park and nap videos, notebook, nap timer, corkboard lightbox, nap.fm playback (same localStorage volume key), CA-coming-soon behavior, analytics origin, static export, and GitHub Pages base path `/EPYDOG`.

## Change

- Copy `public/sdc/` from the refinement pack. Do not replace existing media.
- `config/site.ts`: Sleepy Dogs Club / ZZZPUPS, new logo path, community copy, blank contract.
- Visible text in `components/EepyExperience.tsx`, sample-gallery labels, a gallery link, and a “photo uploads coming soon” note with a working gallery button.
- `app/layout.tsx` title, description, favicon, and social image, using `asset()` so `/EPYDOG` is included.
- Public tracker: refuse to boot with a missing or `aaaa` password when `TRUST_PROXY=1`. Local tracker still falls back to `aaaa`. Do not rotate the password already stored for the running dashboard.

## Leave alone

`next.config.ts`, the analytics hostname, media filenames, and the upload backend. No public photo uploader until storage and moderation exist.

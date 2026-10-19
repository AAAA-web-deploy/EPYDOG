# Sleepy Dogs Club change report

Branch: `feature/sleepy-dogs-club-refinement` from `0fd1198`.

## What changed

- Added `public/sdc/` (logo, favicons, illustrated pack art, social images, icons, gallery illustrations).
- `config/site.ts` now names the project Sleepy Dogs Club, ticker ZZZPUPS, on Ethereum mainnet. `contractAddress` is still blank.
- Visible entrance, header, notebook, nap, gallery, radio, and footer copy now use the club voice. The player label is nap.fm. The volume storage key is still `eepy-fm-volume`.
- A gallery link and “Explore the Nap Gallery” scroll to the existing corkboard. Uploads say “Photo uploads coming soon” and do not pretend to save a photo.
- Existing park video, nap video, seven sample photos, and demo tracks stay in place and are labeled as samples, not club submissions.
- Metadata uses the new title, description, favicon, and Open Graph image through `asset()`.
- A public tracker (`TRUST_PROXY=1`) will not boot with a missing password or the old `aaaa` default. Local development still falls back to `aaaa`.

## What stayed

Entrance click-to-enter, hero and nap video, notebook, nap timer, corkboard lightbox (Escape and arrows), nap.fm controls, CA-not-set behavior, analytics host, static export, and the `/EPYDOG` Pages path.

## Checks

- `npm run check:assets`: 26 files, complete.
- `npm run typecheck`: passed.
- `npm run lint`: passed with the two existing anonymous-export warnings.
- `npm run tracker:test`: 15/15 passed, including the new public-password test.
- `npm run build`: static export succeeded.
- Browser check on the local export: entered the site, audio started after the click, gallery scroll reached the corkboard, a photo opened and Escape closed it, the CA control still says the address is not configured, and a 390px layout did not overflow. Header brand and the corner buttons did not overlap.

Screenshots: `docs/sdc-before/` and `docs/sdc-after/`.

## Still open

- No public photo uploader. GitHub Pages cannot store submissions.
- Park video, nap video, sample photos, and demo music are still the earlier media. Confirm you have rights before a commercial launch.
- The live dashboard password is still the existing one until you change it. The next public tracker start will refuse `aaaa`.

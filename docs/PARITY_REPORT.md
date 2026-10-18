# Visual parity report

Compared with https://eepydog.com/ on 18 October 2026 in the Cursor browser, then checked the local static build at http://127.0.0.1:4183/.

## Screenshots tested

Reference site, before and after the entrance gate, plus notebook, nap spot, and corkboard.

Local build at the same browser size (about 1179 × 914) for the entrance, hero, notebook, and corkboard. A 375 × 812 check confirmed the page does not scroll sideways. The visitor dashboard login was opened at `/dashboard/`.

## Features implemented

- Cement-framed park video on a fixed city backdrop, with a pixel “click to enter” gate
- Corner plank controls for X, community, and contract copy
- Lined notebook, taped hike photo, and strikethrough “stuff nap” line
- Nap video, floating Zs, and a sticky note whose timer starts at 4h 12m
- Seven pinned corkboard photos with a viewer (close, backdrop, Escape, previous, next)
- Corner Eepy FM radio: play/pause, song list, volume, mute, and next track when a song ends
- Demonstration audio is labeled as demonstration audio
- Ethereum contract, logo, and links come from `config/site.ts`
- Empty contract shows “CA coming soon”; Uniswap and Etherscan stay inactive until a real `0x` address is set
- Footer states this is an independent Ethereum project
- Password-protected visitor dashboard at `/dashboard/` (password `aaaa`), matching the Bye Buy tracker: page views, heartbeats, sections, clicks, New York ranges, referrals, campaigns, visit history, IP reveal, CSV export, and password change
- Do Not Track and Global Privacy Control are not recorded

## Differences corrected

The first packaged page used a full-screen editorial layout (large wordmark, notebook soundtrack card, full-width player). The live reference is a sky page with a monitor frame, Pixelify Sans and Patrick Hand, plank buttons, and a small corner radio. The page was rebuilt to that structure, and the corkboard captions were aligned with the live labels.

## Remaining visual mismatches

- `city-tall.jpg` and `cement.png` are generated stand-ins. The sky is softer and the monitor frame is darker than the live site.
- The four songs are synthesized demonstration tracks, not the original Eepy FM recordings.
- X and community are not linked to the Solana project’s accounts. They stay pending until `xUrl` and `communityUrl` are set in `config/site.ts`.
- The contract pill says “CA coming soon” instead of showing the Solana address. That address is intentionally absent.
- Footer adds Uniswap, Etherscan, the independent-project disclosure, and a replaceable logo. Those are not on the reference header.
- Falling leaves are a simple original canvas, not the reference’s particle script.
- At short viewports the fixed radio can sit over the bottom of a photo until the page is scrolled.

## Build and test results

- `npm run check:assets`: 20/20 files present
- `npm run typecheck`: passed
- `npm run lint`: passed with two existing anonymous-export warnings
- `npm run tracker:test`: 14/14 passed
- `npm run build`: static export succeeded
- Dashboard login with `aaaa` returned HTTP 200; a wrong password returned HTTP 401
- No Solana contract address is present in the exported HTML

## Browser limits

GitHub Pages only serves the static site. Visitor counts are stored by `npm run tracker`, which serves `out/` and the API together. People who send Do Not Track or Global Privacy Control are skipped. Localhost traffic is classified as development and is hidden from the default dashboard range.

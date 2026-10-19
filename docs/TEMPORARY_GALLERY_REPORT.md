# Temporary nap gallery

The public page now shows a browser-only trial. A visitor can pick a sleeping-dog photo, see it immediately, and download it. Nothing is sent to a server. Nothing is stored for the next visit.

This has not been committed, pushed, or deployed. https://aaaa-web-deploy.github.io/EPYDOG/ still serves the previous build until you approve a deploy.

## What works in the browser

- **Add Your Sleeping Dog** opens a form from the hero and from the gallery. The form asks for a photo, a dog name, and an optional caption.
- JPG, PNG, and WebP are accepted. GIF files and photos smaller than 150 × 150 pixels are refused. Source files over 8 MB are refused.
- The visitor can pick a file, including from a phone camera roll, or drop one on the form. A preview appears before the photo is added.
- The browser draws the photo onto a canvas and saves a JPEG. The longest side is capped at 1400 pixels. That export drops the original camera metadata, including location text.
- **Add to Gallery** shows the photo at once with its name and caption. Up to 12 photos can sit in the tab. A 13th is refused until one is removed.
- **Download Photo** saves a JPEG named like `sleepy-dog-mochi-a4349eef.jpg`. The saved file opens as an image.
- The seven scrapbook photos still download as `sleepy-dog-scrapbook-1.jpg` through `sleepy-dog-scrapbook-7.jpg`. On GitHub Pages those files are requested through the existing `/EPYDOG/` asset prefix. The local preview build uses `/memes/01.jpg` because `NEXT_PUBLIC_BASE_PATH` is empty there.
- Removing a photo drops it from the screen and releases its blob URL. Leaving the page releases the rest.
- Entrance animation, notebook, corkboard, both videos, music, and gallery navigation still work. There is no account, wallet, or token-purchase step.

Checked locally on http://127.0.0.1:4321/: desktop flow above, a 390px-wide layout with no sideways overflow, refresh clearing the trial photos, `npm run typecheck`, `npm run lint` (the two existing config warnings only), `npm run check:assets` (26/26), and `npm run build`.

## What is temporary

Photos live in React state as blob URLs. They disappear when the visitor refreshes or closes the tab. The page says so under **Your Temporary Nap Gallery**:

> Photos added here are visible only in your browser and disappear when you leave or refresh. This is a trial feature.

Music volume can still use `localStorage`. Photo bytes do not.

## What is not shared

Each visitor sees only the photos they added in that tab, plus the seven original scrapbook pictures. Another visitor, another browser, or another device does not receive them. The success text says only that visitor can see the photo.

The old “Storage is not connected” line is gone, because this trial does not use storage.

## What a real community gallery would need

Shared uploads need the Cloudflare path that is still in the repo and is not wired to this trial screen:

1. Keep `services/photo-worker/` and the private R2 bucket `sleepy-dogs-photos`.
2. Set the Worker secrets for Turnstile and the moderation token. Do not put those secrets in the browser.
3. Set the GitHub Actions variables `NEXT_PUBLIC_GALLERY_API_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, then rebuild. Changing the variables without a rebuild does not update the static site.
4. Put the archived client back: `archive/cloudflare-gallery/sdcGallery.ts` and `SdcCommunityGallery.tsx`, together. The archive README says to copy both files back at once.
5. Approve photos with `services/photo-worker/scripts/moderate.mjs` before they appear for other people.

That path was exercised here only against a local stand-in for R2 (`npm run test:photos`, 5/5). It has not been run against a real Cloudflare account, and `wrangler dev` still cannot start on this machine. Setup notes remain in `docs/CLOUDFLARE_NO_DATABASE_SETUP.md`.

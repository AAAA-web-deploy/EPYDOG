# Photo uploads without a database

Branch: `fix/real-photo-uploads` (from `feat/cloudflare-r2-photos`). Not pushed. Not deployed.

There is no database. Photos are files in a private Cloudflare R2 bucket. Names, captions, consent, and dates are stored once, in each object's metadata. The public site stays on GitHub Pages.

## What is already implemented

The existing Worker in `services/photo-worker/` is the photo system. It was not replaced.

| Piece | Where |
| --- | --- |
| Upload, list, image, download, report, and owner routes | `services/photo-worker/src/index.js` |
| JPEG, PNG, and WebP signature checks and metadata stripping | `services/photo-worker/src/images.js` |
| Pending, approved, and rejected keys, plus quota objects | `services/photo-worker/src/store.js` |
| Turnstile check on the Worker | `services/photo-worker/src/turnstile.js` |
| Owner commands | `services/photo-worker/scripts/moderate.mjs` |
| Browser form, gallery, and scrapbook downloads | `components/SdcCommunityGallery.tsx`, `lib/sdcGallery.ts` |

Object layout:

```text
pending/<uuid>.jpg
approved/<uuid>.jpg
rejected/<uuid>.jpg
reports/<uuid>.json
ratelimit/upload/<hash>/<date>
```

A direct PNG or WebP upload keeps that real extension. The website converts a chosen photo to JPEG before sending it. Pending and rejected objects are not served by the public routes. Approval copies the file to `approved/`, checks the stored size, and only then deletes the pending object. A failed approval deletes the approved copy and leaves the photo private.

The moderation token is read from the terminal environment by `moderate.mjs`. It is not in the Next.js source or the static build.

## What changed in this pass

- **Upload Photo** always opens the form: file picker, drag-and-drop, preview, dog name, optional nickname, caption, consent, and submit.
- If the Cloudflare address or Turnstile site key is missing, the form says so. Submit shows an error and does not show the success sentence.
- The success sentence is shown only after the Worker returns `stored: true`.
- A progress bar appears while an upload is sending.
- The gallery asks the Worker for the next page when more than 24 approved photos exist.
- Each stored photo records `downloadAllowed: true` in the same metadata object as the consent flag. There is no second metadata file.

## Tested locally

`npm run test:photos` passed 5 tests against the Worker with a file-backed R2 stand-in, not a Cloudflare account:

- GIF and other non-images are rejected.
- Missing consent, a bad Turnstile token, a foreign website origin, and a fourth upload from the same visitor are rejected.
- A pending photo returns 404 for viewing and downloading.
- Approval without the owner token returns 401.
- After approval, the photo is listed newest first, downloads as `sleepy-dog-<id>.jpg`, and starts with JPEG bytes `FF D8`.
- Injected EXIF text is absent from the stored file.
- A report is stored only for an approved photo.
- Opening a new storage handle still finds the approved file. Removing it makes the public URL 404 again.
- Page two of the gallery does not include a photo that is still pending.

`npm run typecheck`, `npm run lint`, `npm run check:assets` (26 files), and `npm run build` passed. Lint still reports the two existing warnings in `eslint.config.mjs` and `postcss.config.mjs`.

Browser check on the local preview, which has no Cloudflare address:

- Entrance, both videos, and the music player are still present.
- **Upload Photo** opens the form.
- A GIF is rejected with “Please choose a JPG, PNG, or WebP image.”
- Choosing `memes/01.jpg` shows a blob preview.
- Submit says the photo was not sent because there is no Cloudflare gallery address. The success sentence does not appear.
- All seven scrapbook buttons save `sleepy-dog-scrapbook-1.jpg` through `sleepy-dog-scrapbook-7.jpg`. The save step rejects a download that is not an image.
- At a 390px width the page does not scroll sideways.

## Not tested against Cloudflare

There is no `.env.local`, no `services/photo-worker/.dev.vars`, and no R2 bucket connected from this workspace. These were **not** done:

- A real upload into Cloudflare R2
- A real Turnstile widget
- `wrangler dev` or `wrangler deploy`
- A public GitHub Pages build that includes the gallery address

Do not treat the local file-backed tests as a production upload.

## What you need to do

Do not paste the Turnstile secret or the moderation token into chat.

1. Create a private R2 bucket named `sleepy-dogs-photos`. Leave its public URL off.
2. Deploy the Worker: `npx wrangler deploy --config services/photo-worker/wrangler.toml`
3. Create a Turnstile widget for `aaaa-web-deploy.github.io`.
4. Set Worker secrets `TURNSTILE_SECRET_KEY` and `MODERATION_TOKEN` with `npx wrangler secret put`.
5. In GitHub Actions variables, set `NEXT_PUBLIC_GALLERY_API_URL` to the Worker URL and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the site key.
6. Approve a push so GitHub Pages rebuilds. Changing the variables without a rebuild does not update the static site.

Full commands, CORS, costs, and the approve/reject/remove commands are in `docs/CLOUDFLARE_NO_DATABASE_SETUP.md`.

After that deploy, a visitor can submit a photo, you can run `moderate.mjs approve <id>`, and the next gallery refresh shows it. No further site deploy is required for each approval.

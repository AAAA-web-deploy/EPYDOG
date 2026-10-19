# Cloudflare photo storage without a database

Sleepy Dogs Club stores community photos as objects in a private Cloudflare R2 bucket. A Cloudflare Worker is the only API. Dog names, captions, consent, and dates live in object metadata. Pending, approved, rejected, and report objects are separate key prefixes. Nothing in this design uses PostgreSQL, MySQL, SQLite, D1, Firebase, or Supabase.

The website on GitHub Pages does not receive storage keys or the owner token. Until you set the two public build values below and redeploy, the upload form explains that storage is not connected and does not claim a photo was saved. The seven scrapbook downloads do not use Cloudflare.

This repository does not contain a real Worker URL, Turnstile secret, or moderation token. Those are yours to create. Do not invent them.

## What you create

1. A Cloudflare account at https://dash.cloudflare.com/sign-up.
2. An R2 bucket named `sleepy-dogs-photos`. Leave the public development URL (`r2.dev`) disabled. Visitors must not list the bucket.
3. A Worker deployed from `services/photo-worker/`.
4. An R2 binding named `PHOTOS` on that Worker.
5. A Turnstile widget.
6. Two Worker secrets: `TURNSTILE_SECRET_KEY` and `MODERATION_TOKEN`.
7. Two GitHub Actions variables: `NEXT_PUBLIC_GALLERY_API_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

## 1. Create the bucket

In the Cloudflare dashboard open **R2 Object Storage → Create bucket**. Name it `sleepy-dogs-photos`. Choose a location close to your visitors. Do not enable public access. The Worker reads and writes the bucket through its binding, so you do not create an S3 access key for the website.

Object layout, created by the Worker as photos arrive:

```text
pending/<uuid>.jpg
approved/<uuid>.jpg
rejected/<uuid>.jpg
reports/<uuid>.json
ratelimit/upload/<hash>/<yyyy-mm-dd>
```

PNG and WebP uploads use `.png` or `.webp` instead of `.jpg` when that is the real file type. The normal browser path converts the photo to JPEG first. Each image object stores a `x-sdc-meta` metadata value with the photo id, dog name, optional nickname, caption, submission time, and a consent flag. Camera EXIF and GPS segments are removed before the object is saved. The rate-limit object stores a count and a hash, not the visitor’s raw IP address.

## 2. Deploy the Worker

From the repository root, with Wrangler installed by `npm ci`:

```bash
npx wrangler login
npx wrangler deploy --config services/photo-worker/wrangler.toml
```

Wrangler prints an address such as `https://sleepy-dogs-photos.<your-subdomain>.workers.dev`. That address is `GALLERY_API_URL` and, later, `NEXT_PUBLIC_GALLERY_API_URL`. Copy it from the deploy output. Do not guess it.

`wrangler.toml` already binds `PHOTOS` to bucket `sleepy-dogs-photos`. The first deploy creates the binding. If the bucket name differs, change `bucket_name` before deploying. Do not add a public bucket domain.

Confirm the binding in **Workers & Pages → sleepy-dogs-photos → Settings → Bindings**. It should list R2 bucket `PHOTOS` → `sleepy-dogs-photos`.

## 3. Create Turnstile

In **Turnstile → Add widget**:

- Widget name: `Sleepy Dogs Club`
- Hostnames: `aaaa-web-deploy.github.io` and, for a local trial, `127.0.0.1` and `localhost`
- Widget mode: Managed

Copy the **site key** and the **secret key**. The site key is public. The secret stays in the Worker.

## 4. Set Worker secrets

Generate a moderation token on your own machine, for example with `openssl rand -hex 32`. It must be at least 16 characters. Store it in a password manager. It is never a `NEXT_PUBLIC` value.

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --config services/photo-worker/wrangler.toml
npx wrangler secret put MODERATION_TOKEN --config services/photo-worker/wrangler.toml
```

Paste each value when prompted. Do not set `TURNSTILE_TEST_MODE` on the deployed Worker. That switch exists only so the offline test suite can imitate Cloudflare’s published dummy keys. A real secret always calls `https://challenges.cloudflare.com/turnstile/v0/siteverify`.

For a local Worker, copy `services/photo-worker/.dev.vars.example` to `services/photo-worker/.dev.vars` and fill the same two secrets. `.dev.vars` is gitignored.

## 5. CORS

The Worker allows browser calls only from origins in `ALLOWED_ORIGINS`. The deployed default is:

```text
https://aaaa-web-deploy.github.io
```

A browser page on any other origin receives HTTP 403. Requests with no `Origin` header, such as the moderation command, are still checked for the owner token on admin routes. CORS is not treated as the security boundary: pending and rejected objects are never served by the public routes, and admin routes require `Authorization: Bearer <MODERATION_TOKEN>`.

To call the Worker from a local preview, add the preview origin and redeploy:

```bash
npx wrangler secret put ALLOWED_ORIGINS --config services/photo-worker/wrangler.toml
```

Wrangler vars and secrets share a namespace. If `ALLOWED_ORIGINS` is already a var in `wrangler.toml`, edit that line instead of putting a secret, then deploy again. Example for a local trial only:

```toml
ALLOWED_ORIGINS = "https://aaaa-web-deploy.github.io,http://127.0.0.1:4321"
```

Remove the localhost origin before you announce the gallery if you do not want a page on your own computer to be an allowed caller. A missing origin is still blocked from publishing a photo by Turnstile and the upload quota.

## 6. GitHub Actions variables

In the GitHub repository **Settings → Secrets and variables → Actions → Variables**, add:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_GALLERY_API_URL` | The Worker URL from `wrangler deploy`, with no trailing slash |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | The Turnstile site key |

Do not put `TURNSTILE_SECRET_KEY` or `MODERATION_TOKEN` in GitHub. The Pages workflow in `.github/workflows/pages.yml` reads only the two public variables at build time. Changing them does nothing until a new static export is built and deployed.

For a local site build, copy `.env.gallery.example` to `.env.local` and set the same two public values. Leave `NEXT_PUBLIC_BASE_PATH` empty for `http://127.0.0.1`.

## 7. Rebuild the website

This branch is not deployed. After you approve a push to `main`, GitHub Actions runs `npm run build` with `/EPYDOG` as the base path and publishes `out/`. Until then you can preview locally:

```bash
npm run build
npx wrangler dev --config services/photo-worker/wrangler.toml --port 8787
```

Point `.env.local` at `http://127.0.0.1:8787`, rebuild, and open the static preview. Local `wrangler dev` uses a local R2 simulation unless you pass `--remote`.

## 8. Moderate photos

Pending photos are private. Review and publish them with the command-line tool from the repository root:

```bash
# Windows PowerShell
$env:GALLERY_API_URL = "https://sleepy-dogs-photos.<your-subdomain>.workers.dev"
$env:MODERATION_TOKEN = "<your token>"

node services/photo-worker/scripts/moderate.mjs pending
node services/photo-worker/scripts/moderate.mjs file <uuid> review.jpg
node services/photo-worker/scripts/moderate.mjs approve <uuid>
node services/photo-worker/scripts/moderate.mjs reject <uuid>
node services/photo-worker/scripts/moderate.mjs remove <uuid>
node services/photo-worker/scripts/moderate.mjs reports
```

`approve` copies `pending/<id>` to `approved/<id>`, checks that the approved object exists and has the same size, then deletes the pending object. If that check fails, it deletes the approved copy and leaves the photo private. `reject` moves a pending object to `rejected/`. `remove` moves an approved object to `rejected/`, after which the public gallery and download routes return 404. `reports` lists removal requests stored as JSON under `reports/`.

Cloudflare Access in front of `/api/admin/*` is a good second lock. Put Access on a route you control, and keep requiring the bearer token inside the Worker. Do not add an approve button to the Next.js page.

## 9. Test a real upload

1. Open the deployed site, pass the entrance, and click **Upload Photo**.
2. Choose a JPG, PNG, or WebP of a sleeping dog. Confirm the preview.
3. Enter a dog name and a caption. Check the consent box. Complete the Turnstile widget.
4. Submit. The success sentence appears only after the Worker has confirmed the R2 object: “Your sleepy dog has been submitted! Your photo will appear after approval.”
5. Refresh the page. The photo must not be in the public grid.
6. In R2, or with `moderate.mjs pending`, confirm `pending/<uuid>.jpg`.
7. Run `moderate.mjs approve <uuid>`.
8. Refresh the gallery. The dog name, caption, date, Download, and Report controls appear.
9. Download the photo and open `sleepy-dog-<uuid>.jpg`.
10. Send a removal request and confirm a new object under `reports/`.
11. Run `moderate.mjs remove <uuid>` and confirm the public image returns 404.

`npm run test:photos` runs this path against the Worker module with objects stored on disk. It does not prove the production bucket until you complete the list above against your Worker.

`npx wrangler dev --config services/photo-worker/wrangler.toml` is the local Cloudflare simulator, including a local R2 bucket. It needs the workerd binary. On this Windows Server, workerd exited because `vcruntime140.dll` is missing, and the Visual C++ 2015–2022 installer stopped with Windows error `0x80070570`. Install that runtime on the machine you use for `wrangler dev`, then repeat one upload there before launch.

## What the API does

| Request | Who | Result |
| --- | --- | --- |
| `POST /api/uploads` | Visitor with a valid Turnstile token | Validates the image signature, strips metadata, enforces 5 MB and text limits, then stores `pending/` |
| `GET /api/photos` | Anyone | Newest approved metadata, 24 per page, up to 48 |
| `GET /api/photos/<id>` | Anyone | Approved image, or 404 |
| `GET /api/photos/<id>/download` | Anyone | Approved image as `sleepy-dog-<id>.jpg` (or the real extension) |
| `POST /api/reports` | Visitor with a valid Turnstile token | JSON object under `reports/` for an approved id only |
| `GET /api/admin/pending` and `POST /api/admin/photos/<id>/approve\|reject\|remove` | Owner token | Moderation |

Uploads are limited to 3 successful submissions per IP hash per UTC day. The hash is salted with the moderation token. Text is rejected when it contains `<` or `>`, and the React page renders names and captions as text.

## Cost

Confirm current numbers at https://developers.cloudflare.com/r2/pricing/ and https://developers.cloudflare.com/workers/platform/pricing/ before you launch. As published for the paid R2 plan, and subject to change:

- Storage is about **$0.015 per GB-month**.
- Class A operations (writes and lists, including upload, approve, and gallery listing) are about **$4.50 per million**.
- Class B operations (reads, including image views and downloads) are about **$0.36 per million**.
- R2 does not charge egress bandwidth to the public internet.
- The free R2 allowance commonly includes **10 GB-month**, **1 million Class A** operations, and **10 million Class B** operations each month.
- Workers on the free plan commonly include **100,000 requests per day**. The paid Workers plan is about **$5 per month** plus usage past the included requests.
- Turnstile’s standard widget does not have a separate photo-storage fee.

There is no database bill. A few hundred nap photos a month should stay inside the free allowances. A gallery refresh lists approved objects, so a very large approved set costs one Class A list plus one read per object that is missing metadata. Keep the approved set modest or paginate reviews.

## Rollback

`archive/supabase-gallery/` keeps the previous Supabase client, SQL, workflow snippet, and notes. `@supabase/supabase-js` is no longer installed. Restoring that path means copying those files back, reinstalling the package, and supplying a real Supabase project. The current site does not call it.

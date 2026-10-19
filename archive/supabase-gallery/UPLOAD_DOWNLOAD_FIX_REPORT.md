# Sleepy Dogs Club — photo upload and download fix

Branch: `fix/photo-upload-downloads` (from `9c07b04`). Not pushed. Not deployed.

The live site at https://aaaa-web-deploy.github.io/EPYDOG/ is still the previous build. Visitors cannot upload photos until a Supabase project is connected and a new GitHub Pages build is approved and deployed.

## Root causes

1. **Uploads were advertised, then disabled at build time.** `galleryConfigured` in `lib/sdcGallery.ts` is true only when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are present. Next.js inlines those values during `next build`. There is no `.env.local`. The GitHub Actions variable and secret named in `.github/workflows/pages.yml` are not set. The deployed JavaScript contains no `https://*.supabase.co` project host. A settings change alone cannot turn uploads on; the static export has to be rebuilt.

2. **The hero message was hardcoded.** `components/EepyExperience.tsx` always rendered “Photo uploads coming soon,” even if a future build included Supabase credentials.

3. **Scrapbook files were already valid.** `https://aaaa-web-deploy.github.io/EPYDOG/memes/01.jpg` through `07.jpg` return `200` `image/jpeg` with JPEG magic bytes. The old Download control used an `<a download>` link. That attribute is unreliable for cross-origin or mobile browsers and was not proven to save a file. Downloads now fetch the image and save the blob from the click.

4. **No Supabase project is connected.** Anonymous sign-in, the private `sleepy-dogs-private` bucket, RLS, and CAPTCHA cannot be verified in a cloud project because none is configured for this site. Credentials were not invented.

## Files changed

- `lib/sdcGallery.ts` — JPG/PNG/WebP check, staged upload, orphan cleanup if the database insert fails, scrapbook and approved-photo blob downloads, safe `sleepy-dog-[id].jpg` names, iPhone/iPad save hint.
- `components/SdcCommunityGallery.tsx` — drag-and-drop, immediate format errors, progress text, honest unconfigured notice with no submit button, scrapbook Download buttons, member gallery kept separate from the scrapbook.
- `components/SdcCommunityGallery.module.css` — drag-over style and scrapbook button styles.
- `components/EepyExperience.tsx` — when storage is configured, the hero shows **Post your sleeping dog** and opens the form. When it is not, the hero states that nothing is sent.
- `docs/UPLOAD_DOWNLOAD_FIX_REPORT.md` — this report.

Existing visuals, audio, notebook, scrapbook photos, contract copy, static export, and `/EPYDOG` base path were left in place.

## Supabase configuration status

| Check | Status |
| --- | --- |
| Supabase project | Not configured |
| Project URL | Missing |
| Publishable key | Missing |
| Anonymous sign-ins | Not verifiable |
| `supabase/01_install.sql` applied | Not verifiable |
| Private bucket `sleepy-dogs-private` | Defined in SQL only |
| Approved reads / private pending photos | Defined in RLS only |
| CAPTCHA | Not configured |

The SQL already creates the private bucket (JPEG only, 5 MB), `sdc_photos` with `pending` / `approved` / `rejected`, a trigger that forces new rows to stay `pending` and caps submissions at 3 per 24 hours, storage policies that allow a visitor to read only their own objects or an approved photo, and `sdc_reports` for approved photos only.

## Environment variables

Required at **build** time:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL, for example `https://YOUR_PROJECT_REF.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable/anon key only

Local trial: copy `.env.sdc.example` to `.env.local` and fill those two values. Do not commit `.env.local`.

GitHub Pages, already wired in `.github/workflows/pages.yml`:

- Actions **variable** `NEXT_PUBLIC_SUPABASE_URL`
- Actions **secret** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never put a service-role key, database password, or admin token in `NEXT_PUBLIC_*`, client code, or the static `out/` export. The publishable key is public by design once it is baked into the site.

## What the owner must do before uploads work

1. Create a project at https://supabase.com/dashboard.
2. Enable **Authentication → Providers → Anonymous sign-ins**.
3. Before a public announcement, turn on Supabase CAPTCHA. Plain `signInAnonymously()` fails if CAPTCHA is required and the site has no token. The upload error tells the visitor to check Anonymous sign-ins and CAPTCHA.
4. Open the SQL editor and run `supabase/01_install.sql` once.
5. Copy **Project URL** and the **publishable** key. Do not copy the service-role secret.
6. For a local test, put them in `.env.local`, then run `npm run build` and preview.
7. For the live site, set the GitHub variable and secret named above.
8. Rebuild and redeploy. This branch has not been pushed. Approve that separately.

## Moderation

There is no approve button on the website and no admin key in the browser.

After a visitor submits, the row in `public.sdc_photos` has `status = 'pending'`. The image stays in the private bucket. In the Supabase Dashboard SQL editor:

```sql
update public.sdc_photos
set status = 'approved', moderated_at = now()
where id = 'REVIEWED_UUID' and status = 'pending';
```

Reject with `status = 'rejected'` and the same `where` clause. Approved photos appear on the next gallery load. No new site deploy is required for that. Reports are in `public.sdc_reports`.

A visitor cannot approve their own row: the insert trigger rejects any status other than `pending`, and there is no public update policy.

## Upload and gallery behavior in code

When the two variables are present, **Post your sleeping dog** opens a form with:

- photo (JPG, PNG, or WebP), drag-and-drop and mobile file picker
- dog name (required)
- optional display name and caption
- a required consent checkbox for public display and downloading

The browser resizes the longest side to 1800 pixels, exports JPEG at quality 0.85 (which drops EXIF/GPS), and rejects files over 12 MB, under 150×150, or over 5 MB after compression. Submit signs in anonymously, uploads to `sleepy-dogs-private/{user-id}/{uuid}.jpg`, then inserts a pending row. If the insert fails, the uploaded object is deleted. Success is shown only after the insert succeeds. The photo stays out of the public grid until a moderator approves it.

The public grid loads approved rows, newest first, with dog name, caption, loading, empty, and error states, plus Download and Report. The seven scrapbook photos stay in a separate section and are labeled as site photos, not member uploads.

When storage is missing, the form is not rendered. The panel says new photos cannot be saved and that a submit button would not store anything.

## Downloads

Scrapbook buttons fetch `/memes/01.jpg`–`07.jpg` through the Next base path (`asset()`), check JPEG/PNG/WebP magic bytes, and save `sleepy-dog-scrapbook-1.jpg` through `sleepy-dog-scrapbook-7.jpg`.

Approved member photos use Supabase Storage `download` (not a public URL) and save `sleepy-dog-[photo-id].jpg`. Storage RLS is what keeps pending and rejected objects private. On iPhone and iPad, the success message says to use Save Image or Share if the browser opens the file instead of saving it.

## Checks

`npm ci`, `npm run typecheck`, `npm run lint`, `npm run check:assets` (26/26), and `npm run build` completed. Lint reported the two existing warnings in `eslint.config.mjs` and `postcss.config.mjs` and no errors. The static export has no “Photo uploads coming soon” string and no Supabase project host.

## Browser results

Local preview: `http://127.0.0.1:4321/` (empty base path, so scrapbook URLs are `/memes/01.jpg`, not `/EPYDOG/memes/01.jpg`). This build has no Supabase credentials.

| Step | Result |
| --- | --- |
| Open the site and click **click to enter** | Entrance closed; music player became Pause |
| Hero while storage is missing | “New photo uploads cannot be saved yet. Storage is not connected, so nothing is sent when you open the form.” |
| Click **Post your sleeping dog** | Panel opens. No file field and no submit button. Notice explains the missing Supabase URL and publishable key |
| Empty member gallery | “Member photos are not connected yet.” Scrapbook is labeled as not member uploads |
| Download scrapbook photos 1–7 | Each click created a `blob:` link with `download` set to `sleepy-dog-scrapbook-N.jpg` and showed “download started.” No alert |
| File contents | All seven local and live URLs are `image/jpeg`, JPEG magic `FF D8`, sizes 21278, 18015, 12986, 27349, 30682, 30090, 23170 bytes |
| Broken images / failed network responses | None in the local preview (20 images) |
| `/EPYDOG/EPYDOG` | None in the local page |
| Mobile width 390 | Document `scrollWidth` equals the viewport. No page-level horizontal scroll |

The operating-system download folder was not inspected. The browser tool confirmed the save link, filename, and JPEG bytes. A desktop browser accepts that as a file download. iOS fallback copy is present and was not exercised on a physical phone.

## What was not verified

These steps need the owner’s Supabase project. They were **not** completed, so this is not an end-to-end upload pass:

1. Submit a real photo into private storage.
2. See the pending `sdc_photos` row.
3. Confirm it is absent from the public gallery.
4. Approve it in the Supabase SQL editor.
5. Refresh and see it in the member gallery.
6. Download that approved photo and open `sleepy-dog-[id].jpg`.
7. Confirm an anonymous visitor cannot download a pending object or approve their own submission.
8. Confirm Anonymous sign-ins and CAPTCHA in the dashboard.

## Security

- Service-role and database secrets stay out of the browser and out of `NEXT_PUBLIC_*`.
- The bucket is private. Approved images use one-hour signed URLs for display and authenticated storage downloads for the file.
- New rows are forced to `pending`. Visitors do not get an update policy.
- Failed inserts delete the just-uploaded object. Approved objects cannot be deleted by the visitor policy.
- Consent is required before submit. Reports can be filed only against approved photos.
- The publishable key will be visible in the built JavaScript after a real deploy. That is expected. It is not an admin key.
- GitHub Pages cannot store uploads. Supabase remains the separate backend.

# Archived Supabase gallery

This folder is a rollback copy of the Supabase photo gallery from branch `fix/photo-upload-downloads` / `backup/photo-upload-downloads`.

The live implementation no longer uses Supabase. Community photos are stored in Cloudflare R2 and served by the Worker in `services/photo-worker/`. See `docs/CLOUDFLARE_NO_DATABASE_SETUP.md`.

Archived here:

- `sdcGallery.ts` — browser client that called Supabase Auth, Storage, and `sdc_photos`
- `SdcCommunityGallery.tsx` — gallery UI bound to that client
- `supabase/01_install.sql` — bucket, tables, and RLS
- `.env.sdc.example` — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `pages.yml` — GitHub Actions env that injected those values
- `SDC_UPLOAD_NOTES.md` and `UPLOAD_DOWNLOAD_FIX_REPORT.md` — previous setup notes

Do not import this client from the site. It expects `@supabase/supabase-js`, which is no longer a dependency.

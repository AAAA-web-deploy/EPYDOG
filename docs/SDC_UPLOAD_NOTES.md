# Community photo uploads

Uploads are coded and stay off until Supabase is connected. The live page says so. Existing scrapbook photos can still be downloaded.

## What you need to do

1. Create a project at https://supabase.com/dashboard.
2. Turn on Authentication > Providers > Anonymous sign-ins. Add CAPTCHA before you announce uploads publicly.
3. In the SQL editor, run `supabase/01_install.sql` from this repo.
4. Copy the project URL and the publishable key. Do not use the service-role secret.
5. For a local trial, copy `.env.sdc.example` to `.env.local` and fill in those two values.
6. For the live site, add GitHub Actions variable `NEXT_PUBLIC_SUPABASE_URL` and secret `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then redeploy. The Pages workflow already reads them at build time.

After a visitor submits a photo it stays pending. In the Supabase table `sdc_photos`, set a reviewed row to `approved` before it appears on the site. Rejected photos stay hidden. Reports land in `sdc_reports`.

The storage bucket is private. Approved photos are shown with one-hour signed links. There is no public approve button on the website.

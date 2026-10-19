# Archived Cloudflare gallery client

This is the browser client that talked to `services/photo-worker/`. The trial site does not import it.

The Worker, R2 layout, moderation script, and setup notes are still in the repository:

- `services/photo-worker/`
- `docs/CLOUDFLARE_NO_DATABASE_SETUP.md`

Copy `sdcGallery.ts` back to `lib/sdcGallery.ts` and `SdcCommunityGallery.tsx` back to `components/` if a later version should use that Worker again. It expects `NEXT_PUBLIC_GALLERY_API_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

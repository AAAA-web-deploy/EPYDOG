# Eepy Dog — Next.js Ethereum website

A **full, independently written Next.js codebase** reproducing the *observed structure, visual direction and interactions* of the public reference at https://eepydog.com/ (inspected October 18, 2026). Includes the user-provided 10 media files and supplementary/demo assets from the earlier asset package. Not an original source-code extraction or a verified pixel-perfect mirror.

## Start here

Requirements: Node.js 20.9+ (Node 22 recommended), npm.

```powershell
# in the extracted folder
npm install
npm run check:assets
npm run dev
```

`npm run build` writes a static site to `out/`. `npm run tracker` serves that folder and the visitor API at http://127.0.0.1:4173/ . The private dashboard is http://127.0.0.1:4173/dashboard/ and the initial password is `aaaa`.

GitHub Pages publishes the same export from `.github/workflows/pages.yml` at `/EPYDOG/`. Pages cannot store visits. Point `NEXT_PUBLIC_ANALYTICS_ORIGIN` at an HTTPS copy of this tracker, and set `ALLOWED_ORIGINS` to `https://aaaa-web-deploy.github.io`, when you want the live site to record visitors.

## Change only these things for your Ethereum variant

Edit **`config/site.ts`**:

```ts
contractAddress: "", // your own deployed Ethereum contract address: 0x + 40 hex chars
logo: "/brand/replace-with-your-logo.svg", // your own brand image path
communityUrl: "", // your own real community URL
```

No Solana contract is included as your Ethereum CA. Until `contractAddress` is valid, the UI reads `CA coming soon`, and the copy button explains the missing value. Ethereum Explorer and Uniswap links appear automatically when configured. All references are to Ethereum mainnet (Chain ID 1).

## Files and folders

| Path | Role |
| --- | --- |
| `app/page.tsx` | Page entry point |
| `app/layout.tsx` | SEO metadata, favicon, responsive viewport |
| `app/globals.css` | Detailed desktop/tablet/mobile design + animations |
| `components/EepyExperience.tsx` | Entrance gate, header, park hero, notebook, nap, corkboard, Eepy FM, modal, footer |
| `components/Icons.tsx` | Custom React SVG controls |
| `config/site.ts` | **Main token/branding config** |
| `config/content.ts` | Image captions, playlist, media paths |
| `public/` | Images, videos, UI icons, ambient-demo tracks |
| `docs/CURSOR_PROMPT.md` | Step-by-step prompt for Cursor to tune the reproduction |
| `docs/COMPARISON_CHECKLIST.md` | Visual QA targets |
| `scripts/check-assets.mjs` | Checks referenced media is present |

## What's implemented

- Full-screen dark entrance overlay and segmented loading animation with entry interaction.
- Hero scene with auto-playing muted park video, Eepy wordmark, floating illustrated fish and scroll cue.
- Notebook-style story with page lines, facts, handwriting-style heading, and dog portrait.
- Nap spot scene with video loop, sleeping time counter and clickable status.
- Corkboard with 7 rotated polaroids, full-size modal, Escape + left/right navigation, originals.
- Sticky Ethereum contract address and clipboard UI; community links configurable.
- Eepy FM persistent player: 4 songs, play/pause, prev/next, selectable tracklist, volume, track timer, repeat via next track, volume persistence.
- Mobile/tablet/desktop responsive rules, accessible labels, Escape close, reduced-motion support, sensible autoplay behavior.

## Accuracy and legal-use notes

The visual reference was analyzed from public pages and a browser inspection, not taken from its proprietary source repository. Fonts, page geometry, positioning, effects and some UI controls are an original recreation and **require side-by-side verification** against the live reference to reach closer parity. Four site-background media assets supplied by the supplementary pack are generated fallbacks; its music is demonstration audio, not the original Eepy FM. The inclusion of user-uploaded original media is not an assertion of rights. Obtain appropriate permission for existing imagery, name/branding, music and commercial deployment. Clearly disclose that any Ethereum token is independent unless an official relationship is authorized.

See `docs/COMPARISON_CHECKLIST.md` and `docs/CURSOR_PROMPT.md` for reference matching.

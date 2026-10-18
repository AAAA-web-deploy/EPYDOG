# Paste this into Cursor (Agent mode)

You are a senior Next.js front-end developer specializing in close visual reproductions using user-provided and rights-cleared source assets.

**Task**: Build and improve the complete website in this repository so that the rendering and observable interactions resemble https://eepydog.com/ as closely as possible. The project is an independent Ethereum-mainnet Eepy Dog concept. Do not falsely imply an official Ethereum bridge or Solana team affiliation.

**Stack**: Next.js 15 App Router + TypeScript + CSS. Maintain existing imports, no unnecessary template reset. Use the *existing project code and media assets* first.

**Instructions**:
1. Read `README.md`, `config/site.ts`, `config/content.ts`, and `docs/COMPARISON_CHECKLIST.md`.
2. Run `npm install`, `npm run check:assets`, `npm run typecheck`, `npm run build` and fix failures before styling.
3. Run a local server and open the public reference and localhost side by side, first at 1440x900, then at 390x844. Compare first paint, entrance overlay, header, hero, notebook, nap spot, corkboard, floating controls, music player and modal. Capture screenshots before modifying CSS.
4. Fine-tune **spacing, image crop, typography, colors, surfaces, animation timing, section heights, hover/scroll interactions**. Keep the content and video asset paths aligned. Do not invent visually unverified elements.
5. Verify user media locations: `public/park-loop.mp4`, `public/nap-loop.mp4`, `public/who.jpg`, `public/memes/01.jpg` ... `07.jpg`. The poster/background/audio files are from the supplemental pack and may be fallback or DEMO; clearly mark that until approved replacements arrive.
6. Add the user's Ethereum CA and logo **only after supplied**, by editing `config/site.ts` and replacing/adding the logo file to `public/brand/`. Do not use the reference project's Solana CA; do not invent an Ethereum CA.
7. Make each interaction real: click-to-enter, video playback, notebook and track selection, Eepy FM volume/seek/next/pause, corkboard image viewer, copy-to-clipboard with toast, link buttons, mobile layout. No dead buttons.
8. Maintain keyboard accessibility and reduced-motion behavior. Ensure video assets loop silently and audio only starts after a user gesture.
9. Avoid hotlinking the original site or copying its bundled JavaScript. Work from this independently written code and owned/licensed files; seek authorization for the original creative assets before publishing.
10. Check on Chrome and mobile widths. Run `npm run build` and capture a final review screenshot for desktop and mobile. Document any remaining visual mismatch honestly.

**Acceptance criteria**:
- Successful Next.js build; no missing paths; clean browser console.
- All six main sections and active player present. All 7 gallery images open.
- Real configurable CA and logo; coherent empty state prior to configuration.
- Works at 320px, 390px, 768px, 1024px, 1440px widths, no horizontal overflow.
- No unlicensed music or sourced artwork misrepresented as original.

Do not replace the current assets with generic dog stock photographs. Use the bundled user-uploaded media for the original character representation, only where the user has rights to deploy it. If exact parity is impossible due to unavailable proprietary code, audio, or media, itemize those missing items instead of claiming perfection.

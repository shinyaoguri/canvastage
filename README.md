# Canvastage

A live coding editor for creative coding. Write p5.js sketches with a transparent editor overlay on top of your running canvas.

## Features

- **Transparent overlay editor** — Monaco Editor sits on top of the live preview, so your code and artwork coexist
- **Multi-file editing** — Switch between HTML, CSS, and JavaScript tabs
- **Instant preview** — Press `Ctrl+Enter` to run your sketch immediately
- **29 editor settings** — Font, theme, opacity, cursor style, and more, persisted in IndexedDB
- **8 editor themes** — transparent-dark, monokai, dracula, github-dark, nord, solarized, one-dark, cyberpunk
- **Sample browser** — Explore categorized examples: basics, animation, generative, interaction, 3D, libraries, ML, experimental
- **Console panel** — Captures `console.log` / `warn` / `error` from the preview iframe
- **Full input forwarding** — Mouse, keyboard, and touch events pass through to the canvas
- **Share to GitHub Gist** — Sign in with GitHub to publish/auto-update your sketch as a gist
- **Deploy to OpenProcessing** — Plus+ members can publish straight to OpenProcessing via API (sketches are created Private by default); everyone else gets a guided manual-upload flow

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run E2E tests (settings regression, against the production build)
npx playwright install chromium   # first time only
npm run test:e2e
```

To use external libraries, add a `<script src="...">` tag to the `index.html` tab (see the **libraries** sample category for examples with Three.js, GSAP, Matter.js, and Tone.js).

## Tech Stack

- **TypeScript** + **Vite** — Build toolchain
- **Monaco Editor** — Code editor
- **p5.js** — Default creative coding library
- **Zod** — Settings validation
- **idb** — IndexedDB wrapper for persistence

## Security

Sketches run in an iframe that shares the app's origin (this is required for
`getUserMedia` webcam/ML samples and Web Audio to work). As a result, code you
run in the editor has full access to the page, including the GitHub gist token
stored in IndexedDB after you sign in. **Do not paste and run sketches you don't
trust.** The bundled samples are safe; arbitrary third-party code is not.

The OAuth token is scoped to `gist` only — it cannot touch your repositories or
account settings — but it is worth protecting all the same.

The same applies to the **OpenProcessing API token**: it is stored only in your
browser's IndexedDB and is sent directly to OpenProcessing (their API allows
cross-origin requests, so no proxy is involved). A write-enabled token can
create, update, and delete any of your sketches, so treat it like a password and
clear it on shared machines. (Canvastage itself only creates and updates
sketches — it never deletes — but the token's capability is broader.) Direct API
deploy requires an OpenProcessing
**Plus+** membership; free accounts use the in-app manual-upload guide instead.

## Deployment

Deployed to **Cloudflare Pages** via GitHub Actions. Pushes to `main` trigger production deploys; pull requests get preview URLs.

## License

MIT — Shinya Oguri

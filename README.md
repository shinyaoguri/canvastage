# Canvastage

A live coding editor for creative coding. Write p5.js sketches with a transparent editor overlay on top of your running canvas.

## Features

- **Transparent overlay editor** — Monaco Editor sits on top of the live preview, so your code and artwork coexist
- **Multi-file editing** — Switch between HTML, CSS, and JavaScript tabs
- **Instant preview** — Press `Ctrl+Enter` to run your sketch immediately
- **30 editor settings** — Font, theme, opacity, cursor style, and more, persisted in IndexedDB
- **8 editor themes** — transparent-dark, monokai, dracula, github-dark, nord, solarized, one-dark, cyberpunk
- **Sample browser** — Explore categorized examples: basics, animation, generative, interaction, 3D, libraries, ML, experimental
- **Console panel** — Captures `console.log` / `warn` / `error` from the preview iframe
- **Audio-reactive beat visualizer (beta)** — Off by default; enable in Settings to react to live audio. Pick the source (microphone or shared-tab audio) and a visual pattern (first one: a soft white flash around the window frame on bass hits). Two detection modes: **Onset** fires on every attack (fast, but also catches off-beats and hi-hats), while **Beat lock** estimates the tempo and phase-locks to the musical beat grid (takes a few seconds to lock, falls back to onset until then). Enabling prompts for the relevant permission; the on/off state is per-session
- **Re-run transitions** — Optional slide-style animation when you re-run a sketch (dissolve / slide / wipe / zoom), with adjustable duration. Off by default; pick one in Settings → Transition
- **Full input forwarding** — Mouse, keyboard, and touch events pass through to the canvas
- **Resume where you left off** — Your sketch is auto-saved to this browser as you type. Reopen canvastage and you're offered the sketches you were working on — each with a thumbnail of how it looked — along with their gist link, so re-running keeps updating the same gist. Drafts open in another window or tab are left out of the list, and anything older than 48 hours is discarded
- **Share to GitHub Gist** — Sign in with GitHub to publish/auto-update your sketch as a gist
- **Import from Gist** — Paste a canvastage gist URL (or ID) to load it instantly into the editor. If you are signed in and the gist is **yours**, canvastage keeps updating that same gist instead of creating a new one; other people's gists open as a new project. Signing in also lets you import your own secret gists
- **Deploy to OpenProcessing** — Plus+ members can publish straight to OpenProcessing via API (sketches are created Private by default); everyone else gets a guided manual-upload flow. The toolbar button is **hidden by default** because direct deploy needs a Plus+ write token — turn it on in Settings → Toolbar

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

# Run unit tests (pure logic: gist/preview/OAuth-escape)
npm test

# Run E2E tests (settings + same-origin preview regression, production build)
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

Auto-saved drafts are stored in plain text in this browser's IndexedDB, which
means the preview can read them too — the same trade-off as the token above.
Each draft also keeps a small thumbnail of the running sketch, so a webcam sketch
stores a frame of your camera feed alongside it.
Settings → "保存中のドラフトを削除" clears them, and they expire after 48 hours
anyway. Private browsing keeps nothing: IndexedDB is unavailable there, so drafts
are silently skipped. Saving is debounced and flushed whenever the tab is hidden
or a sketch is run, so at worst you lose the last second or so of typing.

The OAuth token is scoped to `gist` only — it cannot touch your repositories or
account settings — but it is worth protecting all the same. Canvastage also reads
your GitHub login name (`GET /user`, public profile data available to any token)
so that importing a gist can tell whether it is yours; the name is cached
alongside the token and is removed when you clear it.

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

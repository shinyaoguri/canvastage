# Canvastage

A live coding editor for creative coding. Write p5.js sketches with a transparent editor overlay on top of your running canvas.

## Features

- **Transparent overlay editor** — Monaco Editor sits on top of the live preview, so your code and artwork coexist
- **Multi-file editing** — Switch between HTML, CSS, and JavaScript tabs
- **Instant preview** — Press `Ctrl+Enter` to run your sketch immediately
- **Library directives** — Load external libraries with `// @use` comments (see below)
- **40+ editor settings** — Font, theme, opacity, cursor style, and more, persisted in IndexedDB
- **8 editor themes** — transparent-dark, monokai, dracula, github-dark, nord, solarized, one-dark, cyberpunk
- **Sample browser** — Explore categorized examples: basics, animation, generative, interaction, 3D, libraries, ML, experimental
- **Console panel** — Captures `console.log` / `warn` / `error` from the preview iframe
- **Full input forwarding** — Mouse, keyboard, and touch events pass through to the canvas

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
```

## Library Directives

Add `// @use` comments at the top of your JavaScript to load external libraries from CDN:

```js
// @use three              — resolve from built-in registry
// @use gsap@3.12.0        — specify version
// @use https://example.com/lib.js  — direct URL
```

## Tech Stack

- **TypeScript** + **Vite** — Build toolchain
- **Monaco Editor** — Code editor
- **p5.js** — Default creative coding library
- **Zod** — Settings validation
- **idb** — IndexedDB wrapper for persistence

## Deployment

Deployed to **Cloudflare Pages** via GitHub Actions. Pushes to `main` trigger production deploys; pull requests get preview URLs.

## License

MIT — Shinya Oguri

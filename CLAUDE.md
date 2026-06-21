# CLAUDE.md

Guidance for AI agents working in this repository.

## What this is

Canvastage — a live-coding editor for creative coding. A transparent Monaco
editor overlays a live p5.js preview. Sketches are written as HTML/CSS/JS and
run in a preview iframe. Built with TypeScript + Vite, deployed to Cloudflare
Pages. Sketches can be shared as GitHub gists via OAuth.

- `src/preview.ts` — builds the sketch HTML and runs it in the preview iframe;
  bridges console output and input events between parent and iframe.
- `src/share.ts` / `src/gist.ts` / `src/github-auth.ts` — gist sharing + OAuth.
- `src/openprocessing.ts` / `src/openprocessing-auth.ts` /
  `src/openprocessing-share.ts` / `src/openprocessing-modal.ts` — OpenProcessing
  deploy (API client, token storage, button, token/guide modal).
- `functions/api/auth/callback.ts` — Cloudflare Pages Function for OAuth callback.
- `src/samples/` — bundled, trusted example sketches (collected via `import.meta.glob`).

## Design decisions (read before "fixing")

These are deliberate. They look like bugs/vulnerabilities at first glance and
have been "fixed" before, causing regressions. Do not revert without
understanding the trade-off.

### The preview iframe runs SAME-ORIGIN on purpose

`src/preview.ts` sets `sandbox="allow-scripts allow-same-origin"`. The
`allow-same-origin` is **required** and must not be removed.

- Why it looks wrong: running arbitrary user JS in the app's own origin means a
  sketch can reach `window.parent.indexedDB` and read the stored `gist`-scoped
  GitHub token, or touch the parent DOM.
- Why it must stay: an opaque-origin sandbox (allow-scripts only) breaks two
  sample categories — `getUserMedia` (webcam / ML samples) can't get permission
  on an opaque origin, and Web Audio (tone-synth) never receives the parent's
  user-activation, so audio stays suspended. This was attempted and reverted in
  commit `88374f5`.
- Trade-off: knowingly accepted. The product assumes you only run trusted code
  (bundled samples are trusted; pasted third-party code is not). The risk is
  surfaced in the settings panel footer and the README "Security" section. The
  token scope is `gist` only — no repo/account access.
- If real isolation becomes necessary (e.g. a feature that auto-runs untrusted
  shared sketches): do NOT just re-add the sandbox. Instead either (a) serve the
  preview from a separate origin with `allow-same-origin allow-scripts`, or
  (b) move the token to an httpOnly cookie and proxy gist calls through a Pages
  Function so the token is never readable from page JS.

### Gist auto-update

Once a sketch has been shared (a gist exists), re-running it auto-updates that
gist (`ShareButton.scheduleAutoSave` in `src/share.ts`): only when content
changed, debounced, skipped on JS syntax error, and silent on success. Loading
a sample or starting a new project detaches the gist so auto-save can't
overwrite the previous project. See commit `0328ebe`.

### OpenProcessing deploy

`src/openprocessing.ts` deploys a sketch to OpenProcessing's Public API. Things
that look wrong but are deliberate:

- **No OAuth, no proxy.** OpenProcessing offers no third-party OAuth app system —
  the only auth is a personal Bearer token the user generates in their account
  settings. Their API also sends `Access-Control-Allow-Origin: *` and allows the
  `authorization` header, so the browser calls the API directly. Don't add a
  Pages Function proxy "for security" — it buys nothing here (unlike the GitHub
  flow). The token lives in IndexedDB; the trade-off is the same as the
  same-origin preview and is noted in the README + the OP modal.
- **html mode, three code tabs.** Sketches map to OpenProcessing `mode: "html"`
  with `index.html` / `style.css` / `sketch.js` as code tabs (orderID 0/1/2).
  p5js mode is JS-tabs-only and would drop the CDN `<script>` tags in
  `index.html`, breaking the three/matter/gsap/tone/mediapipe samples. Verified
  against the live API that html mode resolves the relative refs between tabs.
- **Write needs Plus+.** Only a Plus+ member's write-enabled token can create or
  update sketches (`whoami` exposes `tokenWriteAccess`). Free tokens are
  read-only, so the button falls back to the manual-upload guide. This is an
  OpenProcessing limitation, not a bug.
- **Manual deploy only.** Unlike the gist auto-save, OP deploy fires only on the
  button click (avoids burning the paid API rate limit on every run).

## Commands

- `npm run dev` — dev server
- `npm run build` — `tsc && vite build`
- `npm run preview` — preview the production build

No test suite exists yet.

## Conventions

- Comments and user-facing strings are largely in Japanese; match the
  surrounding language when editing a file.
- `__APP_VERSION__` / `__GIT_COMMIT__` are injected at build time by
  `vite.config.ts` (`define`) and shown in the settings footer.

## Commits & PRs — authorship

The repository owner (Shinya Oguri <ogrsny@gmail.com>) is always the **author**
of commits and PRs. AI coding agents (Claude Code, GitHub Copilot, etc.) are
**never** the author — they are credited only as a `Co-Authored-By` trailer.

- Do not set the commit author/committer to the AI agent; leave it as the
  configured git user.
- When an AI agent helped, append a trailer naming whichever agent was used at
  the time, e.g. `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  For other agents, use that agent's own identity instead.
- If no AI agent was involved, add no `Co-Authored-By` trailer.

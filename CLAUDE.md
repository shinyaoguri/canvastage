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

Importing a gist **can** attach too — but only when it is provably yours:
`gist-import.ts` compares the gist's `owner.login` against your login
(`getStoredIdentity`, refreshed from `GET /user` and opportunistically cached
from create/update responses). Everything else — other people's gists, anonymous
gists, signed-out, or any failure to determine the owner — falls back to a new
project. Attaching to someone else's gist can't corrupt it (the PATCH 404s), but
it would show "updating" while silently failing, so ambiguity always resolves to
*don't attach*.

Three things around attach that look incidental but are load-bearing:

- **`savedProjectName` is a filename, not a display name.** It must be the base
  name of a title file that actually exists in the gist (`resolveTitleFileName`),
  or `null`. `updateGist` turns it into `_<name>.md` and sends `null` to delete
  it on rename — pass the displayed project name instead and you'll try to delete
  a file that was never there while the real title file survives as garbage.
- **`attachmentEpoch` guards in-flight saves.** `autoSave` / `handleClick` capture
  the epoch before awaiting and drop their write-back if it changed. Without it, a
  save that finishes after a detach resurrects the old `gistId` and the next run
  overwrites a gist belonging to a different project.
- **`GistError.code` distinguishes `notfound` / `forbidden` / `ratelimit`.** A 404
  (deleted gist, or someone else's — GitHub returns 404 for both to avoid
  disclosing existence) detaches instead of retrying forever on every run.

### One `createStore` call per IndexedDB database

`src/idb-store.ts` opens every database at **version 1**, and IndexedDB only runs
`upgrade` when the version goes up. So calling `createStore` twice against the
same database name silently breaks the second store: on any machine where that
database already exists at v1, `upgrade` never fires, the new object store is
never created, and every `get`/`put` throws `NotFoundError`. It works on a fresh
profile, which is exactly why it slips through local testing.

Declare all stores of one database in a single `createStores(dbName, [...])`
call, or give the new concern its own database name (drafts use
`canvastage-drafts`, kept separate from `canvastage-db` / `canvastage-auth` so
neither existing database needs a version bump). `createStore` is now just a
one-store wrapper around `createStores`.

### Draft auto-save

`src/drafts/` persists the working sketch (files, project name, active tab, gist
and OpenProcessing attachments) to `canvastage-drafts` so a closed window can be
resumed. Four rules that look arbitrary but are the whole design:

- **Only `editor.onDidChange` creates a draft.** Every other trigger
  (`noteState`) saves an *existing* draft and never mints one. That is what keeps
  the startup `runCode()` — and a tab you opened and never touched — out of the
  restore list. It works because `code-editor.ts` drops `isFlush` events, so
  `setValue` (tab switch, sample load, restore) is not an edit.
- **Concurrent edits fork, they don't lock.** If another tab claims the draft
  you hold, you re-mint your own id and keep going rather than blocking either
  side. Worst case there are two drafts; no case loses content. `persist()`
  re-checks `ownerTabId` right before writing as the fallback for browsers
  without BroadcastChannel.
- **Liveness is decided by pong alone when BroadcastChannel works.** The
  heartbeat records exist for browsers without it — do not "harden" the check by
  consulting both. Closing a tab deletes its session from a `pagehide` handler,
  and that write is not guaranteed to finish; on a slow machine the row survives
  with a fresh timestamp. Trusting it there means a tab you just closed stays
  unrestorable for `SESSION_STALE_MS`. CI caught this, local runs did not.
  A tab that misses the ping window is treated as gone, and the claim exchange
  on restore forks it instead of losing either side.
- **The same gist in two tabs is a real hazard.** Gist PATCH has no optimistic
  locking and auto-save is silent on success, so two attached tabs quietly
  overwrite each other's revisions. The `claim` message covers this too: the
  later claimant detaches (content kept) and says so. Ordering is
  `(claimedAt, tabId)` — a total order, so exactly one side yields and the
  re-claim on the winning side terminates.
- **`pagehide` is not a save point.** IndexedDB writes started there aren't
  guaranteed to finish. The real last chance is `visibilitychange` → hidden,
  which fires before tab discard on mobile too. Combined with the 800ms debounce
  and a flush on every run, worst-case loss is the last second of typing —
  accepted and documented in the README rather than papered over with a
  synchronous localStorage mirror.

### Draft thumbnails are captured inside the preview frame

The restore list shows what each sketch looked like, captured through
`THUMBNAIL_BRIDGE_SCRIPT` in `src/preview.ts`. The parent could read the canvas
directly (same-origin preview), but it must not: a WebGL context created without
`preserveDrawingBuffer` is only readable inside the frame that drew it, so the
capture has to ride the iframe's own `requestAnimationFrame`. The bridge also
drops single-colour results, which is what an unreadable WebGL buffer looks like
— those fall back to a code excerpt in the modal instead of showing a black box.

Consequence worth knowing: a webcam sketch's thumbnail contains a frame of the
camera feed, stored in plain IndexedDB. That is called out in the README next to
the token warning, and Settings can clear all drafts.

### The restore prompt resolves before Monaco is created

`init()` awaits `resolveRestore()` *before* `createEditor`. Two things break if
you move the editor ahead of it and only delay the first `runCode()`:

- A window opens where the editor is visible but nothing has run yet. Click the
  run button in that window and it starts a *second* run instead of stopping the
  first — `e2e/editor.spec.ts` catches exactly this.
- A random sample would start behind the modal, so a webcam or audio sample
  fires its permission prompt behind a dialog the user hasn't answered yet.

The discovery starts at the very top of `init()` and runs alongside
`loadSettings()` and the whole UI build, so with no candidates the await costs
roughly the BroadcastChannel ping window and nothing else. `applyDraft` therefore
only fixes up `files` / tab state / attachments; the editor picks the restored
content up when it is constructed.

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
- **The toolbar button is hidden by default.** Since write needs Plus+, the button
  is a dead end for most visitors — it can only ever open the manual-upload guide.
  `showOpenProcessingButton` in `src/settings.ts` defaults to `false`; Settings →
  Toolbar turns it on. This is deliberate, not an oversight — don't make the button
  visible by default. Note the toolbar places buttons by
  `right: … + N * var(--toolbar-gap)`, so hiding it must also shift `#import-btn` /
  `#new-project-btn` one step inward (the `.op-deploy-hidden` rules in
  `src/style.css`), or a gap opens in the row. Both halves are covered by
  `e2e/settings.spec.ts`.
- **List code tabs before writing — never PATCH-then-404.** A 404 from the
  `/code/{title}` endpoint (e.g. PATCHing a tab that doesn't exist yet, like
  `index.html` on a fresh sketch) returns an HTML error page **with no CORS
  header**, so in the browser it surfaces as an opaque CORS failure, not a
  readable 404 you can catch and retry. So `deploySketch` first does
  `GET /code` to learn which tabs exist, then POSTs the missing ones and PATCHes
  the existing ones. Don't "simplify" this back to try-PATCH-catch-404 — it works
  in curl (no CORS enforcement) but breaks in the browser. `onCreated` also
  records the new sketch id before code upload so a mid-deploy failure doesn't
  spawn orphan sketches on retry.

## Commands

- `npm run dev` — dev server
- `npm run build` — `tsc && vite build`
- `npm run preview` — preview the production build
- `npm run lint` / `npm run format` — ESLint / Prettier
- `npm run typecheck:functions` — typecheck the Cloudflare Pages Functions under
  `functions/` (uses `tsconfig.functions.json` + `@cloudflare/workers-types`).
  The app's own `tsconfig.json` only covers `src/`, so the OAuth callback needs
  this separate pass.
- `npm test` — Vitest unit tests (`test/`, node env, `vitest.config.ts`). Covers
  pure logic that's painful to exercise via E2E: `gist.ts` (`parseGistId` /
  `resolveProjectName` / `fetchGist` branches with mocked `fetch`), `preview.ts`
  `buildHtml`, the draft schemas and selection logic (`src/drafts/`), and the
  OAuth inline-script escaper (`functions/api/auth/escape.ts`, extracted from
  `callback.ts` so it's importable without the Pages runtime).
  Runs in CI in the `build` job.
- `npm run test:e2e` — Playwright E2E. Runs against the **production build**
  (`build` → `preview`), because the settings-opacity bug it guards only appeared
  after CSS minification — a dev-server test would have missed it. Tests live in
  `e2e/`. Guards the settings regression **and** the same-origin preview
  (`preview-origin.spec.ts`: asserts `allow-same-origin` + that `getUserMedia`
  resolves in the preview frame — the exact thing commit `88374f5` broke; needs
  the fake-media Chromium flags in `playwright.config.ts`) **and** the Monaco
  language workers (`monaco-worker.spec.ts`: asserts the TS/CSS workers actually
  boot by expecting error squigglies — a wrong worker entry point can still build
  and silently kill language features) **and** drafts (`draft-autosave.spec.ts` /
  `draft-restore.spec.ts`: read and seed the `canvastage-drafts` IndexedDB
  directly — an untouched tab writes nothing, an edited one writes exactly one
  record, a seeded draft comes back through the restore modal, and a draft held
  by another tab stays out of the list). First run needs `npx playwright install
  chromium`. Runs in CI as a required check (the `e2e` job in `ci.yml`).

  Note that `saveSettings` is fire-and-forget (`notifyChange` doesn't await it),
  so a test that reloads right after flipping a setting must first poll
  IndexedDB for the persisted value — asserting the on-screen effect isn't
  enough and makes the test flaky under load.

## Deployment

### `functions/` has to travel to the deploy job as an artifact

`wrangler pages deploy dist` has **no flag for the functions directory** — it
picks up `functions/` from the current working directory, implicitly. Deploying
without it still *succeeds*: you get a site with no Pages Functions and no error
anywhere. The GitHub OAuth callback (`/api/auth/callback`) then falls through to
the SPA and returns the editor HTML with a 200, so `initiateOAuth` never receives
its `postMessage` and every sign-in ends in "認証がキャンセルされました。".

That is exactly what happened between `3ec808a` (#49, which folded the deploy
workflow into `ci.yml` and dropped `actions/checkout` along the way) and #83 —
months of broken sign-in with a green CI the whole time.

Three things keep it fixed, and the first one is the non-obvious part:

- **`functions/` is uploaded as its own artifact by `build` and downloaded by
  `deploy`** — deliberately *not* `actions/checkout`. Checking out puts
  `package.json` in the workspace, and then wrangler-action's `npm i wrangler@4`
  resolves against the whole project tree and dies on ERESOLVE, because the repo
  pins `@cloudflare/workers-types@^4` while current wrangler wants `^5`. That
  failure is what a first attempt at this fix hit. Keeping the deploy workspace
  free of `package.json` also avoids `git clean -ffdx` (checkout's `clean: true`
  default) wiping the already-downloaded, gitignored `dist/`.
- **A post-deploy `curl` step** asserting `/api/auth/callback` returns 400
  ("Missing code parameter"). A wrangler deploy that silently drops the
  functions is invisible otherwise, so the guard has to be an HTTP check against
  the deployed site — nothing in the build can detect it.
- Adding a file under `functions/` needs no workflow change, but **adding a
  second directory that wrangler reads from cwd would**.

`npm run typecheck:functions` only type-checks the source; it says nothing about
whether the functions were shipped.

## Conventions

- Comments and user-facing strings are largely in Japanese; match the
  surrounding language when editing a file.
- `__APP_VERSION__` / `__GIT_COMMIT__` are injected at build time by
  `vite.config.ts` (`define`) and shown in the settings footer.
- The `overrides.dompurify` pin in `package.json` is deliberate: DOMPurify is a
  transitive dependency of `monaco-editor` (which locks an older 3.2.x), and the
  override force-upgrades it to a 3.4.x line that fixes known mXSS advisories.
  It is not used directly in app code — don't "remove the unused dependency".

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

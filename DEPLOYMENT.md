# Deployment

GitHub Pages publishes the PWA from `master` at
<https://arthow4n.github.io/did-it-become-what-you-like/>. That URL, the
manifest ID and scope, the service-worker scope, and the IndexedDB database
remain the same. Pages builds the checked-out commit with `npm ci` and
`npm run verify`, then deploys the verified `dist/` artifact. The Pages
workflow uses the existing public `VITE_GOOGLE_CLIENT_ID` for Direct GIS.
Leave it set to the existing OAuth client so Google Drive app data remains
available to the same app. Direct tokens remain in browser memory.

## Local development and verification

Use the Node.js version in `.node-version`.

```sh
npm ci
npm run dev
npm run verify
npm run build
```

`npm run verify` checks formatting, lint, types, tests, the Pages artifact,
and dependencies. `npm run build` adds a Wrangler dry run. Run
`npx playwright install chromium` and `npm run test:e2e` for browser coverage.
`npm run browser:install` installs the additional pinned visual-check pair used
by `npm run gallery:verify`. Do not commit generated artifacts or browser
profiles.

To test the Worker locally, copy `.dev.vars.example` to `.dev.vars`. Use an
OAuth test client and add the exact local callback listed in the example
(`http://localhost:8787/auth/google-drive/callback`). Register
`http://127.0.0.1:5173` as a JavaScript origin if testing Direct mode locally.
Run the following and load the repository base path in the Vite app.

```sh
npx wrangler d1 migrations apply did-it-become-what-you-like --local
npm run worker:dev
```

Use `VITE_SYNC_SERVER_URL=http://localhost:8787` to point a local frontend at
Wrangler. Integration tests use a disposable D1 database and stub Google.

## Workers Builds and D1

The Worker is deployed at
<https://did-it-become-what-you-like.arthow4n.workers.dev/health>.
The `DB` binding targets the dedicated `did-it-become-what-you-like` database.
Migration `0001_sessions.sql` has been applied and registered with Wrangler's
migration ledger. Apply future migrations with
`npx wrangler d1 migrations apply did-it-become-what-you-like --remote` before
deploying code that requires them. Keep migrations compatible with the previous
Worker version until rollback is unnecessary. A Worker rollback does not roll
back D1 data.

Workers Builds watches `arthow4n/did-it-become-what-you-like` on `master`. It
uses the repository root, `npm run build`, `npx wrangler deploy` for production,
and `npx wrangler preview` for branch previews. Build caching is off so a clean
build must create the generated types directory before running TypeScript.
Previews expose a public health endpoint and run without production secrets,
OAuth, or a production D1 binding. Runtime secrets belong in the Worker's
**Settings → Variables and Secrets**.

The Worker restricts OAuth return targets to the Pages application, binds
OAuth state to the browser, uses PKCE, and requires a verified email on the
allow-list. A one-time handoff creates a partitioned HttpOnly cookie from the
Pages site after the redirect. Older browsers that block cross-site cookies
and lack partitioned-cookie support can use Direct mode. D1 enforces per-row
expiry at read or redemption, and the scheduled Worker prunes expired rows.
OAuth request traces and invocation logs are disabled to keep callback
parameters out of telemetry.

## OAuth handoff and production cutover

Keep the current Pages sync endpoint while completing these steps.

1. In Google Cloud Console, add
   `https://did-it-become-what-you-like.arthow4n.workers.dev/auth/google-drive/callback`
   to the authorized redirect URIs of the **existing Web OAuth client**. Keep the
   Pages JavaScript origin and the old redirect URI during the rollback window.
2. In the Cloudflare Worker, add `GOOGLE_CLIENT_SECRET` from the same OAuth
   client and `ALLOWED_GOOGLE_EMAILS` with the approved comma-separated account
   list. The Worker already has the existing public `GOOGLE_CLIENT_ID` and a
   randomly generated `ENCRYPTION_SECRET`. Keep the encryption key stable.
   `/health` should return `oauthConfigured: true` once the bindings are present.
3. Verify a real Google sign-in and sync from a clean browser profile before
   switching production. Use a local test build configured for the Worker and
   routed at the existing Pages origin in a disposable browser profile, or
   use the candidate Pages artifact at that origin through browser interception.
   Complete consent in the same tab. Check token refresh after reload, a
   pull/push against a designated test Drive account, logout, and rejection of
   an unapproved account. Check Direct mode with the existing client ID.
4. Once verified, set the frontend default in
   `src/features/sync-runtime/drive-config.ts` to `WORKER_SYNC_SERVER_URL`.
   Set the Pages Actions variable `VITE_SYNC_SERVER_URL` to that same Worker
   URL, or remove the override so the repo default is used. If the integration
   cannot edit Actions variables, remove only the URL override from the Pages
   workflow in the cutover change. Publish through the normal Pages workflow
   and verify the hosted PWA, the service worker update, and both sync modes.

The Worker uses a different hostname, so a session cookie issued by the
previous backend cannot accompany requests to the Worker. No sessions or
refresh tokens were copied from the old store. After cutover, each Persisted
user reconnects once. The app recognizes the old built-in URL in saved
settings and selects the new default when production is switched. Custom
server settings and Direct mode are preserved. Reconnecting requires no
browser-storage reset or Drive data deletion.

Leave the old backend and database intact through verification and the
rollback window. If the release must be rolled back, restore the previous
Pages commit and previous URL override and redeploy through the Pages workflow.
Any auto-deployment attached to the old backend should be detached or pinned
before publishing the migration to `master`, so the old URL remains available
for rollback. Decommission the old deployment separately after a successful
cutover.

[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) ·
[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) ·
[Workers Previews](https://developers.cloudflare.com/workers/previews/configuration/)

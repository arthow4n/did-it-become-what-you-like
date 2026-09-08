# GitHub Pages deployment operations

This repository publishes a static PWA from `master` to the standard Pages URL:

<https://arthow4n.github.io/did-it-become-what-you-like/>

## CI/CD deployment boundary

CI is the automated quality authority for every push and pull request. The Pages
workflow is the deployment authority for pushes to `master`: it checks out the
exact pushed commit, runs `deno task verify`, and uploads the resulting `dist/`
artifact before the separate deploy job runs. There is no separate local release
gate or manual artifact handoff.

The CI quality gate is `deno task verify`, defined in `AGENTS.md`. Browser E2E
and gallery verification are separate, risk-selected checks; they are not
implied by that command.

The deploy job has only Pages write and OIDC token permissions; it does not
rebuild source or accept a local directory. No credentials are required by CI.

`deno task release:verify` must run after `deno task build`. It verifies the
repository-relative artifact paths, hash-route shell fallback, CSP allowlist,
manifest and service-worker scope, dark metadata, injected version and short
commit, source and notice links, license files, SHA-256 provenance lines, and
secret-like content absence.

The About screen is the user-facing provenance surface: it shows version
`0.1.0`, the short Git commit, the exact generative-AI disclosure, license and
third-party notice links, and the repository source link.

## Google Drive synchronization modes

The application supports two independent Google Drive connection flows:

1. **Persisted connection (Server-backed)**:
   - Uses a Deno Deploy backend server (`server/main.ts`) backed by Deno KV.
   - Securely stores AES-GCM encrypted OAuth refresh tokens on the server and issues `HttpOnly; Secure; SameSite=None; Partitioned` session cookies to the browser.
   - Persists connection across app and browser restarts without requiring reconnect clicks.
   - **Enables automatic background synchronization**: Automatically triggers sync when the app is launched/foregrounded (`visibilitychange` to visible) and minimized/closed (`visibilitychange` to hidden).
   - Enforces an **authorized user allow-list** (`ALLOWED_GOOGLE_EMAILS`); unlisted accounts receive a clear "Access Denied" error notice.

2. **Direct connection (In-browser GIS)**:
   - Uses Google Identity Services directly in the browser client.
   - Access tokens are held in browser memory only and discarded when the tab or PWA closes.
   - Manual, on-demand synchronization only (no automatic lifecycle-based sync).
   - Requires clicking Reconnect when returning after app closure.

---

## Google Cloud Console OAuth setup

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or select your project.
2. Under **APIs & Services → Library**, enable the **Google Drive API**.
3. Under **APIs & Services → OAuth consent screen**:
   - Set user type (e.g. External or Internal).
   - Configure app name and developer contact email.
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.appdata` (access to app's private configuration folder)
     - `https://www.googleapis.com/auth/userinfo.email` (read user's email for allow-list verification)
   - If the publishing status is "Testing", add your authorized Google account(s) under **Test users**.
4. Under **APIs & Services → Credentials**, create credentials of type **OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**:
     - `https://arthow4n.github.io` (your production frontend origin)
     - `http://localhost:5173` (optional, for local Vite development)
   - **Authorized redirect URIs**:
     - `https://<your-sync-project>.deno.dev/auth/google-drive/callback` (your Deno Deploy server callback URL)
     - `http://localhost:8000/auth/google-drive/callback` (optional, for local Deno server development)
5. Save the generated **Client ID** and **Client Secret**.

---

## Deno Deploy backend setup (for Persisted mode)

1. Sign in to [Deno Deploy](https://dash.deno.com/) and create a new project.
2. Link your GitHub repository and select `server/main.ts` as the entrypoint.
3. Under your project settings, ensure **Deno KV** is enabled (Deno Deploy includes built-in KV storage).
4. Configure the following **Environment Variables** in the Deno Deploy dashboard:
   - `GOOGLE_CLIENT_ID`: The Google OAuth Client ID created above.
   - `GOOGLE_CLIENT_SECRET`: The Google OAuth Client Secret created above.
   - `ALLOWED_GOOGLE_EMAILS`: Comma-separated list of allowed Google account emails (e.g. `owner@example.com,spouse@example.com`). If an unlisted user attempts to log in, authorization is blocked with an explicit 403 "Access Denied" message.
   - `ENCRYPTION_SECRET`: A high-entropy random string (at least 32 characters) used for AES-GCM 256-bit refresh token encryption.
   - `FRONTEND_ORIGIN`: The origin of your frontend app (e.g. `https://arthow4n.github.io` or `*`).
   - `SERVER_ORIGIN` *(optional)*: The public origin of your Deno Deploy project (e.g. `https://<your-sync-project>.deno.dev`). If omitted, it is inferred from incoming request URLs.

---

## Frontend build and deployment configuration

1. In your GitHub repository, open **Settings → Secrets and variables → Actions → Variables**:
   - `VITE_GOOGLE_CLIENT_ID`: The Google OAuth Client ID (used for Direct GIS connection).
   - `VITE_SYNC_SERVER_URL`: The URL of your Deno Deploy project, e.g. `https://<your-sync-project>.deno.dev` (used as the default server URL for Persisted connection).
2. Trigger the GitHub Pages deployment workflow.
3. In the deployed app:
   - Open **Settings → Google Drive and sync**.
   - Choose your preferred connection mode (**Persisted** or **Direct**).
   - If using **Persisted**, verify or customize the Sync Server URL and click **Connect Google Drive**.
   - If using **Direct**, click **Connect Google Drive** to initiate in-browser GIS consent.

## Local preflight

`deno task verify` is an optional local mirror of the CI quality gate, useful
before a final push or while diagnosing a CI failure. Passing it does not
release anything; the CI/CD workflows accept and deploy the pushed commit.

`deno task release:verify` is the built-artifact portion of that gate and must
follow `deno task build` when run by itself. Do not commit `dist/`, browser
profiles, screenshots, traces, or other generated artifacts.

## Hosted smoke and rollback

After the integration owner pushes the reviewed commit, confirm the Pages
workflow succeeds and record its deployed commit. Smoke the hosted base path and
a nested hash route refresh, then check manifest/service-worker scope, offline
relaunch, and an update-ready reload with no unsaved form. These are live checks
and cannot be claimed from a local build.

If a published release is defective, stop further release pushes, identify the
last known-good commit and its successful Pages run, then revert the faulty
release on `master` and push the revert through the normal workflow. The
workflow rebuilds and re-verifies the reverted commit before publication. Do not
manually edit the Pages artifact or change the repository base path; the short
commit shown in About and the workflow run provide the rollback audit trail.

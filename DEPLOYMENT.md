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

## Google Drive OAuth configuration

Configure the public Google OAuth client ID before testing Drive on Pages:

1. In Google Cloud Console, select the app project and enable the Google Drive
   API.
2. Configure the OAuth consent screen. If the app is in Testing, add the Google
   account used for the smoke test as a test user.
3. Create an OAuth client ID with application type **Web application**.
4. Add `https://arthow4n.github.io` as an authorized JavaScript origin. Do not
   add the repository path.
5. In GitHub, open **Settings → Secrets and variables → Actions → Variables**,
   create `VITE_GOOGLE_CLIENT_ID`, and paste the client ID value. This client ID
   is public; do not create or store a client secret for this static app.
6. Run the Pages workflow, open the deployed app, and use **Settings → Google
   Drive and sync → Connect Google Drive**.

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

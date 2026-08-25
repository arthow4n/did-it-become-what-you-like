# GitHub Pages release operations

This repository publishes a static PWA from `master` to the standard Pages URL:

<https://arthow4n.github.io/did-it-become-what-you-like/>

## Release boundary

The Pages workflow checks out the exact pushed commit, runs the required Deno
validation and production build, verifies the resulting `dist/` artifact, and
uploads that artifact before the separate deploy job runs. The deploy job has
only Pages write and OIDC token permissions; it does not rebuild source or
accept a local directory. No credentials are required by CI.

`deno task release:verify` must run after `deno task build`. It verifies the
repository-relative artifact paths, hash-route shell fallback, manifest and
service-worker scope, dark metadata, injected version and short commit, source
and notice links, exact disclosure, license files, SHA-256 provenance lines, and
secret-like content absence. `deno task verify:pages` remains the focused
base-path validator used by the workflow as an additional check.

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

## Local release checklist

Run from a clean checkout of the intended release commit:

```text
deno task fmt:check
deno task lint
deno task check
deno task test
deno task test:integration
deno task test:component
deno task test:domain
deno task test:actor
deno task test:e2e --grep local
deno task a11y:gallery
deno task browser:verify
deno task verify:pages
deno task build
deno task release:verify
```

The canonical aggregate is `deno task verify`; the release-specific sequence is
`deno task build && deno task release:verify`. Do not commit `dist/`, browser
profiles, screenshots, traces, or other generated artifacts.

## Hosted smoke and rollback

After the integration owner pushes the reviewed commit, confirm the workflow run
succeeds and record its deployed commit. Smoke the hosted base path and a nested
hash route refresh, then check manifest/service-worker scope, offline relaunch,
and an update-ready reload with no unsaved form. These are live checks and
cannot be claimed from a local build.

If a published release is defective, stop further release pushes, identify the
last known-good commit and its successful Pages run, then revert the faulty
release on `master` and push the revert through the normal workflow. The
workflow rebuilds and re-verifies the reverted commit before publication. Do not
manually edit the Pages artifact or change the repository base path; the short
commit shown in About and the workflow run provide the rollback audit trail.

# Dibwyl (Did It Become What You Like?)

A local-first expense app that works offline.

## Generative AI Usage Disclosure

- **Code**: This application is 100% vibe-coded using ChatGPT Codex and Google
  Antigravity.
- **Brand Artwork & Icon**: The application icon
  ([`assets/brand/icon-source.png`](assets/brand/icon-source.png)) was generated
  by ChatGPT (ChatGPT Image 2.5).

## Build and source metadata

- Name: `Dibwyl · Expenses`
- Short Name: `Dibwyl`
- Full Title: `Did It Become What You Like?`
- Version: `0.1.0`
- Build: the short Git commit is injected into production builds and shown in
  About.
- Source: <https://github.com/arthow4n/did-it-become-what-you-like>

## License and third-party notices

The application is released under the [MIT License](LICENSE). Third-party
dependency licenses and notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## React Compiler

React 19 does not enable automatic memoization by itself. Both Vite
configurations use the shared stable React Compiler integration in
`scripts/react-compiler.ts`. It compiles project-owned React components and
hooks, excludes dependencies and tests, and uses React 19's built-in compiler
runtime. Build output reports how many functions compiled and why others were
safely skipped.

Existing memoization and XState selectors remain in place. Some screens
currently skip compilation because they access refs during render or use
unsupported compiler syntax; the compiler keeps their original behavior. The
Organize screen's conditional-hook diagnostic has been fixed. Compiler coverage
is not a claim that storage, subscriptions, or first-mount work has become free.

`deno task test` includes a compiler integration test that transforms real UI
source and executes a compiled component to verify actor updates and reuse of
unchanged child JSX. Ordinary Deno component tests run source code directly;
compiled app behavior is additionally checked in the gallery and browser
journeys.

## Release operations

GitHub Pages deploys the CI-verified `dist/` artifact from `master` at
<https://arthow4n.github.io/did-it-become-what-you-like/>. Release checks bind
the artifact to the pushed commit. See [DEPLOYMENT.md](DEPLOYMENT.md) for the
deployment boundary, hosted smoke checks, and rollback procedure.

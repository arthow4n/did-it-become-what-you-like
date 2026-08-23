# F-005 visual/browser tooling decision

## Pinned pair

The separate visual inspection path uses the native Rust agent-browser release
0.16.2 and Chrome for Testing stable 152.0.7977.54. The installer downloads only
the reviewed official release/storage URLs in scripts/browser/metadata.ts,
verifies SHA-256 before renaming any artifact, and extracts the verified Chrome
archive without invoking a package manager.

The current metadata covers four supported native pairs: Linux x64, macOS
x64/arm64, and Windows x64. Linux ARM64 is unavailable: the available Chrome for
Testing artifact is x64, and no emulation path has been verified. Linux aarch64,
Windows ARM64, and other operating-system/architecture pairs are explicit
unsupported-platform results that fail nonzero.

## Ownership boundary

Playwright remains the pass/fail E2E runner under deno task test:e2e. deno task
browser:verify invokes the installed native binary separately and performs a
synthetic screenshot, accessibility-tree snapshot, and in-page axe smoke. Its
screenshot, profile, and trace are ignored artifacts. No credentials, user data,
or application data are used.

The visual smoke is intentionally a tooling fixture until product screens exist.
It does not claim screen acceptance, cross-browser coverage, hosted Pages
behavior, or mobile-device behavior.

## Platform evidence

- The metadata hashes were computed from the pinned official artifacts for all
  four supported platform keys.
- The install/visual command reports the exact Deno.build.os and Deno.build.arch
  pair on failure and exits nonzero; it never reports a successful smoke when
  the platform or native binary is unavailable.
- Live iOS Safari, Android Chrome, latest-two browser policy, hosted Pages, and
  system-level Linux dependency installation remain manual or later-gate checks.
  They are not represented as passing by this verifier.

# F-001 Toolchain Compatibility Decision

## Decision

Use Deno 2 as the only project command runner and dependency manager. Pin
browser and test dependencies in `deno.json` imports and `deno.lock`. Use
TypeScript 7.0.2's `tsc` executable as the canonical strict checker, invoked
through `deno task check`.

The selected browser path is Vite 8.2.2 with `@vitejs/plugin-react` 6.1.0 and
`vite-plugin-pwa` 1.3.0. The selected E2E dependency is Playwright Test 1.62.1,
invoked with `deno x` from `deno task`; its Chromium installation is also
performed by a Deno task. No `package.json`, npm script, npm lockfile, or Node
project toolchain is used.

## Pinned direct dependencies

| Capability              | Pin                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| TypeScript              | `npm:typescript@7.0.2`                                                                          |
| React / React DOM       | `npm:react@19.2.8`, `npm:react-dom@19.2.8`                                                      |
| XState / React binding  | `npm:xstate@5.32.5`, `npm:@xstate/react@6.1.0`                                                  |
| React Aria Components   | `npm:react-aria-components@1.20.0`                                                              |
| Lucide                  | `npm:lucide-react@1.33.0`                                                                       |
| Runtime validation      | `npm:zod@4.4.3`                                                                                 |
| Arbitrary precision     | `npm:big.js@7.0.1` with `@types/big.js@7.0.0`                                                   |
| Browser build           | `npm:vite@8.2.2`, `npm:@vitejs/plugin-react@6.1.0`                                              |
| PWA build               | `npm:vite-plugin-pwa@1.3.0`                                                                     |
| Component tests         | `npm:@testing-library/react@16.3.2`, `npm:@testing-library/dom@10.4.1`, `npm:happy-dom@20.11.6` |
| Browser E2E             | `npm:@playwright/test@1.62.1`                                                                   |
| React type declarations | `@types/react@19.2.18`, `@types/react-dom@19.2.4`                                               |

All resolved transitive versions and integrity hashes are recorded in
`deno.lock`. The lock is frozen in the committed configuration. Deno's
`nodeModulesDir: "auto"` is required because TypeScript 7's filesystem-based
module resolver and Vite need Deno-managed npm package links. The generated
`node_modules/` directory is ignored and is never committed; it is created by
`deno install`, not by npm.

## Compatibility evidence

`deno task verify:toolchain` is the self-contained gate. It runs the following
proofs and fails on any unexpected result:

- TypeScript 7.0.2 reports its version, compiles the strict success fixture, and
  rejects `strict-failure.ts` with `TS2322`.
- `deno task test` runs the XState v5 actor transition and a React Testing
  Library/happy-dom component test. The component renders React Aria's Button,
  finds it by accessible role/name, and verifies its press event changes the
  actor-backed count. Zod 4 and big.js are exercised in the same test suite.
- `deno task build` runs Vite and the PWA plugin. The output contains the
  browser bundle, `manifest.webmanifest`, `registerSW.js`, and a generated
  service worker.
- `deno task browser:install` invokes Playwright's official Chromium installer
  through `deno x`. `deno task test:e2e` invokes Playwright Test itself and runs
  `e2e/smoke.spec.ts`, which renders one page, queries its heading/button by
  role, clicks the button, and asserts the result. The runner is configured for
  deterministic single-worker execution and retains a trace on failure.

The installed browser is an external Playwright cache artifact. It is not a
Node/npm project dependency and is not stored in this worktree.

## Deno checker boundary

The canonical `deno task check` intentionally invokes TypeScript 7. Deno's
built-in checker was also probed, but this dependency graph causes its current
checker to report `TS2502` inside the transitive `@types/node` crypto global
declaration. It is therefore not exposed as a competing check command; the
required TypeScript 7 task passes the complete proof graph. This is a checker
compatibility boundary, not a runtime failure.

## F-004 consumption contract

F-004 should preserve these command names and use them as the foundation when
the real application replaces the spike paths:

```text
deno task fmt:check
deno task lint
deno task check
deno task test
deno task test:e2e
deno task build
```

The F-001 `verify:toolchain` runner is disposable proof infrastructure. F-004
should retain the exact TypeScript 7 invocation and lock policy, move the
production build/test entrypoints to their final paths, and keep Playwright
outside the `agent-browser` visual/a11y workflow. No credentials are read or
written by any proof.

# Q-602 E2E journey inventory

This is the tracked Q-602 boundary record. The product suite contains exactly
five approved browser journeys. Each journey proves only the browser UI, actor,
and adapter seam which lower-layer tests cannot establish. Domain merge
schedules, actor guards, retry matrices, causal replay, and adapter conflict
combinations remain covered by their unit/actor/integration suites.

| ID                    | Product journey and boundary                                                                                                           | Risk-selected viewport                                                          | Evidence in this suite           | Why it is included                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local-first-manual`  | First local project and manual expense save; browser UI → shell/manual actor → local repository                                        | `390x844` for the normal phone flow; `320x568` for the null-draft recovery seam | `e2e/local-first-manual.spec.ts` | Proves first-use navigation, mobile add/manual entry, local save, reload persistence, save-and-add-another, and actionable draft recovery.                                              |
| `receipt-review`      | Receipt capture, fake Gemini request/review/save; browser UI → receipt actor → intercepted Gemini HTTP boundary                        | `390x844`                                                                       | `e2e/receipt-review.spec.ts`     | Proves the mobile image/file lifecycle, explicit disclosure/key setup, model selection, typed failure rendering, request allowlist, ephemeral cleanup, review, and atomic browser save. |
| `drive-reconnect`     | Drive authorization, visible sync, account switch, disconnect/reconnect; browser UI → sync actor → injected fake Drive boundary        | `1280x800`                                                                      | `e2e/sync-portability.spec.ts`   | Proves the desktop settings route and reconnect seam without re-testing causal schedules, retries, or transport permutations.                                                           |
| `conflict-resolution` | Conflict candidate review and local resolution; browser UI → conflict actor → injected fake Drive/conflict boundary → local commit     | `1280x800`                                                                      | `e2e/sync-portability.spec.ts`   | Proves routed conflict presentation, neutral candidate selection, local completion, and global-banner clearing after the commit. Merge semantics stay below E2E.                        |
| `offline-update`      | Offline local launch/status and update recovery with dirty-input protection; browser UI → PWA/update actor → browser platform boundary | `390x844`                                                                       | `e2e/offline-update.spec.ts`     | Proves the compact mobile offline/update state, install fallback, explicit update readiness, and prevention of reload while dirty.                                                      |

## Support and seam coverage (not additional product journeys)

These tests are deliberately retained because they protect integration seams
needed by the five journeys. They are not counted in the inventory above:

- `e2e/local-first-manual.spec.ts` — `local-first-null-draft` is a failure and
  recovery path of the local manual journey, not a separate product flow.
- `e2e/dirty-history-preferences.spec.ts` — approved dirty-navigation coverage
  for manual, receipt, browser history, and Preferences exits. It is a focused
  seam and not a sixth product journey.
- `e2e/support/journey-boundaries.spec.ts` — support-contract assertion that the
  inventory exposes five IDs.
- `spikes/toolchain/e2e/smoke.spec.ts` — foundation Playwright smoke proof,
  outside the application journey inventory.

## Isolation, fake-service, and artifact rules

- Every test uses the repository-owned isolated browser-state fixture and a
  fresh browser context. The context blocks all non-local HTTP(S) requests; the
  receipt test explicitly intercepts the Gemini hostname, and Drive/PWA tests
  inject deterministic browser-only boundaries. No live credentials or external
  service call is permitted.
- Values in the suite are synthetic (`e2e-test-placeholder`, fake account
  identities, and generated fixture records). Receipt images are one-pixel
  fixtures. The API key is never asserted as a real credential and is excluded
  from request bodies by the test.
- On a failing test, the custom context retains a Playwright trace, full-page
  screenshots, and a redacted JSON failure manifest under the ignored
  `.e2e-artifacts/playwright` output tree. Passing tests retain no custom trace.
- Playwright remains the pass/fail runner. `agent-browser` visual and
  accessibility inspection remains a separate Q-601/Q-603 responsibility.

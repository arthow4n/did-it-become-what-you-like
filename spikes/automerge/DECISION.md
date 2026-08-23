# F-002 Automerge and IndexedDB compatibility decision

Status: compatibility proof complete for the current Deno environment. The proof
uses only deterministic synthetic data and has no credentials or live Drive
calls.

## Decision

Use Automerge as the provisional causal document engine:

- `@automerge/automerge` **3.4.1**, the current stable npm release observed on
  2026-08-23. Its release metadata reports JS/WASM git head
  `8d7b12f8da553afbb325e37a6c66942b8dd4d994`.
- `@automerge/automerge-repo` **2.6.0-alpha.3** and
  `@automerge/automerge-repo-storage-indexeddb` **2.6.0-alpha.3**, the current
  npm `latest` tags observed on 2026-08-23. The repository layer is alpha and
  must be pinned and rechecked before production integration.

No second CRDT was evaluated. No required merge primitive failed the Automerge
proof.

## Chosen APIs and boundary

The core proof uses `init`, `clone`, `change`, `merge`, `getHeads`,
`getConflicts`, `getChanges`, `getAllChanges`, `applyChanges`, `getHistory`,
`save`, and `load`. The browser/repository fixture uses `Repo`, `DocHandle`,
`flush`, `shutdown`, and `IndexedDBStorageAdapter(database, store)`.

The proof keeps a synthetic operation log in the Automerge document. Each
operation has a stable operation ID, actor, parent operation IDs, Automerge base
heads, and (for resolutions) every conflicting parent ID. The operation log is
test scaffolding for the application-level conflict workflow; it is not a
replacement merge algorithm.

The export projection deliberately includes only the versioned record data,
generation, and tombstones. Automerge operation metadata and internal binary
history are excluded from the user-controlled JSON projection. A fake Drive
stores the Automerge binary and change batches separately to exercise the
transport boundary without credentials.

## Compatibility matrix

| Surface                        | Result                         | Evidence or limitation                                                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deno execution                 | PASS                           | Deno 2.9.5; direct runner imports and executes Automerge JS/WASM.                                                                                                                                                                                                                 |
| Automerge core                 | PASS                           | 3.4.1; release metadata is recorded above.                                                                                                                                                                                                                                        |
| Deno/browser bundle            | PASS with limitation           | `deno bundle --platform browser --no-check` produces a non-empty browser bundle for a fixture using the real `Repo` and `IndexedDBStorageAdapter` imports.                                                                                                                        |
| Browser bundle type-check      | UNAVAILABLE                    | `deno bundle --platform browser --check=all` fails before bundling because Deno 2.9.5 reports duplicate/incompatible `lib.dom` and `lib.deno.*` declarations and the repo CBOR declaration references Node `Buffer`. This is recorded evidence, not a suppressed functional test. |
| Native browser runtime         | UNAVAILABLE                    | No Chromium, Chrome, Firefox, or WebDriver binary is installed in this environment. The fixture was not falsely claimed to run in a browser.                                                                                                                                      |
| IndexedDB adapter              | PASS in Deno shim              | `IndexedDBStorageAdapter` is run against `fake-indexeddb`; the database is created under `did-it-become-what-you-like-f002-proof`, and a second `Repo` restores the document after shutdown. This is not a claim about every native browser engine.                               |
| Repository namespacing         | PASS                           | The production browser fixture uses the exact `did-it-become-what-you-like` database name; the Deno test adds the `-f002-proof` suffix to isolate the synthetic run while retaining the repository namespace.                                                                     |
| Stable IDs and decimal strings | PASS                           | Stable record IDs, canonical decimal strings, redundant zero normalization, and rejection of exponential/Number-like input.                                                                                                                                                       |
| Independent concurrent edits   | PASS                           | Different record fields survive `Automerge.merge` without an application conflict.                                                                                                                                                                                                |
| Same-field conflict            | PASS                           | `Automerge.getConflicts` exposes both category candidates; the synthetic conflict grouping is deterministic.                                                                                                                                                                      |
| Tombstones                     | PASS                           | Logical deletion keeps the record and tombstone operation ID through merge and export projection.                                                                                                                                                                                 |
| Delete versus edit             | PASS with application boundary | Automerge preserves both the tombstone and edited value, but does not report a native conflict because different fields were written. Causal operation metadata detects the required application conflict.                                                                        |
| Resolution revision            | PASS                           | A new Automerge change writes the chosen value, references both conflicting operation IDs, and clears the unresolved conflict.                                                                                                                                                    |
| Two-device convergence         | PASS                           | Merged projections and causal heads are equal regardless of merge direction.                                                                                                                                                                                                      |
| Offline replay                 | PASS                           | Fake Drive queues change batches; out-of-order replay with dependency buffering converges to the merged projection.                                                                                                                                                               |
| Generation retirement          | PASS                           | A retirement marker contains only generation metadata; an old device erases its local generation and is refused before upload, preventing resurrection.                                                                                                                           |
| Export projection              | PASS                           | Schema-versioned JSON projection round-trips records/tombstones and excludes operation metadata.                                                                                                                                                                                  |
| Fake Drive round trip          | PASS                           | `Automerge.save`/`load` binary round trip restores the same export projection.                                                                                                                                                                                                    |
| Randomized ordering            | PASS                           | Seed `20260823`, 32 rounds in the default runner; each round shuffles changes and verifies projection plus causal-head convergence.                                                                                                                                               |

## Required primitive evidence

`verify.ts` runs twelve named checks:

1. stable IDs and decimal strings;
2. concurrent independent edits;
3. same-field conflicts;
4. tombstones;
5. delete-versus-edit;
6. resolution revisions;
7. two-device convergence and offline replay;
8. export projection and fake Drive round trip;
9. generation retirement preventing resurrection;
10. IndexedDB persistence and restart;
11. browser bundle; and
12. randomized operation ordering.

The runner accepts `--seed=<positive integer>` and
`--rounds=<positive integer>`. Its default seed is `20260823` and default run
count is 32. The operation ordering uses a recorded deterministic linear
congruential generator; Automerge itself retains dependency buffering when a
change arrives before its parent.

## Limitations to carry into production design

1. Automerge's native conflict inspection is field-level. A logical
   `deleted: true` tombstone and an edit to `amount` are different fields and
   therefore do not become a native `getConflicts` result. The production
   record/revision contract must retain enough causal operation ancestry to
   surface delete-versus-edit for explicit owner resolution, as this proof does.
2. `automerge-repo` and its IndexedDB adapter are currently alpha releases. The
   production task must pin the exact versions and rerun this gate when
   toolchain, browser, or repository dependencies change.
3. The Deno browser bundle currently requires `--no-check` because the
   dependency declaration graph conflicts with Deno's DOM libraries under
   `--check=all`. The standalone Deno type check of the fixture and runner
   passes. A future toolchain task should revisit browser bundle type-checking.
4. Native Chromium/Firefox/Safari execution was unavailable here. The fake
   IndexedDB run proves adapter calls and restart behavior against a compatible
   IndexedDB implementation, while the browser fixture proves importability and
   bundling; it does not replace the later native-browser verification gate.

## Reproduction commands

Run from the repository root:

```text
deno run -A spikes/automerge/verify.ts
deno run -A spikes/automerge/verify.ts --seed=20260823 --rounds=64
deno fmt --check spikes/automerge
deno lint spikes/automerge
deno check --config spikes/automerge/deno.json spikes/automerge/verify.ts spikes/automerge/browser-fixture.ts
git diff --check
```

The direct runner invokes the browser bundle proof internally. To inspect it
separately, write the output to a disposable path:

```text
deno bundle --config spikes/automerge/browser-deno.json --platform browser --no-check --output /tmp/f002-automerge-browser.js spikes/automerge/browser-fixture.ts
```

All test data is synthetic. No command requires credentials, a configured Google
account, or a live network transport.

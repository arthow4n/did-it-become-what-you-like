# Actor contract topology

The contract layer keeps finite workflow modes in XState states and tags. It
does not implement persistence, Google transport, Gemini, IndexedDB, React, or
screen markup. Later composition supplies the named actor ports with adapter
actors and supplies focused workflow actors to the shell.

```text
root-shell
├─ invokes restoreShell (device-local shell snapshot port)
├─ spawns one focused workflow actor for the active route
│  ├─ expenseFormMachine
│  │  └─ invokes commitExpense (local transaction port)
│  ├─ receiptScanMachine ── invokes scanReceipt + validateReceipt
│  ├─ receiptReviewMachine ── invokes commitReceipt (atomic local transaction)
│  ├─ projectMachine / categoryMachine ── invoke repository command ports
│  ├─ syncMachine ── invokes syncTransport
│  ├─ conflictMachine ── invokes commitResolution
│  ├─ importMachine ── invokes validate, pre-sync, and atomic commit ports
│  ├─ projectDeletionMachine ── invokes export and tombstone-commit ports
│  ├─ deleteEverywhereMachine ── invokes retirement, Drive-delete, and erase ports
│  └─ updateInstallMachine ── invokes browser install/update ports
└─ durableWorkflowMachine is the shared child boundary for draft persistence
```

## Ownership rules

- `rootShellMachine` owns boot restoration, route selection, connectivity
  presentation, and the active-workflow slot. It does not own expense data, sync
  records, conflict candidates, or destructive progress.
- A focused workflow owns its own cancellation, failure, retry, completion, and
  terminal output. Exiting an invoked child state cancels its in-flight port;
  the parent decides whether that means cancellation, retry, or navigation.
- `durableWorkflowMachine` owns draft lifecycle (`dirty`, `saving`, `persisted`,
  `clearing`, `error`) and exposes XState persisted snapshots. Save and discard
  clear the in-memory draft before invoking the typed `clearSnapshot` deletion
  port, so terminal snapshots cannot retain completed data. Consumers save
  `actor.getPersistedSnapshot()` and hydrate with
  `createActor(machine, { snapshot })`; they never reconstruct a state from
  context flags. L-201 supplies the actual IndexedDB implementation of both
  persistence and deletion boundaries.
- Receipt image handles are event/port inputs only. They are deliberately not
  fields in `receiptScanMachine` context, so they cannot leak into a persisted
  snapshot. Only validated structured review data may be durable.
- `syncMachine` can expose a conflict state while non-conflicting local work
  remains available. It never blocks the local transaction boundary.
- Import and Delete Everywhere own their destructive gates and cannot be
  silently started by ordinary synchronization.

## Port contract convention

Each named `invoke.src` is an explicit adapter boundary. Its input and output
are typed in `types.ts`; `ports.ts` supplies an unwired rejecting shell until a
later task injects a real implementation. Port errors are typed at the boundary,
retry/cancellation stays with the owning machine, and SDK/browser objects do not
cross into domain records or UI.

---
name: logic-audit-workflow
description: >-
  Standardized procedure for auditing XState state machines, React UI bindings,
  event handling completeness, transient state synchronization, and exit guard
  lifecycles across the application.
---

# Logic & State Machine Coupling Audit Workflow

This skill defines the standardized procedure for conducting deep logic audits
across XState v5 state machines (`src/actors/**`) and their integration with
React UI components (`src/features/**`). It provides a systematic inspection
framework to eliminate silent event drops, mount race conditions, unsaved change
leaks, and broken error-retry flows.

---

## 1. Core Principles & Governance

1. **Zero Silent Event Drops:** Every user-actionable control rendered on screen
   must correspond to a handled event in the actor's current state. No button
   click or form change should be silently swallowed because an actor is in an
   autosaving, persisting, loading, or failure state.
2. **Actor as Single Source of Truth:** React UI components must not maintain
   duplicate business state in local `useState` or `useRef` that drifts away
   from authoritative XState snapshots or tags (`dirty`, `saving`, `error`).
3. **Guarded Exit & Data Loss Protection:** Any screen allowing user input must
   correctly wire its dirty state to the root shell's `DirtyExitGuard`, support
   clean discard requests, and preserve target navigation intent upon discard.
4. **Non-Destructive Error Recovery:** Clicking "Retry" after a failure must
   retry the failed action or save attempt using the user's entered data; it
   must never reload old storage state to overwrite uncommitted user input.
5. **Continuous Workflow Durability:** Multi-step workflows (e.g. "Save and add
   another", step-by-step destruction) should execute within continuous actor
   lifecycles rather than abruptly unmounting and remounting machine instances
   mid-flight.

---

## 2. Four Core Audit Pillars

When auditing actors and their corresponding UI screens, evaluate against these
4 pillars:

### Pillar A: Event Handling Completeness & Transient States

- **Transient Autosave / Persistence States:** Inspect states like
  `persistingDraft`, `saving`, `mutating`, or `clearing`. Verify that concurrent
  user actions (e.g. clicking `Delete`, `Cancel`, or selecting a suggestion) are
  either explicitly queued, handled with an immediate transition, or disabled in
  the UI while busy.
- **Failure & Error States:** Inspect `failed`, `saveFailed`, `draftSaveFailed`,
  and `savedUndoFailed`. Ensure that field editing, line toggling, item removal,
  and merchant suggestion selection remain active while an error banner is
  visible.
- **Terminal States:** Verify that terminal states (`type: "final"`) are
  reserved strictly for completed workflows that tear down the view. Temporary
  states such as `notFound` or `cancelled` must remain restartable or reloadable
  if the actor instance remains mounted.
- **Dead-End Transitions:** Check all `always` transitions for unguarded or
  exhaustive fallbacks so an unexpected context value cannot halt the machine.

### Pillar B: React UI & State Machine Coupling

- **Mount & Hydration Race Conditions:** Trace component mount effects. Avoid
  dispatching multiple dependent events in the same render pass (e.g.
  `expense.hydrate` followed immediately by `expense.open`) where the second
  event arrives while the machine is busy hydrating and gets dropped.
- **Dual-State Synchronization:** Eliminate local component states that mirror
  actor context. When a child component mutates data, ensure the root shell
  context and actor snapshots update synchronously without risking stale state
  overwrites on subsequent background events (e.g. `shell.repository.refresh`).
- **Continuous Lifecycle vs. Remounting:** When an actor provides a built-in
  loop (e.g. `savingForAnother` -> `openingAnother`), let the machine transition
  internally instead of forcing React component remounts via key increments.

### Pillar C: Exit Guards, Draft Persistence & Navigation Intent

- **Full `DirtyExitGuard` Coverage:** Audit every create and edit screen
  (including project and category managers). Ensure each screen exposes
  `onDirtyChange`, tracks dirty status accurately from actor tags, and prevents
  unwarned navigation loss on tab switches and browser Back gestures.
- **Accurate Dirty Tags:** Staged changes that fail to commit must maintain
  their `dirty` status in the actor context and tags so exit guards remain
  active during retry.
- **Preserving Navigation Intent on Discard:** When discarding an uncommitted
  draft via `DirtyExitGuard`, ensure the discard callback completes the original
  navigation destination rather than hardcoding a redirect to `/expenses`.
- **Scoped Draft Storage Keys:** Ensure local storage draft keys distinguish
  between creating a new entity and editing an existing one to prevent stale
  draft leakage.

### Pillar D: Error Recovery & Retry Integrity

- **Preserving Staged Changes on Retry:** Verify that error retry actions (e.g.
  `preferences.retry`) re-execute the save mutation with current context rather
  than reloading initial storage state.
- **Multi-Step Step Resumption:** In multi-step sagas (e.g. `DeleteEverywhere`),
  ensure retry actions resume from the specific failed step rather than
  resetting to Step 1 and failing due to partially executed local database
  deletions.
- **Honest Destruction Status:** If local database erasure succeeds but a
  secondary cleanup step fails, cancelling must not mask that the local data was
  already permanently destroyed.

---

## 3. Standardized Audit Matrix Template

When reporting findings or authoring an audit review, structure findings using
this standard matrix format:

```markdown
| Machine / UI Area      | File & Line Location                | Pillar Category        | Severity | Description & Impact                             |
| :--------------------- | :---------------------------------- | :--------------------- | :------- | :----------------------------------------------- |
| `manualExpenseMachine` | `src/actors/manual-expense.ts:L847` | Pillar A (Events)      | Medium   | Delete dropped during draft persistence          |
| `ManualExpenseScreen`  | `src/features/local-ui.tsx:L2318`   | Pillar B (Coupling)    | High     | Mount effect race causes permanent loading state |
| `ProjectManagerScreen` | `src/features/local-ui.tsx:L1145`   | Pillar C (Exit Guards) | Medium   | Edits not connected to DirtyExitGuard            |
| `preferencesMachine`   | `src/actors/preferences.ts:L180`    | Pillar D (Recovery)    | High     | Retry resets staged time boundary                |
```

---

## 4. Integration with Milestone Planning

During milestone execution (as governed by `implementation-planning`):

1. **At Pre-Implementation Planning:** Review proposed actor machines against
   Pillars A–D before authoring UI components.
2. **At Milestone Review Gates (`R-xxx`):** Dispatch a read-only reviewer
   subagent equipped with this skill to audit all new and modified machines and
   bindings.
3. **In Regression Tests:** Every identified logical gap must be accompanied by
   a targeted XState actor test or component harness test proving the fix.

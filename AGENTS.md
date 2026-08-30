# Agent Instructions

## Communication

- The repo owner commonly prompts coding agents using voice dictation. Expect
  transcription errors, incorrect words, missing punctuation, repetitions, and
  incomplete phrasing.
- Infer the likely intention from context instead of treating obvious dictation
  errors as literal requirements.
- When wording is materially ambiguous, briefly recap what you understood and
  identify the uncertain part before proceeding. Ask for clarification only when
  different interpretations would meaningfully change the result.
- Keep questions and decision prompts in small, prioritized batches that are
  easy to read and answer in a terminal.
- When gathering requirements, normally ask no more than ten numbered questions
  in one batch. Use fewer when the topic benefits from a tighter exchange.
- Give each question a concise explanation, a short concrete example when it
  improves understanding, and a clearly labeled recommendation. Make it easy for
  the owner to answer by number or accept all recommendations at once.

## Git Workflow

- Automatically commit and push completed repository changes unless the repo
  owner says otherwise.
- Keep commits focused and use commit messages that describe the completed
  change.
- Any spec/impl plan/decision type of document deletion (archiving) should be
  committed with `[archive]` in the commit message.
- Never force-push or overwrite unrelated work to satisfy the automatic-push
  preference. Integrate concurrent remote changes safely.

## UI and Implementation Workflow

- Do not begin application implementation until the repo owner explicitly
  approves it. Requirements discussion, design-system definition, and milestone
  planning do not imply implementation approval.
- Finish and obtain approval for the relevant product requirements, screens,
  workflows, and cross-cutting states before selecting detailed UI styling.
- Before implementing or changing application UI, read `SPEC.md` and
  `DESIGN_SYSTEM.md`, then inspect the implemented shared components. Reuse its
  tokens, primitives, interaction patterns, and responsive rules instead of
  creating parallel one-off UI.
- When an approved pattern is missing, update the design system deliberately and
  keep its documentation, reusable component, and affected screens consistent.
- Create or amend `IMPLEMENTATION_PLAN.md` only when the repo owner explicitly
  asks to convert work into a planned milestone, or when carrying forward an
  already active approved milestone. Do not infer a plan from the size of a
  request, a UI audit, or ordinary implementation work.
- A planned milestone has dependency-ordered tasks, contract or acceptance
  gates, parallel ownership, or a resumable handoff need. Put its executable
  plan, orchestration procedure, task statuses, current checkpoint, review/fix
  loop, and resumable coding-agent prompt in the single
  `IMPLEMENTATION_PLAN.md` source of truth. Do not scatter live progress across
  several planning files.
- An ordinary focused fix is recorded by its commit, regression tests,
  validation evidence, and handoff. It must not create or update the plan unless
  it belongs to an active planned milestone.
- For an active planned milestone, an implementing or orchestrating agent must
  read the plan first, reconcile its checkpoint with the repository and test
  state, update it after every completed or blocked planned task, and resume
  from the next dependency-ready item. It must not treat a stale checklist as
  stronger evidence than the actual repository.
- Every planned milestone ends with a final/archive task. Keep only a concise
  released-baseline summary in the living plan and prune completed task matrices,
  temporary evidence, and other historical detail; Git history remains the
  durable record.
- After a rate limit, lost session, machine restart, or interrupted sub-agent
  involving an active planned milestone, follow its Interruption and Recovery
  Protocol before dispatching or editing. Audit `master`, its upstream, every
  branch and worktree, uncommitted changes, unpushed commits, recorded
  validations, and stale `IN_PROGRESS` ownership. Preserve all work and never
  guess that a task is complete merely because a commit or checklist entry
  exists.
- Context compaction alone does not require a full recovery audit when the same
  agent session continues, Git state is known and clean, no command or push was
  interrupted, and no active planned milestone has uncertain ownership. Confirm
  `git status --short --branch` and continue.
- Every implementation task must include and pass appropriate tests before it is
  marked complete. Prefer pure unit and XState actor tests for business rules
  and workflows, adapter integration tests for boundaries, and component tests
  for rendering, accessibility semantics, variants, and event wiring.
- Reuse centralized test infrastructure in `src/test-support/**` (such as
  `withComponentHarness`, `withAriaGlobals`, `settle()`, `waitForActorState()`,
  deterministic clock/ID factories, and canonical fake ports in
  `src/test-support/fakes/ports.ts`). Do not re-declare parallel fake ports,
  copy-paste inline window/DOM shims, or reimplement custom async event polling
  loops in individual test files.
- Use risk-based validation. For an ordinary change, format and lint the changed
  files, run `deno task test:affected`, run the narrowest additional check for
  effects Deno's import graph cannot see, and run `git diff --check`. Use
  `deno test --related=<path>` when validating a known source file directly.
- `deno test --changed` and `--related` select tests through the transitive
  module graph. They do not prove CSS, HTML, generated assets, service-worker
  behavior, build configuration, deployment configuration, or external browser
  journeys. Add only the explicit build, gallery, browser, integration, schema,
  Pages, CI, or E2E check which can detect the changed non-import behavior.
- Run the full `deno task verify` only at a final/release gate, after a
  cross-cutting dependency/toolchain/configuration change whose impact cannot be
  bounded reliably, or when CI exposes an unexpected broader failure. Do not run
  an umbrella command and then rerun its constituent suites against the same
  commit.
- Batch visual validation at the next named UI review checkpoint. Individual UI
  tasks run affected tests; perform an earlier targeted gallery or
  `agent-browser` check only when the task introduces or changes focus,
  overlays, navigation, responsive layout, or another visual behavior that
  cannot safely wait for the checkpoint.
- A reviewer may trust exact successful evidence recorded for the same commit
  and should rerun only risk-selected commands. Do not mechanically repeat the
  implementer's complete command matrix. After a fix, rerun affected validation;
  repeat a full gate only when shared or cross-cutting code changed.
- Record exact commands and results. An unsupported summary such as “tests pass”
  is not sufficient evidence, but evidence collection must not cause an
  otherwise identical command to be repeated without a stated risk reason.
- When running background commands or long test suites (such as `test:e2e` or
  full verification runs), expect them to take time. Never poll or loop on
  status synchronously without a timer or schedule rapid/short wakeup timers,
  which wastes massive amounts of tokens and context. The reactive system
  notifies the agent upon command completion; simply stop calling tools to end
  the turn and wait for the system notification. If a fallback timer is ever
  required, schedule a proper timer using a substantial duration or progressive
  backoff rather than continuous polling or fast fixed intervals.
- Trust subagents (such as code review or research agents) to complete their
  delegated work. Reviewers and researchers often perform extensive read-only
  analysis across many files, which naturally takes time. Never poll subagents
  frequently in tight loops or send rapid status check messages. The messaging
  system wakes the orchestrator automatically when a subagent reports back. If a
  liveness check or reminder is required, schedule a proper timer with a long,
  backed-off interval instead of continuously polling.
- Keep E2E coverage deliberately small and limited to critical journeys and
  browser-integration seams which unit, actor, and component tests cannot prove.
  Do not duplicate the same state-transition assertions at every test layer.
- A fake Drive E2E journey verifies only that the browser UI, actors, and
  adapter boundary are wired together. Test merge rules, retries, causal replay,
  and conflict combinations at the domain, actor, or adapter integration layer.
- UI interaction and state changes are immediate by default. Do not add
  decorative navigation, overlay, expansion, or layout animations. Motion is
  reserved for restrained functional progress feedback and must retain an
  equivalent static reduced-motion presentation.
- Git worktrees may be used for concurrent implementation agents when isolation
  materially reduces file collisions or integration risk. Do not create them for
  ordinary documentation, sequential work, or concurrency without genuinely
  independent dependency-ready tasks.
- When worktrees are used, the orchestration plan must assign disjoint
  ownership, name one integration owner, define merge and verification order,
  and preserve every unintegrated change. Never remove a worktree containing
  uncommitted or unmerged work.

### Design-system facade boundary

For the approved Mantine migration and all later design-system work:

1. Files under `src/features/**` and `src/app/**` must not import `@mantine/*`,
   `react-aria-components`, or another component library. They import only the
   repository design-system facade.
2. Public design-system types, props, refs, callback signatures, and exports
   must not expose Mantine-specific types or objects. Translate library events
   internally and retain product-oriented contracts such as `onPress`, `tone`,
   and repository variants unless a reviewed contract change is unavoidable.
3. Semantic After Midnight tokens remain the visual source of truth. Map them
   into `MantineProvider` and component defaults; do not replace them with raw
   Mantine palette indexes in feature code.
4. Screens may not use Mantine `styles`, `classNames`, CSS selectors, or
   provider APIs. Library-specific customization stays inside
   `src/design-system/**`.
5. XState actors remain the authority for durable form and workflow state.
   Mantine may own ephemeral component interaction state, but Mantine Form is
   not introduced as a second business-state layer.
6. Prefer Mantine's documented `DateInput`, `TimeInput`, and `FileInput` or
   `Dropzone` components behind the facade when their value, keyboard,
   accessibility, and capture contracts are compatible. Preserve native date,
   time, file, and camera behavior as the explicit fallback where a Mantine
   wrapper cannot preserve it; all variants use the same facade-level field
   contract.
7. Product/domain composites such as expense, receipt, conflict, sync,
   destructive, and Gemini patterns remain repository-owned compositions. They
   are assembled from facade primitives backed by Mantine rather than copied
   library internals.
8. Do not copy Mantine source into the repository. Prefer public, documented
   Mantine APIs and pin all dependencies through `deno.json`/`deno.lock`.
9. Ordinary interaction and layout transitions remain `0ms`; only approved
   functional progress motion is allowed, with equivalent reduced-motion
   feedback.
10. A facade contract may change only after an impact inventory identifies all
    consumers and tests. When the change belongs to an active planned milestone,
    record it in `IMPLEMENTATION_PLAN.md` and obtain the preceding or immediately
    following review-gate approval; otherwise record the inventory and approval
    in the focused change evidence.

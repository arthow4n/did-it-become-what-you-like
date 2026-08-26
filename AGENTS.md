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
- Before implementing or changing application UI, read `UI_SPEC.md` and
  `DESIGN_SYSTEM.md`, then inspect the implemented shared components. Reuse its
  tokens, primitives, interaction patterns, and responsive rules instead of
  creating parallel one-off UI.
- When an approved pattern is missing, update the design system deliberately and
  keep its documentation, reusable component, and affected screens consistent.
- After the design system is approved and before implementation, create a
  dependency-ordered milestone plan. Identify foundational prerequisites,
  acceptance and verification gates, and workstreams which can safely proceed in
  parallel without inventing conflicting interfaces or data contracts.
- Put that executable plan, orchestration procedure, task statuses, current
  checkpoint, review/fix loop, and resumable coding-agent prompt in the single
  `IMPLEMENTATION_PLAN.md` source of truth. Do not scatter live progress across
  several planning files.
- Once `IMPLEMENTATION_PLAN.md` exists, an implementing or orchestrating agent
  must read it first, reconcile its checkpoint with the repository and test
  state, update it after every completed or blocked task, and resume from the
  next dependency-ready item. It must not treat a stale checklist as stronger
  evidence than the actual repository.
- After a rate limit, lost session, machine restart, or interrupted sub-agent,
  follow the Interruption and Recovery Protocol in `IMPLEMENTATION_PLAN.md`
  before dispatching or editing. Audit `master`, its upstream, every branch and
  worktree, uncommitted changes, unpushed commits, recorded validations, and
  stale `IN_PROGRESS` ownership. Preserve all work and never guess that a task
  is complete merely because a commit or checklist entry exists.
- Every implementation task must include and pass its appropriate tests before
  it is marked complete. Prefer pure unit tests and XState actor/machine tests
  for business rules and workflows; use component unit tests for rendering,
  accessibility semantics, variants, and event wiring.
- Before committing any implementation change, run `deno task fmt:check`,
  `deno task lint`, `deno task check`, and every test command relevant to the
  changed scope. Also run `deno task build` whenever production source,
  dependencies, build configuration, routing, PWA behavior, or generated assets
  changed. Do not commit while a required validation is failing.
- Layer-specific pre-commit validation is additive: domain/actor work runs its
  focused unit or actor tests; adapters and persistence run their integration
  tests; components and screens run component/accessibility tests; and changes
  affecting an approved browser journey run its focused E2E test. UI work also
  receives the specified `agent-browser` inspection before its task is complete.
- Sub-agents must report the exact validation commands and results with their
  handoff. An unsupported summary such as “tests pass” is not sufficient
  evidence for integration.
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

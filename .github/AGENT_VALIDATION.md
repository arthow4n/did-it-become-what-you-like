# Remote agent validation

When the coding sandbox cannot run a required Deno command, use GitHub Actions
as a remote executor. Do not treat a blocked local command as passing. Choose the
narrowest profile that covers the change; import-graph tests do not cover CSS,
HTML, build/deployment configuration, or browser integration.

## Request a run without a PR (preferred)

1. Work on a branch named `agent-validation/<profile>/<task>`, for example
   `agent-validation/affected/fix-total`. Commit and push normally. Every push
   runs the selected profile against that exact pushed SHA; no PR is required.
2. Use `affected`, `build`, `full`, `e2e`, or `gallery` as the profile segment.
   To select another profile for the same commit, push it to another validation
   branch, for example `git push origin HEAD:agent-validation/build/fix-total`.
3. Find the **Agent validation** run in Actions or list workflow runs by the
   pushed SHA. Inspect the resolver's frozen head/base/profile and the execution
   job's commands and conclusion. The comparison base is the default branch's
   SHA at resolution time. A superseded branch-head request is rejected.
4. Record the run URL, tested SHA, base SHA, profile, exact commands, and outcome.
   Queued, skipped, cancelled, timed-out, rejected, or missing runs are not passes.
   After fixes, push a new commit and validate that SHA. Wait with substantial
   backoff or a completion notification rather than rapid polling.

After installation on the default branch, **Actions → Agent validation → Run
workflow** can validate any same-repository branch: select the default branch
as the workflow definition and enter `branch`, `profile`, and its exact `sha`.
This manual route also requires no PR. Prefer it when the environment can
invoke workflow dispatch; branch pushes work with the GitHub connector too.

## Optional PR comment route

On an open same-repository PR, post a new comment:
`/ci affected <40-character-head-sha>` (replace the placeholder).
The listener becomes active after merge into the default branch. Editing an
existing comment does not retrigger it. Find the run by PR/comment in Actions;
issue-comment runs have the default branch as their own `head_sha`, not the
PR SHA. Read the frozen SHA from the resolver and validation job instead.
Changes to this workflow or its tests also run `affected` on PRs before merge.

If the environment cannot push/dispatch or read Actions results, report that
specific blocker and required command rather than claiming validation.

## Profiles

All profiles verify the checkout SHA and run `git diff --check` from the frozen
base/head merge-base. Exact commands are logged by the execution step.

| Profile | Commands |
| --- | --- |
| `affected` | `deno task fmt:check`, `deno task lint`, `deno test --allow-read --allow-write --allow-run --allow-env --changed=<base-sha>` |
| `build` | `deno task typecheck`, `deno task build`, `deno task release:verify` |
| `full` | `deno task verify` |
| `e2e` | Install Playwright Chromium with OS dependencies, then `deno task test:e2e` |
| `gallery` | Install Chromium OS dependencies, then `deno task gallery:verify` (builds the gallery and installs its pinned browser itself) |

Unlike the local `test:affected` task, the remote test command explicitly supplies
the frozen comparison base SHA to `--changed`. A clean checkout without that reference
would not select the branch's committed changes. Zero selected tests are possible
for non-module edits and are not proof of their behavior: select additional
checks according to risk. Browser outputs remain in the job workspace; this
workflow does not publish screenshots, traces, or application artifacts.

## Trust and final acceptance

Comment and manual requests require current repository write, maintain, or admin
permission. Push requests rely on GitHub repository push permissions.
Branch requests need no PR. PR requests require an open same-repository PR.
The requested SHA must match the current head at resolution time. Fork PR
commands are rejected. API errors fail
closed. Profiles accept no arbitrary commands, paths, or shell fragments.

Authorization runs in a separate job without checking out PR code. The execution
job has only read permissions, no configured secrets or deployment environment,
and checkout credential persistence disabled. Use GitHub-hosted disposable
runners. Do not add write tokens or secrets to this job. The PR code still runs
with normal hosted-runner capabilities; this workflow is not a stronger sandbox
for malicious code.

A new request cancels older execution for the same branch-or-PR/profile. Evidence belongs
to the frozen SHA/base and never automatically transfers to a later revision.
The workflow uses normal failure status; it does not mask failures to mute alerts.
Results live in Actions logs and summaries without automatic PR comment replies.

Ordinary draft PRs use on-demand profiles. CI runs full `deno task verify` when a
PR opens ready for review, becomes ready, reopens, or receives new commits while
ready. Ordinary branch pushes retain full CI. Validation branches skip that duplicate
full run and execute only their selected profile. The Pages deployment quality gate is
unchanged. Before final acceptance, inspect the successful full CI result for
the current revision (or run the `full` profile when working without a PR); lightweight validation is not a release gate.

## Notifications

GitHub's documented Actions notification settings are account-wide, not per
workflow. Under https://github.com/settings/notifications → System → Actions,
choose failure-only notifications or disable Actions notifications entirely;
these choices affect other workflows too.

To silence only this workflow's emails, create an email rule using an actual
notification: match GitHub's sender, this repository, and the exact workflow
name `Agent validation`, then archive or mark read. Preview the matches before
enabling it so CI/deployment alerts remain visible. This does not suppress
GitHub's web notifications. There is no workflow YAML notification-off setting.

References:
- https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications
- https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs

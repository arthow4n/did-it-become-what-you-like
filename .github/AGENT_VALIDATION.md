# Remote agent validation

When the coding sandbox cannot run a required Deno command, use GitHub Actions
as a remote executor. Do not treat a blocked local command as passing. Choose the
narrowest profile that covers the change; import-graph tests do not cover CSS,
HTML, build/deployment configuration, or browser integration.

## Request a run

1. Commit and push to a branch, then open or reuse a draft PR in this repository.
2. Obtain the full current PR head SHA. Post a new PR conversation comment:
   `/ci affected <40-character-head-sha>` (replace the placeholder).
3. Open **Actions → Agent validation** and find the run for that PR/comment.
   Inspect the `resolve` job for the frozen head/base/profile, then the
   `validate` job for actual commands and results. Use the Actions run/jobs/logs
   API when available. The issue-comment run's own `head_sha` refers to the
   default branch, so do not discover these runs only by the tested commit SHA.
4. Record the run URL, tested SHA, base SHA, profile, exact commands, and outcome.
   A queued, skipped, cancelled, timed-out, rejected, or missing run is not a pass.
   Check the current PR head again before claiming the evidence covers it.
5. On failure, read the failing step's logs, fix the cause, push a new commit,
   and request the narrowest appropriate profile for the new SHA. Avoid repeating
   an umbrella suite and its constituents against the same revision. Wait with
   substantial backoff or a completion notification; do not poll rapidly.

The comment listener becomes available after this workflow is merged into the
default branch. Changes to the runner workflow/tests automatically exercise
`affected` on same-repository PRs before merge. For manual invocation after
installation, **Actions → Agent validation → Run workflow** accepts `pr`,
`profile`, and `sha`; select the default branch for the workflow definition.
Editing an existing comment does not trigger another run; post a new request.

If the environment cannot push, comment, or read Actions results, report that
specific blocker and the required command rather than claiming validation.

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
the frozen PR base SHA to `--changed`. A clean checkout without that reference
would not select the PR's committed changes. Zero selected tests are possible
for non-module edits and are not proof of their behavior: select additional
checks according to risk. Browser outputs remain in the job workspace; this
workflow does not publish screenshots, traces, or application artifacts.

## Trust and final acceptance

Explicit requests require current repository write, maintain, or admin permission.
Only open same-repository PRs are accepted, and the requested SHA must match the
current head at resolution time. Fork PR commands are rejected. API errors fail
closed. Profiles accept no arbitrary commands, paths, or shell fragments.

Authorization runs in a separate job without checking out PR code. The execution
job has only read permissions, no configured secrets or deployment environment,
and checkout credential persistence disabled. Use GitHub-hosted disposable
runners. Do not add write tokens or secrets to this job. The PR code still runs
with normal hosted-runner capabilities; this workflow is not a stronger sandbox
for malicious code.

A new request cancels older execution for the same PR/profile. Evidence belongs
to the frozen SHA/base and never automatically transfers to a later revision.
The workflow uses normal failure status; it does not mask failures to mute alerts.
Results live in Actions logs and summaries without automatic PR comment replies.

Ordinary draft PRs use on-demand profiles. CI runs full `deno task verify` when a
PR opens ready for review, becomes ready, reopens, or receives new commits while
ready. Branch-only pushes do not run CI. The Pages deployment quality gate is
unchanged. Before final acceptance, inspect the successful full CI result for
the current PR revision; lightweight validation is not a release gate.

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

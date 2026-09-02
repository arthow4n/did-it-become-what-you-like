const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workflow = fs.readFileSync(path.join(__dirname, '../workflows/agent-validation.yml'), 'utf8');
const resolver = workflow.split("node <<'NODE'\n")[1].split('\n          NODE')[0];
const head = 'a'.repeat(40);
const base = 'b'.repeat(40);
const repo = 'owner/repo';

async function resolve({ kind = 'issue_comment', body = `/ci build ${head}`, permission = 'write', state = 'open', fork = false, current = head, status = 200, inputs, deleted = false } = {}) {
  const event = {
    comment: { body, user: { login: 'owner' } },
    issue: { number: 12 }, sender: { login: 'owner' },
    pull_request: { number: 12, head: { sha: head } },
    inputs: inputs || { branch: 'agent-validation/build/test', profile: 'build', sha: head },
    repository: { default_branch: 'master' }, ref: 'refs/heads/agent-validation/build/test', after: head, deleted,
  };
  const output = {};
  const process = { env: { GITHUB_EVENT_PATH: 'event', GITHUB_REPOSITORY: repo, GITHUB_EVENT_NAME: kind,
    GITHUB_API_URL: 'https://api.github.com', GH_TOKEN: 'test', GITHUB_OUTPUT: 'out', GITHUB_STEP_SUMMARY: 'summary' } };
  const errors = [];
  const context = vm.createContext({
    process, console: { error: message => errors.push(message) },
    require: name => {
      assert.equal(name, 'node:fs');
      return { readFileSync: () => JSON.stringify(event), appendFileSync: (file, data) => { output[file] = (output[file] || '') + data; } };
    },
    fetch: async url => ({ ok: status === 200, status,
      json: async () => url.includes('/permission') ? { permission } : url.includes('/branches/') ? { commit: { sha: url.endsWith('/master') ? base : current } } : {
        state, head: { sha: current, repo: { full_name: fork ? 'other/repo' : repo } },
        base: { sha: base, repo: { full_name: repo } },
      },
    }),
  });
  await vm.runInContext(resolver, context);
  return { output, errors, code: process.exitCode || 0 };
}

test('authorized comment freezes head, base, profile and PR', async () => {
  const result = await resolve();
  assert.equal(result.code, 0);
  assert.equal(result.output.out, `sha=${head}\nbase=${base}\nprofile=build\npr=12\n`);
});
for (const [name, options] of Object.entries({
  'read-only requester': { permission: 'read' },
  'stale revision': { current: 'c'.repeat(40) },
  'fork source': { fork: true },
  'stale push': { kind: 'push', current: 'c'.repeat(40) },
  'deleted branch': { kind: 'push', deleted: true },
  'closed PR': { state: 'closed' },
  'API failure': { status: 403 },
  'shell injection': { body: `/ci build ${head}; echo injected` },
  'missing revision': { body: '/ci build' },
  'unknown profile': { body: `/ci shell ${head}` },
  'multiline request': { body: `/ci build ${head}\necho injected` },
  'dispatch injection': { kind: 'workflow_dispatch', inputs: { branch: 'bad\nbranch', profile: 'full', sha: head } },
})) {
  test(`rejects ${name} without execution outputs`, async () => {
    const result = await resolve(options);
    assert.equal(result.code, 1);
    assert.equal(result.output.out, undefined);
    assert.equal(result.errors.length, 1);
  });
}
test('push and dispatch need no PR', async () => {
  const result = await resolve({ kind: 'push' });
  assert.equal(result.code, 0);
  assert.equal(result.output.out, `sha=${head}\nbase=${base}\nprofile=build\npr=agent-validation/build/test\n`);
});
test('dispatch and automatic runner PR check resolve the requested revision', async () => {
  assert.equal((await resolve({ kind: 'workflow_dispatch' })).code, 0);
  const result = await resolve({ kind: 'pull_request', permission: 'read' });
  assert.equal(result.code, 0);
  assert.match(result.output.out, /profile=affected/);
});

const shell = workflow.split('          set -euo pipefail\n')[1].split('      - name: Record job outcome')[0];
const script = 'set -euo pipefail\n' + shell.replace(/^          /gm, '');
for (const [profile, expected] of Object.entries({
  affected: ['task fmt:check', 'task lint', `test --allow-read --allow-write --allow-run --allow-env --changed=${base}`],
  build: ['task typecheck', 'task build', 'task release:verify'],
  full: ['task verify'],
  e2e: ['x -p npm:@playwright/test@1.62.1 playwright install --with-deps chromium', 'task test:e2e'],
  gallery: ['x -p npm:@playwright/test@1.62.1 playwright install-deps chromium', 'task gallery:verify'],
})) {
  test(`${profile} executes only its fixed command sequence and propagates failure`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-validation-'));
    try {
      fs.writeFileSync(path.join(dir, 'git'), '#!/bin/bash\ncase "$1" in rev-parse) echo "$HEAD_SHA";; merge-base) echo "$BASE_SHA";; esac\n', { mode: 0o755 });
      fs.writeFileSync(path.join(dir, 'deno'), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\nexit "${FAIL_CODE:-0}"\n', { mode: 0o755 });
      const log = path.join(dir, 'commands');
      const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, PROFILE: profile, HEAD_SHA: head, BASE_SHA: base,
        GITHUB_STEP_SUMMARY: path.join(dir, 'summary'), COMMAND_LOG: log };
      const result = spawnSync('bash', ['-c', script], { env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(fs.readFileSync(log, 'utf8').trim().split('\n'), expected);
      fs.writeFileSync(log, '');
      assert.equal(spawnSync('bash', ['-c', script], { env: { ...env, FAIL_CODE: '7' } }).status, 7);
      assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

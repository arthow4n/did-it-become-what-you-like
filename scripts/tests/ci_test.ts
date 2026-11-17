import { readFile } from "node:fs/promises";
import { test } from "vitest";
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

test("CI and Pages workflows follow reviewed security and task policies", async () => {
  const ci = await readFile(".github/workflows/ci.yml", "utf8");
  const pages = await readFile(".github/workflows/pages.yml", "utf8");
  const workflows = [ci, pages];

  for (const [index, workflow] of workflows.entries()) {
    for (const action of workflow.matchAll(/uses:\s*([^\s#]+)/g)) {
      assert(
        /@[a-f0-9]{40}$/.test(action[1]),
        `workflow ${index + 1} must pin action ${
          action[1]
        } to an immutable commit`,
      );
    }
    assert(
      workflow.includes("node-version-file: .node-version") &&
        workflow.includes("run: npm ci"),
      `workflow ${
        index + 1
      } must install dependencies with the pinned Node runtime and npm lockfile`,
    );
    assert(
      !/\b(?:secrets\.|GITHUB_TOKEN|GOOGLE_|GEMINI_|API_KEY|CLIENT_SECRET)\b/i
        .test(workflow),
      `workflow ${index + 1} must not reference credentials or secrets`,
    );
  }

  for (
    const runLine of workflows.flatMap((workflow) =>
      workflow.match(/^\s+run:\s+.+$/gm) ?? []
    )
  ) {
    assert(
      /^run: npm (ci|run verify)$/.test(runLine.trim()),
      `every workflow run step must use the npm quality workflow: ${runLine.trim()}`,
    );
  }

  assert(
    /^permissions:\s*\n\s+contents:\s+read\s*$/m.test(ci),
    "CI must grant read-only repository contents permission",
  );
  assert(
    /push:\s*\n\s+branches-ignore:\s*\n\s+- master/m.test(ci),
    "Pages is the sole quality-and-deployment workflow for master pushes",
  );
  for (const [index, workflow] of workflows.entries()) {
    assert(
      workflow.includes("npm run verify"),
      `workflow ${index + 1} must run the canonical CI quality gate`,
    );
  }
  assert(
    pages.includes("VITE_GOOGLE_CLIENT_ID: ${{ vars.VITE_GOOGLE_CLIENT_ID }}"),
    "Pages must pass the non-secret Google OAuth client ID to the production build",
  );
  const qualityGatePosition = pages.indexOf(
    "run: npm run verify",
  );
  const uploadPosition = pages.indexOf("actions/upload-pages-artifact@");
  assert(
    qualityGatePosition >= 0 && qualityGatePosition < uploadPosition,
    "Pages must complete the CI quality gate before uploading the artifact",
  );
  assert(
    /deploy:\s*\n(?:.|\n)*?permissions:\s*\n\s+pages:\s+write\s*\n\s+id-token:\s+write/m
      .test(pages),
    "only the deploy job may request Pages and OIDC write permissions",
  );
  assert(
    !/permissions:\s*\n(?:.|\n)*?contents:\s+write/m.test(pages),
    "Pages workflow must never request contents write permission",
  );
});

/// <reference path="./deno.d.ts" />

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ci = await Deno.readTextFile(".github/workflows/ci.yml");
const pages = await Deno.readTextFile(".github/workflows/pages.yml");
const workflows = [ci, pages];

for (const [index, workflow] of workflows.entries()) {
  assert(
    workflow.includes("denoland/setup-deno@v2"),
    `workflow ${index + 1} must install Deno through the official setup action`,
  );
  assert(
    !/\b(?:npm|pnpm|yarn|bun)\b/i.test(workflow),
    `workflow ${index + 1} must not invoke a Node package-manager toolchain`,
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
    runLine.includes("deno task"),
    `every workflow run step must use a Deno task: ${runLine.trim()}`,
  );
}

assert(
  /^permissions:\s*\n\s+contents:\s+read\s*$/m.test(ci),
  "CI must grant read-only repository contents permission",
);
assert(
  ci.includes("deno task fmt:check") && ci.includes("deno task build"),
  "CI must run the foundation formatting and production build tasks",
);
assert(
  pages.includes("deno task verify:pages"),
  "Pages deployment must verify the production artifact before upload",
);
assert(
  pages.includes("actions/upload-pages-artifact@v3"),
  "Pages deployment must upload the verified dist artifact",
);
assert(
  pages.includes("actions/deploy-pages@v4"),
  "Pages deployment must use the official deployment action",
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

console.log("CI configuration verification passed.");

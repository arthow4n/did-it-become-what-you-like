/// <reference path="../deno.d.ts" />
import {
  auditDependencies,
  classifyAdvisories,
  dependencyVersions,
} from "../audit-dependencies.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const known = {
  title: "deepmerge prototype poisoning",
  url: "https://github.com/advisories/GHSA-gcqx-w48m-w2h4",
  severity: "low",
};

Deno.test("dependency audit extracts scoped, unscoped, and peer-qualified versions", () => {
  const versions = dependencyVersions({
    npm: {
      "@scope/library@1.2.3_react@19.3.0": {},
      "library@4.5.6": {},
      "under_score@1.0.0": {},
      "library@4.5.6_react@19.3.0": {},
    },
  });
  assert(versions["@scope/library"]?.[0] === "1.2.3", "Scoped version missing");
  assert(
    versions.under_score?.[0] === "1.0.0",
    "Package names may contain underscores",
  );
  assert(versions.library?.join() === "4.5.6", "Versions must be deduplicated");
});

Deno.test("dependency audit accepts only the reviewed build-tool advisory and exact version", () => {
  const result = classifyAdvisories({ deepmerge: ["4.3.1"] }, {
    deepmerge: [known],
    other: [{ ...known, url: "https://github.com/advisories/GHSA-new" }],
  });
  assert(result.accepted.length === 1, "Known exception must remain visible");
  assert(result.blocked.length === 1, "Other findings must block deployment");
  for (const versions of [["4.3.2"], ["4.3.1", "4.2.2"]]) {
    assert(
      classifyAdvisories({ deepmerge: versions }, { deepmerge: [known] })
        .blocked.length === 1,
      "Changed dependency versions must trigger review",
    );
  }
  for (
    const finding of [
      { ...known, severity: "moderate" },
      { ...known, url: "https://github.com/advisories/GHSA-new" },
    ]
  ) {
    assert(
      classifyAdvisories({ deepmerge: ["4.3.1"] }, { deepmerge: [finding] })
        .blocked.length === 1,
      "New or escalated advisories must block deployment",
    );
  }
});

Deno.test("dependency audit submits every locked package and fails closed on unavailable or malformed responses", async () => {
  const lock = { npm: { "deepmerge@4.3.1": {}, "zod@4.6.7": {} } };
  const result = await auditDependencies(lock, (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert(body.zod[0] === "4.6.7", "Audit must include runtime dependencies");
    assert(
      body.deepmerge[0] === "4.3.1",
      "Audit must include build dependencies",
    );
    return Promise.resolve(Response.json({ deepmerge: [known] }));
  });
  assert(result.accepted.length === 1, "Expected scoped exception");
  for (
    const response of [new Response(null, { status: 503 }), Response.json([])]
  ) {
    let failed = false;
    try {
      await auditDependencies(lock, () => Promise.resolve(response));
    } catch {
      failed = true;
    }
    assert(failed, "Registry failures or malformed data must fail the audit");
  }
});

/// <reference path="../deno.d.ts" />

const sourceRoots = ["src"];
const approvedLibraryRoot = "src/design-system/";
const mantineSpecifier = /^@mantine\//;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function collectSourceFiles(
  directory: string,
  files: string[],
): Promise<void> {
  for await (const entry of Deno.readDir(directory)) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory) {
      await collectSourceFiles(path, files);
    } else if (entry.isFile && /\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
}

function hasMantinePublicType(source: string): string | undefined {
  const typeAliases = source.matchAll(
    /export\s+type\s+([A-Za-z_$][\w$]*)\s*=([\s\S]*?);/g,
  );
  for (const match of typeAliases) {
    if (/(?:@mantine\/|\bMantine[A-Z]\w*\b|\bMantine\b)/.test(match[2])) {
      return match[1];
    }
  }

  const interfaces = source.matchAll(
    /export\s+interface\s+([A-Za-z_$][\w$]*)([\s\S]*?)\n\}/g,
  );
  for (const match of interfaces) {
    if (/(?:@mantine\/|\bMantine[A-Z]\w*\b|\bMantine\b)/.test(match[2])) {
      return match[1];
    }
  }

  const values = source.matchAll(
    /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*([^=]+))?\s*=/g,
  );
  for (const match of values) {
    if (
      match[2] &&
      /(?:@mantine\/|\bMantine[A-Z]\w*\b|\bMantine\b)/.test(match[2])
    ) {
      return match[1];
    }
  }

  return undefined;
}

Deno.test("design-system facade boundary isolation and type privacy", async () => {
  const sourceFiles: string[] = [];
  for (const sourceRoot of sourceRoots) {
    await collectSourceFiles(sourceRoot, sourceFiles);
  }

  const violations: string[] = [];
  for (const path of sourceFiles.sort()) {
    const source = await Deno.readTextFile(path);
    for (
      const match of source.matchAll(
        /\b(?:from|import)\s*(?:\(\s*)?["']([^"']+)["']/g,
      )
    ) {
      const specifier = match[1];
      if (
        mantineSpecifier.test(specifier) &&
        !path.startsWith(approvedLibraryRoot)
      ) {
        violations.push(`${path}: Mantine import ${specifier}`);
      }
    }
  }

  const publicBarrel = await Deno.readTextFile("src/design-system/index.ts");
  assert(
    !/@mantine\//.test(publicBarrel),
    "the public design-system barrel must not import or export a library module",
  );
  assert(
    !/\bMantine[A-Z]\w*/.test(publicBarrel),
    "the public design-system barrel must not expose Mantine-specific types",
  );

  for (
    const path of [
      "src/design-system/components.tsx",
      "src/design-system/provider.tsx",
    ]
  ) {
    const source = await Deno.readTextFile(path);
    const leakedType = hasMantinePublicType(source);
    assert(
      !leakedType,
      `${path} exposes a Mantine-specific public declaration: ${
        leakedType ?? "unknown"
      }`,
    );
  }

  assert(
    violations.length === 0,
    `design-system boundary violations:\n${violations.join("\n")}`,
  );
});

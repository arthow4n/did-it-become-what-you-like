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
  assert(
    violations.length === 0,
    `design-system boundary violations:\n${violations.join("\n")}`,
  );
});

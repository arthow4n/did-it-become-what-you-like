/// <reference path="./deno.d.ts" />

const sourceRoots = ["src", "spikes/toolchain/src"];
const approvedLibraryRoot = "src/design-system/";
const mantineSpecifier = /^@mantine\//;
const reactAriaSpecifier = "react-aria-components";

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
    if (specifier === reactAriaSpecifier) {
      violations.push(`${path}: React Aria import ${specifier}`);
    } else if (
      mantineSpecifier.test(specifier) &&
      !path.startsWith(approvedLibraryRoot)
    ) {
      violations.push(`${path}: Mantine import ${specifier}`);
    }
  }

  if (source.includes(reactAriaSpecifier)) {
    violations.push(`${path}: React Aria dependency reference`);
  }
}

const publicBarrel = await Deno.readTextFile("src/design-system/index.ts");
assert(
  !/react-aria-components|@mantine\//.test(publicBarrel),
  "the public design-system barrel must not import or export a library module",
);
assert(
  !/\bMantine[A-Z]\w*/.test(publicBarrel),
  "the public design-system barrel must not expose Mantine-specific types",
);

const denoConfig = await Deno.readTextFile("deno.json");
assert(
  !denoConfig.includes("react-aria-components"),
  "deno.json must not retain the superseded React Aria dependency",
);

const lockfile = await Deno.readTextFile("deno.lock");
assert(
  !lockfile.includes("react-aria-components@") &&
    !lockfile.includes('"npm:react-aria-components@'),
  "deno.lock must not retain the superseded React Aria package",
);

assert(
  violations.length === 0,
  `design-system boundary violations:\n${violations.join("\n")}`,
);

console.log(
  `Design-system boundary verification passed across ${sourceFiles.length} source files.`,
);

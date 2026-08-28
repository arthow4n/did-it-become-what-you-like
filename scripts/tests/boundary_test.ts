/// <reference path="../deno.d.ts" />

const sourceRoots = ["src"];
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

function hasMantinePublicType(source: string): string | undefined {
  const publicTypePattern = /export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(publicTypePattern)) {
    const start = match.index ?? 0;
    const isInterface = /\binterface\b/.test(match[0]);
    let braces = 0;
    let parentheses = 0;
    let brackets = 0;
    let end = source.length;
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (character === "{") braces++;
      else if (character === "}") {
        braces--;
        if (isInterface && braces === 0) {
          end = index + 1;
          break;
        }
      } else if (character === "(") parentheses++;
      else if (character === ")") parentheses--;
      else if (character === "[") brackets++;
      else if (character === "]") brackets--;
      else if (
        character === ";" && braces === 0 && parentheses === 0 &&
        brackets === 0
      ) {
        end = index + 1;
        break;
      }
    }
    const declaration = source.slice(start, end);
    if (
      /(?:@mantine\/|\bMantine[A-Z]\w*\b|\bMantine\b)/.test(declaration)
    ) {
      return match[1];
    }
  }

  const exportedTypedValuePattern =
    /export\s+(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[\s\S]*?)?\s*=/g;
  for (const match of source.matchAll(exportedTypedValuePattern)) {
    if (/(?:@mantine\/|\bMantine[A-Z]\w*\b|\bMantine\b)/.test(match[0])) {
      return match[0].replace(/\s*=\s*$/, "").trim();
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
});

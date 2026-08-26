type CommandResult = {
  code: number;
  output: string;
};

const decoder = new TextDecoder();

async function run(
  label: string,
  args: string[],
  expectedCode = 0,
): Promise<CommandResult> {
  const result = await new Deno.Command(Deno.execPath(), {
    args,
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  }).output();
  const output = `${decoder.decode(result.stdout)}${
    decoder.decode(result.stderr)
  }`;

  if (result.code !== expectedCode) {
    throw new Error(
      `${label} exited ${result.code}, expected ${expectedCode}.\n${output}`,
    );
  }

  console.log(`PASS ${label}`);
  return { code: result.code, output };
}

async function runExpectingTypeError(): Promise<void> {
  const result = await run(
    "TypeScript 7 strict failure fixture",
    [
      "run",
      "-A",
      "npm:typescript@7.0.2/tsc",
      "--noEmit",
      "--pretty",
      "false",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "ESNext",
      "spikes/toolchain/fixtures/strict-failure.ts",
    ],
    1,
  );

  if (
    !result.output.includes("TS2322") ||
    !result.output.includes("strict-failure.ts")
  ) {
    throw new Error(
      `The strict failure fixture produced unexpected diagnostics:\n${result.output}`,
    );
  }
}

async function cleanup(): Promise<void> {
  try {
    await Deno.remove("spikes/toolchain/.tmp", { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

let failure: unknown;

try {
  const version = await run("TypeScript 7 version", [
    "run",
    "-A",
    "npm:typescript@7.0.2/tsc",
    "--version",
  ]);
  if (!version.output.includes("Version 7.0.2")) {
    throw new Error(`Expected TypeScript 7.0.2, received:\n${version.output}`);
  }

  await runExpectingTypeError();

  console.log("Unique toolchain invariants passed.");
} catch (error) {
  failure = error;
}

await cleanup();

if (failure !== undefined) {
  throw failure;
}

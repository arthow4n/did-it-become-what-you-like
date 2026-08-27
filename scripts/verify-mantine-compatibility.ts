const assetsDirectory = new URL(
  "../spikes/toolchain/.tmp/mantine-compatibility/assets/",
  import.meta.url,
);
const assets = [];

for await (const entry of Deno.readDir(assetsDirectory)) {
  if (
    entry.isFile && (entry.name.endsWith(".css") || entry.name.endsWith(".js"))
  ) {
    assets.push(entry.name);
  }
}

const javascriptAssets = assets.filter((name) => name.endsWith(".js"));
const cssAssets = assets.filter((name) => name.endsWith(".css"));
if (javascriptAssets.length !== 1 || cssAssets.length !== 1) {
  throw new Error(
    `Expected one proof JavaScript and CSS asset, found ${javascriptAssets.length} JS and ${cssAssets.length} CSS`,
  );
}

const javascript = await Deno.readTextFile(
  new URL(javascriptAssets[0], assetsDirectory),
);
const css = await Deno.readTextFile(new URL(cssAssets[0], assetsDirectory));
for (const unusedExport of ["DataTable", "RichTextEditor", "Spotlight"]) {
  if (javascript.includes(unusedExport)) {
    throw new Error(
      `Unused Mantine export was retained in the proof bundle: ${unusedExport}`,
    );
  }
}
if (!css.includes("@layer")) {
  throw new Error("Mantine proof CSS is missing its layer declarations");
}

const javascriptBytes = new TextEncoder().encode(javascript).byteLength;
const cssBytes = new TextEncoder().encode(css).byteLength;
console.log(
  `Mantine compatibility proof: ${javascriptBytes} JavaScript bytes, ${cssBytes} CSS bytes, one tree-shaken entry`,
);

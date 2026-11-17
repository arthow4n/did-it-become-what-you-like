import { installAgentBrowser } from "./browser/installer.ts";

const installed = await installAgentBrowser();
console.log(
  `Installed the pinned visual verification pair for ${installed.platform}.`,
);

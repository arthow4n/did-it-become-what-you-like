import { createRoot } from "react-dom/client";
import { FoundationShell } from "./shell.tsx";
import { registerRepositoryServiceWorker } from "./pwa.ts";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Application root element is missing.");

createRoot(root).render(<FoundationShell />);
registerRepositoryServiceWorker();

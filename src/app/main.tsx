import { createRoot } from "react-dom/client";
import { LocalApp } from "../features/local-ui.tsx";
import { registerRepositoryServiceWorker } from "./pwa.ts";
import "../design-system/tokens.css";
import "../features/local-ui.css";
import "../features/settings-pwa.css";
import "../features/sync-ui/sync-ui.css";
import "../features/conflict-import-ui/conflict-import-ui.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Application root element is missing.");

createRoot(root).render(<LocalApp />);
registerRepositoryServiceWorker();

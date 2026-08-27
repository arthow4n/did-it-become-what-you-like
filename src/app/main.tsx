import { createRoot } from "react-dom/client";
import { DesignSystemProvider } from "../design-system/provider.tsx";
import "../design-system/styles.ts";
import { LocalApp } from "../features/local-ui.tsx";
import { registerRepositoryServiceWorker } from "./pwa.ts";
import "../features/local-ui.css";
import "../features/settings-pwa.css";
import "../features/sync-ui/sync-ui.css";
import "../features/conflict-import-ui/conflict-import-ui.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Application root element is missing.");

createRoot(root).render(
  <DesignSystemProvider>
    <LocalApp />
  </DesignSystemProvider>,
);
registerRepositoryServiceWorker();

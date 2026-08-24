import axe from "axe-core";
import { mountDesignSystemGallery } from "./gallery.tsx";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Design-system gallery root is missing.");

mountDesignSystemGallery(root);

void axe.run(root).then((result) => {
  (globalThis as { __designSystemGalleryAxe?: unknown })
    .__designSystemGalleryAxe = result;
});

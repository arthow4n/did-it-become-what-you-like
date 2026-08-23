import { createRoot } from "react-dom/client";
import { ToolchainProof } from "./compatibility.tsx";

const root = document.querySelector("#root");

if (!(root instanceof HTMLElement)) {
  throw new Error("Toolchain proof root was not found");
}

createRoot(root).render(<ToolchainProof />);

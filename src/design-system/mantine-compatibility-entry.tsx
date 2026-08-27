import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/dropzone/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import "./tokens.css";
import { createRoot } from "react-dom/client";
import { MantineCompatibilityProof } from "./mantine-compatibility-proof.tsx";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Mantine compatibility proof root is missing.");

createRoot(root).render(<MantineCompatibilityProof />);

import type { SnapshotFrom } from "xstate";
import type { createLocalShellMachine } from "../../actors/local-shell.ts";

// Route/workflow bookkeeping is already reflected by the runtime's navigation.
// Observe only the shell state used to render or load application content.
export function selectLocalShellView(
  snapshot: SnapshotFrom<ReturnType<typeof createLocalShellMachine>>,
) {
  return {
    projectState: snapshot.context.projectState,
    error: snapshot.context.error,
    ready: snapshot.matches("ready"),
    booting: snapshot.matches("booting"),
    failed: snapshot.matches("error"),
    offline: snapshot.hasTag("offline"),
  };
}

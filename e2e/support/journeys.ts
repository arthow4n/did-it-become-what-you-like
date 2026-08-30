export const APPROVED_JOURNEYS = [
  {
    id: "local-first-manual",
    title: "Local first use through manual expense save",
    boundary: "browser-ui -> shell actor -> local repository",
  },
  {
    id: "receipt-review",
    title: "Receipt capture, review, and saved management with fake Gemini",
    boundary: "browser-ui -> receipt actor -> fake Gemini port",
  },
  {
    id: "drive-reconnect",
    title: "Drive reconnect and visible synchronization",
    boundary: "browser-ui -> sync actor -> fake Drive port",
  },
  {
    id: "conflict-resolution",
    title: "Conflict review and resolution",
    boundary: "browser-ui -> conflict actor -> local repository",
  },
  {
    id: "offline-update",
    title: "Offline and update recovery",
    boundary: "browser-ui -> PWA/update actor -> browser platform",
  },
] as const;

export type ApprovedJourneyId = (typeof APPROVED_JOURNEYS)[number]["id"];

export function assertApprovedJourneyBoundaries(): void {
  if (APPROVED_JOURNEYS.length !== 5) {
    throw new Error(
      "F-005 must expose exactly five approved E2E journey boundaries.",
    );
  }
  const ids = new Set(APPROVED_JOURNEYS.map((journey) => journey.id));
  if (ids.size !== APPROVED_JOURNEYS.length) {
    throw new Error("Approved E2E journey boundary IDs must be unique.");
  }
}

assertApprovedJourneyBoundaries();

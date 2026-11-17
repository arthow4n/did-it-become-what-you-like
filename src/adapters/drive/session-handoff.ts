const STORAGE_KEY = "did_it_drive_handoff_verifier";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HANDOFF_SUFFIX = /\|sync_handoff=([A-Za-z0-9_-]{43})$/;

let returnedTicket: string | undefined;

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-")
    .replaceAll("/", "_").replace(/=+$/, "");
}

export async function driveHandoffChallenge(
  serverUrl: string,
): Promise<string> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ serverUrl, verifier }));
  return base64Url(new Uint8Array(digest));
}

// Run before hash routing and service worker registration. The ticket stays in the
// fragment during the redirect and is removed before the application renders.
export function captureDriveHandoff(): void {
  const url = new URL(location.href);
  if (url.searchParams.get("sync_connected") !== "persisted") return;
  const match = HANDOFF_SUFFIX.exec(url.hash);
  if (!match) return;
  returnedTicket = match[1];
  url.hash = url.hash.slice(0, match.index);
  history.replaceState(history.state, "", url);
}

export async function redeemDriveHandoff(serverUrl: string): Promise<void> {
  const ticket = returnedTicket;
  if (!ticket) return;
  returnedTicket = undefined;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  const proof: { serverUrl?: string; verifier?: string } = stored
    ? JSON.parse(stored)
    : {};
  if (
    proof?.serverUrl !== serverUrl || !proof.verifier ||
    !TOKEN_PATTERN.test(proof.verifier)
  ) {
    throw new Error(
      "Sign-in must finish in the tab where it started. Reconnect to Google Drive.",
    );
  }
  const response = await fetch(`${serverUrl}/auth/google-drive/session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, verifier: proof.verifier }),
  });
  if (!response.ok) {
    throw new Error(
      "The Google Drive sign-in could not be completed. Reconnect to Google Drive.",
    );
  }
}

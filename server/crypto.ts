/**
 * Cryptographic helpers for the Deno Deploy sync server.
 * Implements OWASP recommendations: AES-GCM with unique 12-byte IV per encryption,
 * and SHA-256 for session token hashing.
 */

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(secret);
  // Hash the secret string with SHA-256 to ensure a standard 256-bit key
  const keyHash = await crypto.subtle.digest("SHA-256", rawKey);
  return await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EncryptedData = {
  readonly ciphertext: string;
  readonly iv: string;
};

/**
 * Encrypt a plaintext string using AES-GCM with a fresh 12-byte random IV.
 */
export async function encryptToken(
  plainText: string,
  secretKey: string,
): Promise<EncryptedData> {
  const key = await deriveKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt an AES-GCM encrypted payload using the provided secret key.
 */
export async function decryptToken(
  encrypted: EncryptedData,
  secretKey: string,
): Promise<string> {
  const key = await deriveKey(secretKey);
  const iv = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(
    atob(encrypted.ciphertext),
    (c) => c.charCodeAt(0),
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Hash a session token using SHA-256 for storage in Deno KV.
 */
export async function hashSessionToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

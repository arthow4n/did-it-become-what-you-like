/// <reference lib="deno.unstable" />
/// <reference lib="deno.ns" />
import { handleRequest, type ServerEnv } from "./server.ts";

const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const allowedEmailsRaw = Deno.env.get("ALLOWED_GOOGLE_EMAILS") ?? "";
const encryptionSecret = Deno.env.get("ENCRYPTION_SECRET") ?? "";
const frontendOrigin = Deno.env.get("FRONTEND_ORIGIN") ?? "*";
const serverOrigin = Deno.env.get("SERVER_ORIGIN");

const allowedEmails = allowedEmailsRaw
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const env: ServerEnv = {
  googleClientId,
  googleClientSecret,
  allowedEmails,
  encryptionSecret,
  frontendOrigin,
  serverOrigin,
};

const kv = await Deno.openKv();
const port = Number(Deno.env.get("PORT") ?? 8000);

Deno.serve({ port }, (req) => handleRequest(req, kv, env));

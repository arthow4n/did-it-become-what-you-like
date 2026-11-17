import { handleRequest } from "./server.ts";
import { SessionStore } from "./store.ts";

export type WorkerEnv = Env & {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_GOOGLE_EMAILS?: string;
  ENCRYPTION_SECRET?: string;
};

export default {
  fetch(request, env) {
    return handleRequest(request, env, env.DB && new SessionStore(env.DB));
  },
  async scheduled(_event, env) {
    await new SessionStore(env.DB).removeExpired(Date.now());
  },
} satisfies ExportedHandler<WorkerEnv>;

import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { SessionStore } from "./store.ts";

export async function createTestDatabase() {
  const runtime = new Miniflare({
    workers: [{
      config: {
        name: "test",
        compatibilityDate: "2026-11-17",
        manifest: {
          mainModule: "main.js",
          modules: {
            "main.js": {
              type: "esm",
              contents:
                "export default { fetch() { return new Response(null); } }",
            },
          },
        },
        env: { DB: { type: "d1", id: "test-database" } },
      },
    }],
  });
  const db = await runtime.getD1Database("DB");
  const sql = await readFile("server/migrations/0001_sessions.sql", "utf8");
  await db.batch(
    sql.split(";").filter((part) => part.trim()).map((part) =>
      db.prepare(part)
    ),
  );
  return { db, store: new SessionStore(db), dispose: () => runtime.dispose() };
}

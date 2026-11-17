import { expect, test } from "@playwright/test";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { handleRequest } from "../server/server.ts";
import { createTestDatabase } from "../server/test-database.ts";

test.use({
  launchOptions: { args: ["--test-third-party-cookie-phaseout"] },
});

test("Persisted Drive uses a partitioned cookie after OAuth and keeps it after reload", async ({ page }) => {
  const module = stripTypeScriptTypes(
    await readFile(
      "src/adapters/drive/session-handoff.ts",
      "utf8",
    ),
  );
  const { store, dispose } = await createTestDatabase();
  const worker = createServer();
  worker.listen(0, "127.0.0.1");
  try {
    await once(worker, "listening");
    const address = worker.address();
    if (!address || typeof address === "string") {
      throw new Error("Worker fixture did not bind");
    }
    const serverOrigin = `http://localhost:${address.port}`;
    const frontend = new URL(`http://127.0.0.1:${address.port}/app/`);
    const google: typeof fetch = async (url) =>
      String(url).includes("/userinfo")
        ? Response.json({ email: "owner@example.test", verified_email: true })
        : Response.json({
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
          expires_in: 120,
        });

    worker.on("request", async (request, response) => {
      try {
        const url = new URL(request.url!, `http://${request.headers.host}`);
        if (url.origin === frontend.origin) {
          if (url.pathname === "/app/handoff.js") {
            response.writeHead(200, { "Content-Type": "text/javascript" }).end(
              module,
            );
          } else if (url.pathname === "/app/google") {
            const callback = new URL(
              "/auth/google-drive/callback",
              serverOrigin,
            );
            callback.searchParams.set("state", url.searchParams.get("state")!);
            callback.searchParams.set("code", "fixture");
            response.writeHead(302, { Location: callback.href }).end();
          } else if (url.pathname === frontend.pathname) {
            response.writeHead(200, { "Content-Type": "text/html" }).end(
              `<output>loading</output><script type="module">
                import { captureDriveHandoff, driveHandoffChallenge, redeemDriveHandoff } from "./handoff.js";
                const worker = ${JSON.stringify(serverOrigin)};
                captureDriveHandoff();
                const output = document.querySelector("output");
                if (!sessionStorage.getItem("started")) {
                  sessionStorage.setItem("started", "yes");
                  const params = new URLSearchParams({
                    return_to: location.href,
                    handoff_challenge: await driveHandoffChallenge(worker),
                  });
                  location.href = worker + "/auth/google-drive/login?" + params;
                } else {
                  await redeemDriveHandoff(worker);
                  const result = await fetch(worker + "/api/google-drive-token", { credentials: "include" });
                  output.textContent = String(result.status);
                }
              </script>`,
            );
          } else {
            response.writeHead(404).end();
          }
          return;
        }

        const chunks: Uint8Array[] = [];
        for await (const chunk of request) chunks.push(chunk);
        const result = await handleRequest(
          new Request(url, {
            method: request.method,
            headers: request.headers as Record<string, string>,
            ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          }),
          {
            FRONTEND_URL: frontend.href,
            SERVER_ORIGIN: serverOrigin,
            GOOGLE_CLIENT_ID: "fixture-id",
            GOOGLE_CLIENT_SECRET: "fixture-secret",
            ALLOWED_GOOGLE_EMAILS: "owner@example.test",
            ENCRYPTION_SECRET: "test-encryption-key".repeat(3),
          },
          store,
          google,
        );

        const headers = Object.fromEntries(result.headers);
        const location = headers.location && new URL(headers.location);
        if (location && location.origin === "https://accounts.google.com") {
          const stub = new URL("google", frontend);
          stub.search = location.search;
          headers.location = stub.href;
        }
        response.writeHead(result.status, headers);
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch {
        response.writeHead(500).end();
      }
    });

    await page.goto(frontend.href + "#/settings");
    await expect(page.locator("output")).toHaveText("200");
    expect(new URL(page.url()).hash).toBe("#/settings");
    const session = (await page.context().cookies()).find(({ name }) =>
      name === "__Host-drive_session"
    );
    expect(session).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "None",
      partitionKey: "http://127.0.0.1",
    });
    await page.reload();
    await expect(page.locator("output")).toHaveText("200");
  } finally {
    worker.closeAllConnections();
    worker.close();
    await dispose();
  }
});

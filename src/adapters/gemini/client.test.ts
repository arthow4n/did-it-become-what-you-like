import { createGoogleGenAiClient, type GoogleGenAiSdk } from "./client.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Google Gen AI wrapper owns SDK request translation", async () => {
  const observations: unknown[] = [];
  const controller = new AbortController();
  const models = [{
    name: "models/gemini-3.7-flash",
    displayName: "Gemini 3.7 Flash",
    supportedActions: ["generateContent"],
  }];
  const sdk: GoogleGenAiSdk = {
    models: {
      list: (parameters) => {
        assert(
          parameters.config.abortSignal === controller.signal,
          "Expected list AbortSignal forwarding",
        );
        observations.push({ operation: "list", parameters });
        return Promise.resolve({
          async *[Symbol.asyncIterator]() {
            yield* models;
          },
        });
      },
      generateContent: (parameters) => {
        assert(
          parameters.config.abortSignal === controller.signal,
          "Expected generation AbortSignal forwarding",
        );
        observations.push({ operation: "generate", parameters });
        return Promise.resolve({ text: '{"schemaVersion":"receipt.v2"}' });
      },
    },
  };
  const client = createGoogleGenAiClient(
    "AIza.synthetic-not-observed",
    () => sdk,
  );
  const listed: unknown[] = [];
  const pager = await client.models.list({
    pageSize: 250,
    signal: controller.signal,
  });
  if (!(Symbol.asyncIterator in pager)) {
    throw new Error("Expected SDK model pager");
  }
  for await (const model of pager) listed.push(model);
  assertEquals(listed, models);

  const response = await client.models.generateContent(
    {
      model: "gemini-3.7-flash",
      contents: [
        { text: "Extract this receipt." },
        { inlineData: { data: "iVBORw0KGgo=", mimeType: "image/png" } },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: { type: "object" },
        systemInstruction: "Return structured receipt data.",
      },
    },
    { signal: controller.signal },
  );
  assertEquals(response.text, '{"schemaVersion":"receipt.v2"}');
  assertEquals(observations, [
    {
      operation: "list",
      parameters: {
        config: { pageSize: 250, abortSignal: controller.signal },
      },
    },
    {
      operation: "generate",
      parameters: {
        model: "gemini-3.7-flash",
        contents: [
          { text: "Extract this receipt." },
          { inlineData: { data: "iVBORw0KGgo=", mimeType: "image/png" } },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: { type: "object" },
          systemInstruction: "Return structured receipt data.",
          abortSignal: controller.signal,
        },
      },
    },
  ]);
});

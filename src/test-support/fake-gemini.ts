export type FakeGeminiModel = {
  name: string;
  supportsImage: boolean;
  supportsStructuredOutput: boolean;
};

export type GeminiReceiptRequest = {
  model: string;
  image: { mimeType: string; bytes: Uint8Array };
  promptVersion: string;
  categoryIds: readonly string[];
  locale: string;
  currency: string;
};

export type GeminiReceiptDraft = {
  merchant: string;
  currency: string;
  lines: Array<{ description: string; amount: string; categoryId: string }>;
};

export type FakeGeminiPort = {
  listModels(): Promise<readonly FakeGeminiModel[]>;
  testConfiguration(model: string): Promise<{ ok: boolean; reason?: string }>;
  generateReceiptDraft(
    request: GeminiReceiptRequest,
    signal?: AbortSignal,
  ): Promise<GeminiReceiptDraft>;
  readonly requestCount: number;
  readonly requestSummaries: readonly Omit<GeminiReceiptRequest, "image">[];
};

export function createFakeGeminiPort(
  response: GeminiReceiptDraft = {
    merchant: "Test Merchant",
    currency: "SEK",
    lines: [{ description: "Test item", amount: "-10", categoryId: "cat-001" }],
  },
): FakeGeminiPort {
  const models: readonly FakeGeminiModel[] = [
    {
      name: "gemini-test-compatible",
      supportsImage: true,
      supportsStructuredOutput: true,
    },
    {
      name: "gemini-test-needs-review",
      supportsImage: true,
      supportsStructuredOutput: false,
    },
  ];
  const summaries: Array<Omit<GeminiReceiptRequest, "image">> = [];
  let requestCount = 0;

  return {
    listModels: () => Promise.resolve(models),
    testConfiguration: (model) => {
      const selected = models.find((candidate) => candidate.name === model);
      return Promise.resolve(
        selected?.supportsImage && selected.supportsStructuredOutput
          ? { ok: true }
          : { ok: false, reason: "model-capability-mismatch" },
      );
    },
    generateReceiptDraft: (request, signal) => {
      if (signal?.aborted) {
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      }
      const selected = models.find((model) => model.name === request.model);
      if (!selected?.supportsImage || !selected.supportsStructuredOutput) {
        return Promise.reject(
          new Error("Fake Gemini model is not receipt-compatible."),
        );
      }
      requestCount += 1;
      const { image: _image, ...summary } = request;
      summaries.push(summary);
      return Promise.resolve(structuredClone(response));
    },
    get requestCount() {
      return requestCount;
    },
    get requestSummaries() {
      return summaries;
    },
  };
}

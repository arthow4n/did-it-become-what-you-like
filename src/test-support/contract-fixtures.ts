export const FAKE_DRIVE_FILE = {
  name: "fixture-dataset.json",
  body: '{"schemaVersion":1,"records":[]}',
} as const;

export const FAKE_GEMINI_DRAFT = {
  merchant: "Test Merchant",
  currency: "SEK",
  lines: [{ description: "Test item", amount: "-10", categoryId: "cat-001" }],
} as const;

export const FAKE_GEMINI_REQUEST = {
  model: "gemini-test-compatible",
  image: { mimeType: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) },
  promptVersion: "receipt-v1",
  categoryIds: ["cat-001"],
  locale: "sv-SE",
  currency: "SEK",
} as const;

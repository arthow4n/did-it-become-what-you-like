import {
  buildReceiptPrompt,
  mapReceiptOutputToDraft,
  normalizeReceiptOutput,
  parseReceiptOutput,
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_JSON_SCHEMA,
  RECEIPT_SCHEMA_VERSION,
  ReceiptOutputError,
  ReceiptOutputSchema,
  validateReceiptOutput,
} from "./schema.ts";

import { assertRejects } from "../../test-support/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const promptRequest = {
  categories: [{ id: "category-groceries", name: "Groceries" }],
  currency: "SEK" as const,
  locale: "sv-SE",
};

const validOutput = {
  currency: "SEK",
  date: "2026-08-24",
  lines: [{
    amount: "10",
    categoryId: "category-groceries",
    description: "Milk",
    direction: "outflow",
    kind: "purchase",
    rationale: "The product row is listed in the receipt body.",
    selected: true,
  }],
  merchant: "Synthetic shop",
  mismatch: null,
  printedTotal: "10",
  schemaVersion: RECEIPT_SCHEMA_VERSION,
  uncertainty: [],
} as const;

Deno.test("shared receipt prompt has one stable instruction identity and version", () => {
  const prompt = buildReceiptPrompt(promptRequest);
  assert(
    prompt.includes(`Instruction version: ${RECEIPT_INSTRUCTION_VERSION}.`),
  );
  assert(prompt.includes(`exactly schema ${RECEIPT_SCHEMA_VERSION}`));
  assert(prompt.includes('"id":"category-groceries"'));
  assert(prompt.includes("Device locale: sv-SE."));
  assert(prompt.includes("Project default currency: SEK."));
  assertEquals(
    prompt,
    buildReceiptPrompt({
      ...promptRequest,
      categories: [{ id: "category-groceries", name: "Groceries" }],
    }),
  );
});

Deno.test("shared receipt prompt attaches category description when present and omits when absent", () => {
  const promptWithDesc = buildReceiptPrompt({
    ...promptRequest,
    categories: [
      {
        id: "category-food",
        name: "Food",
        description: "Supermarket, snacks, coffee",
      },
      {
        id: "category-rent",
        name: "Rent",
      },
    ],
  });
  assert(
    promptWithDesc.includes(
      '{"id":"category-food","name":"Food","description":"Supermarket, snacks, coffee"}',
    ),
  );
  assert(
    promptWithDesc.includes(
      '{"id":"category-rent","name":"Rent"}',
    ),
  );
  assert(
    !promptWithDesc.includes(
      '"id":"category-rent","name":"Rent","description"',
    ),
  );
});

Deno.test("shared schema and parser normalize and validate provider output", async () => {
  const localized = {
    ...validOutput,
    lines: [{
      ...validOutput.lines[0],
      amount: "1.234,50",
      quantity: "2",
      unitPrice: "617,25",
    }],
    printedTotal: "1 234,50",
  };
  const normalized = normalizeReceiptOutput(localized) as typeof localized;
  assertEquals(normalized.printedTotal, "1234.5");
  assertEquals(normalized.lines[0].amount, "1234.5");
  assertEquals(normalized.lines[0].unitPrice, "617.25");
  const output = parseReceiptOutput(JSON.stringify(localized));
  assertEquals(output.printedTotal, "1234.5");
  assertEquals(output.lines[0]?.amount, "1234.5");
  assertEquals(output.lines[0]?.quantity, "2");
  assertEquals(output.lines[0]?.unitPrice, "617.25");
  assertEquals(validateReceiptOutput(validOutput).merchant, "Synthetic shop");
  assertEquals(
    (RECEIPT_JSON_SCHEMA.properties as Record<string, unknown>).schemaVersion,
    { type: "string", const: RECEIPT_SCHEMA_VERSION },
  );
  const hostile = { ...validOutput, hostile: "not allowed" };
  const error = await assertRejects(() =>
    Promise.resolve(parseReceiptOutput(JSON.stringify(hostile)))
  );
  assert(error instanceof ReceiptOutputError);
  assertEquals(error.phase, "schema");
  assert(ReceiptOutputSchema.safeParse(validOutput).success);
});

Deno.test("shared mapper preserves receipt semantics and flags unavailable categories", () => {
  const output = ReceiptOutputSchema.parse({
    ...validOutput,
    lines: [{
      ...validOutput.lines[0],
      categoryId: "category-missing",
      uncertainty: "The category label is hard to read.",
    }],
  });
  const draft = mapReceiptOutputToDraft(output, {
    categories: [{ id: "category-groceries", name: "Groceries" }],
  });
  assertEquals(draft.lines[0]?.categoryId, "category-missing");
  assertEquals(
    draft.lines[0]?.uncertainty,
    "The category label is hard to read. The suggested category is unavailable; review the category.",
  );
  assertEquals(draft.lines[0]?.kind, "purchase");
  assertEquals(draft.lines[0]?.direction, "outflow");
  assertEquals(draft.mismatches, []);
});

Deno.test("shared schema and parser normalize time and map it to draft", () => {
  const withTime = {
    ...validOutput,
    time: "14:35",
  };
  const parsed = parseReceiptOutput(JSON.stringify(withTime));
  assertEquals(parsed.time, "14:35");
  const draft = mapReceiptOutputToDraft(parsed, {
    categories: [{ id: "category-groceries", name: "Groceries" }],
  });
  assertEquals(draft.time, "14:35");

  // Localized and alternate time formats normalize cleanly
  const timeCases = [
    { input: "9:05", expected: "09:05" },
    { input: "14.35", expected: "14:35" },
    { input: "2:30 pm", expected: "14:30" },
    { input: "12:15 am", expected: "00:15" },
    { input: "   ", expected: null },
  ] as const;
  for (const { input, expected } of timeCases) {
    const normalized = normalizeReceiptOutput({
      ...validOutput,
      time: input,
    }) as { time?: string | null };
    assertEquals(normalized.time, expected);
  }
});

Deno.test("buildReceiptPrompt tailors instructions when documentType is menu", () => {
  const prompt = buildReceiptPrompt({
    ...promptRequest,
    documentType: "menu",
  });
  assert(prompt.includes("Document type: restaurant menu."));
  assert(prompt.includes("selected set to false"));
  assert(prompt.includes("set printedTotal to '0'"));
  assert(prompt.includes("set unitPrice to the printed price"));
});

Deno.test("shared schema and parser accept null in optional line fields and capture detailed errors", () => {
  const outputWithNulls = {
    ...validOutput,
    time: "N/A",
    lines: [{
      ...validOutput.lines[0],
      quantity: null,
      unitPrice: null,
      uncertainty: null,
    }],
  };
  const parsed = parseReceiptOutput(JSON.stringify(outputWithNulls));
  assertEquals(parsed.time, null);
  assertEquals(parsed.lines[0]?.quantity, null);
  assertEquals(parsed.lines[0]?.unitPrice, null);
  assertEquals(parsed.lines[0]?.uncertainty, null);

  const draft = mapReceiptOutputToDraft(parsed, {
    categories: [{ id: "category-groceries", name: "Groceries" }],
  });
  const firstLine = draft.lines[0];
  assert(firstLine?.kind === "purchase");
  assertEquals(draft.time, undefined);
  assertEquals(firstLine.quantity, undefined);
  assertEquals(firstLine.unitPrice, undefined);
  assertEquals(firstLine.uncertainty, undefined);

  // Detailed validation error capture
  try {
    parseReceiptOutput(JSON.stringify({
      ...validOutput,
      currency: "INVALID_LONG_CODE",
    }));
    assert(false, "Expected validation failure");
  } catch (error) {
    assert(error instanceof ReceiptOutputError);
    assertEquals(error.phase, "schema");
    assert(
      error.details?.includes("currency"),
      "Expected currency in error details",
    );
  }
});

Deno.test("shared schema and parser accept empty or null merchant and normalize alternative date formats", () => {
  // Empty merchant string and European date format DD/MM/YYYY
  const outputEmptyMerchantDmy = {
    ...validOutput,
    merchant: "",
    date: "24/09/2026",
  };
  const parsed1 = parseReceiptOutput(JSON.stringify(outputEmptyMerchantDmy));
  assertEquals(parsed1.merchant, "");
  assertEquals(parsed1.date, "2026-09-24");

  const draft1 = mapReceiptOutputToDraft(parsed1, {
    categories: [{ id: "category-groceries", name: "Groceries" }],
    today: "2026-09-24" as const,
  });
  assertEquals(draft1.merchant, undefined);
  assertEquals(draft1.date, "2026-09-24");

  // Null merchant and null date fallback to request.today
  const outputNulls = {
    ...validOutput,
    merchant: null,
    date: null,
  };
  const parsed2 = parseReceiptOutput(JSON.stringify(outputNulls));
  assertEquals(parsed2.merchant, null);
  assertEquals(parsed2.date, null);

  const draft2 = mapReceiptOutputToDraft(parsed2, {
    categories: [{ id: "category-groceries", name: "Groceries" }],
    today: "2026-09-24" as const,
  });
  assertEquals(draft2.merchant, undefined);
  assertEquals(draft2.date, "2026-09-24");
  assert(
    draft2.uncertainty.some((u) => u.includes("receipt date was missing")),
    "Expected uncertainty about missing receipt date",
  );

  // Various date formats normalized
  const dateScenarios = [
    ["2026.09.24", "2026-09-24"],
    ["2026/09/24", "2026-09-24"],
    ["24-09-2026", "2026-09-24"],
    ["2026-09-24T14:35:00Z", "2026-09-24"],
    ["26-09-24", "2026-09-24"],
    ["24/09/26", "2026-09-24"],
    ["24 Sep 2026", "2026-09-24"],
    ["September 24, 2026", "2026-09-24"],
    ["N/A", null],
    ["unknown", null],
    ["", null],
  ];

  for (const [input, expected] of dateScenarios) {
    const parsed = parseReceiptOutput(
      JSON.stringify({ ...validOutput, date: input }),
    );
    assertEquals(parsed.date, expected);
  }
});

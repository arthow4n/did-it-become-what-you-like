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

async function assertRejects(
  operation: () => unknown | Promise<unknown>,
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to reject");
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

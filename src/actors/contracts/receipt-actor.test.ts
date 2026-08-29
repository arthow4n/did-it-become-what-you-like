import { createActor } from "xstate";
import {
  type ImagePreparationPort,
  type ReceiptAiPort,
  type ReceiptExtractionDraft,
} from "../../adapters/ports/index.ts";
import {
  createFakeGeminiPort,
  createFakeImagePreparationPort,
  createFakeLocalPort,
  type FakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import {
  createReceiptCommitService,
  type ReceiptReviewDraft,
} from "../../domain/receipt.ts";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
} from "../../domain/organization.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";
import {
  createReceiptReviewMachine,
  createReceiptScanMachine,
} from "../receipt.ts";

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

async function settle(): Promise<void> {
  for (let index = 0; index < 18; index += 1) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function waitForValue(
  actor: { getSnapshot(): { value: unknown } },
  expected: string,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await settle();
    if (actor.getSnapshot().value === expected) return;
  }
  throw new Error(
    `Expected actor state ${expected}, got ${
      String(actor.getSnapshot().value)
    }`,
  );
}

const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-receipt-actor",
  name: "Receipt actor project",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const scanInput = {
  image: {
    ephemeralId: "image-memory-only",
    mediaType: "image/jpeg",
    byteLength: 12,
  },
  projectId: project.id,
  currency: "SEK" as const,
  locale: "sv-SE",
  categoryCatalogue: [{ id: UNCATEGORIZED_CATEGORY_ID, name: "Uncategorized" }],
  model: "fake-gemini-compatible",
  prepareImage: true,
};

function extractionDraft(
  overrides: Partial<ReceiptExtractionDraft> = {},
): ReceiptExtractionDraft {
  return {
    merchant: "Market branch",
    currency: "SEK",
    date: "2026-08-24",
    printedTotal: "-4",
    lines: [{
      description: "Milk",
      amount: "4",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      selected: true,
    }],
    uncertainty: [],
    mismatches: [],
    ...overrides,
  };
}

function createScanMachine(
  ai: ReceiptAiPort,
  imagePreparation: ImagePreparationPort,
  released: string[],
) {
  return createReceiptScanMachine({
    ai,
    imagePreparation,
    resolveImage: () =>
      Promise.resolve({
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
      }),
    releaseImage: (image) => {
      released.push(image.ephemeralId);
    },
    nextLineId: (() => {
      let index = 0;
      return () => `receipt-line-test-${++index}`;
    })(),
  });
}

Deno.test("receipt-actor scan: disclosure, preparation, validation, and unreadable lines", async () => {
  const gemini = createFakeGeminiPort(extractionDraft({
    lines: [
      {
        description: "",
        amount: "4",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        kind: "purchase",
        selected: true,
        uncertainty: "Receipt text was partly hidden.",
      },
      {
        description: "Bottle return",
        amount: "1",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        kind: "adjustment",
        selected: true,
      },
    ],
  }));
  const preparation = createFakeImagePreparationPort();
  const released: string[] = [];
  const actor = createActor(createScanMachine(gemini, preparation, released))
    .start();

  actor.send({ type: "receipt.open", disclosureRequired: true });
  assertEquals(actor.getSnapshot().value, "disclosure");
  actor.send({ type: "receipt.disclosure.accept" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await waitForValue(actor, "reviewReady");

  const review = actor.getSnapshot().context.review;
  assert(review !== null);
  assertEquals(review.lines[0]?.selected, false);
  assertEquals(review.lines[0]?.uncertain, true);
  assertEquals(review.lines[1]?.selected, true);
  assertEquals(
    review.lines[1]?.type === "adjustment" ? review.lines[1].amount : undefined,
    "1",
  );
  assertEquals(preparation.calls[0]?.enabled, true);
  assertEquals(released, ["image-memory-only"]);
  assert(
    !JSON.stringify(actor.getPersistedSnapshot()).includes("image-memory-only"),
  );
  actor.stop();
});

Deno.test("receipt-actor scan: offline/model loss failure can retry without retaining image", async () => {
  const gemini = createFakeGeminiPort(extractionDraft());
  const preparation = createFakeImagePreparationPort();
  const released: string[] = [];
  gemini.failNext("offline");
  const actor = createActor(createScanMachine(gemini, preparation, released))
    .start();
  actor.send({ type: "receipt.open" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await waitForValue(actor, "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "offline");
  actor.send({ type: "receipt.retry", input: scanInput });
  await waitForValue(actor, "reviewReady");
  assertEquals(released, ["image-memory-only", "image-memory-only"]);
  actor.stop();

  gemini.failNext("not-found");
  const modelLoss = createActor(
    createScanMachine(gemini, preparation, released),
  ).start();
  modelLoss.send({ type: "receipt.open" });
  modelLoss.send({ type: "receipt.image-selected" });
  modelLoss.send({ type: "receipt.scan", input: scanInput });
  await waitForValue(modelLoss, "failed");
  assertEquals(modelLoss.getSnapshot().context.error?.code, "not-found");
  modelLoss.send({ type: "receipt.retry", input: scanInput });
  await waitForValue(modelLoss, "reviewReady");
  modelLoss.stop();
});

Deno.test("receipt-actor scan: cancellation aborts the request and releases the image", async () => {
  const gemini = createFakeGeminiPort(extractionDraft());
  const preparation = createFakeImagePreparationPort();
  const released: string[] = [];
  gemini.pauseNext();
  const actor = createActor(createScanMachine(gemini, preparation, released))
    .start();
  actor.send({ type: "receipt.open" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await waitForValue(actor, "preparing");
  actor.send({ type: "receipt.cancel" });
  await waitForValue(actor, "cancelled");
  assertEquals(released, ["image-memory-only"]);
  actor.stop();
});

function reviewDraft(
  overrides: Partial<ReceiptReviewDraft> = {},
): ReceiptReviewDraft {
  return {
    parent: {
      projectId: project.id,
      date: "2026-08-24",
      merchant: "Market branch",
      currency: "SEK",
      printedTotal: "-5",
    },
    lines: [{
      type: "purchase",
      id: "receipt-line-milk",
      description: "Milk",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      lineTotal: "-5",
      selected: true,
      uncertain: false,
    }, {
      type: "adjustment",
      id: "receipt-line-discount",
      description: "Discount",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      amount: "1",
      lineId: "receipt-line-milk",
      selected: true,
      uncertain: false,
    }],
    uncertainty: [],
    printedTotalMismatch: false,
    ...overrides,
  };
}

async function receiptHarness(): Promise<{
  readonly local: FakeLocalPort;
  readonly organization: ProjectCategoryService;
}> {
  const local = createFakeLocalPort();
  const organization = createProjectCategoryService(local, {
    deviceId: "device-receipt-actor",
    now: () => "2026-08-24T12:00:00.000Z",
  });
  await organization.commitProject({ type: "create", project });
  return { local, organization };
}

Deno.test("receipt-actor review: durable validated draft hydrates without image and saves atomically", async () => {
  const { local, organization } = await receiptHarness();
  const commit = createReceiptCommitService(local, {
    nextId: (kind) =>
      kind === "receipt" ? "receipt-committed" : "receipt-generated-line",
  });
  const first = createActor(
    createReceiptReviewMachine({
      local,
      commit,
      persistenceKey: "workflow:receipt-actor",
    }),
    { input: { persistenceKey: "workflow:receipt-actor" } },
  ).start();
  first.send({ type: "receipt.review.open", review: reviewDraft() });
  await waitForValue(first, "persisted");
  const stored = await local.query("workflow-snapshots");
  assertEquals(stored.length, 1);
  assert(!JSON.stringify(stored[0]?.value).includes("ephemeralId"));

  const resumed = createActor(
    createReceiptReviewMachine({
      local,
      commit,
      persistenceKey: "workflow:receipt-actor",
    }),
    { input: { persistenceKey: "workflow:receipt-actor" } },
  ).start();
  resumed.send({ type: "receipt.review.hydrate" });
  await waitForValue(resumed, "persisted");
  assertEquals(resumed.getSnapshot().context.review?.lines.length, 2);
  resumed.send({ type: "receipt.review.submit", confirmMismatch: false });
  await waitForValue(resumed, "mismatch");
  resumed.send({ type: "receipt.review.confirm-mismatch" });
  await waitForValue(resumed, "saved");
  assertEquals(
    (await local.query("records", { index: "type", equals: "receipt" })).length,
    1,
  );
  assertEquals(
    (await local.query("records", {
      index: "type",
      equals: "receipt-purchase-line",
    })).length,
    1,
  );
  assertEquals(
    (await local.query("records", {
      index: "type",
      equals: "receipt-adjustment",
    })).length,
    1,
  );
  assertEquals(await local.query("workflow-snapshots"), []);
  first.stop();
  resumed.stop();
  void organization;
});

Deno.test("receipt-actor review: persistence failure retries and explicit discard clears the draft", async () => {
  const { local, organization } = await receiptHarness();
  const commit = createReceiptCommitService(local, {
    nextId: (kind) =>
      kind === "receipt" ? "receipt-discarded" : "receipt-discarded-line",
  });
  local.failNext("quota");
  const actor = createActor(
    createReceiptReviewMachine({
      local,
      commit,
      persistenceKey: "workflow:receipt-discard",
    }),
    { input: { persistenceKey: "workflow:receipt-discard" } },
  ).start();
  actor.send({ type: "receipt.review.open", review: reviewDraft() });
  await waitForValue(actor, "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "quota");
  actor.send({ type: "receipt.review.retry" });
  await waitForValue(actor, "persisted");
  actor.send({ type: "receipt.review.discard" });
  await waitForValue(actor, "discarded");
  assertEquals(await local.query("workflow-snapshots"), []);
  assertEquals(
    await local.query("records", { index: "type", equals: "receipt" }),
    [],
  );
  actor.stop();
  void organization;
});

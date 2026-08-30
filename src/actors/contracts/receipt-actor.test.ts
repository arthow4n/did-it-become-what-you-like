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

import { settle, waitForActorState } from "../../test-support/index.ts";

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
      direction: "outflow",
      selected: true,
      rationale: "Product line in the receipt body; classified as an outflow.",
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
        direction: "outflow",
        selected: true,
        rationale: "The product row is visible, but its text is partly hidden.",
        uncertainty: "Receipt text was partly hidden.",
      },
      {
        description: "Bottle return",
        amount: "1",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        kind: "adjustment",
        direction: "inflow",
        selected: true,
        rationale: "Bottle return is listed as a credit adjustment.",
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
  await waitForActorState(actor, "reviewReady");

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
  await waitForActorState(actor, "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "offline");
  actor.send({ type: "receipt.retry", input: scanInput });
  await waitForActorState(actor, "reviewReady");
  assertEquals(released, ["image-memory-only", "image-memory-only"]);
  actor.stop();

  gemini.failNext("not-found");
  const modelLoss = createActor(
    createScanMachine(gemini, preparation, released),
  ).start();
  modelLoss.send({ type: "receipt.open" });
  modelLoss.send({ type: "receipt.image-selected" });
  modelLoss.send({ type: "receipt.scan", input: scanInput });
  await waitForActorState(modelLoss, "failed");
  assertEquals(modelLoss.getSnapshot().context.error?.code, "not-found");
  modelLoss.send({ type: "receipt.replace-image" });
  assertEquals(modelLoss.getSnapshot().value, "selecting");
  assertEquals(modelLoss.getSnapshot().context.error, null);
  modelLoss.send({ type: "receipt.image-selected" });
  assertEquals(modelLoss.getSnapshot().value, "selected");
  assertEquals(modelLoss.getSnapshot().context.error, null);
  modelLoss.send({ type: "receipt.scan", input: scanInput });
  await waitForActorState(modelLoss, "reviewReady");
  modelLoss.stop();

  const resetFailure = createActor(createReceiptScanMachine({
    ai: createFakeGeminiPort(extractionDraft()),
    imagePreparation: preparation,
    resolveImage: () => Promise.reject(new Error("image entry was lost")),
  })).start();
  resetFailure.send({ type: "receipt.open" });
  resetFailure.send({ type: "receipt.image-selected" });
  resetFailure.send({ type: "receipt.scan", input: scanInput });
  await waitForActorState(resetFailure, "failed");
  resetFailure.send({ type: "receipt.reset" });
  assertEquals(resetFailure.getSnapshot().value, "idle");
  assertEquals(resetFailure.getSnapshot().context.error, null);
  resetFailure.stop();
});

Deno.test(
  "receipt-actor scan: resolver failures are typed and cleanup cannot mask extraction errors",
  async () => {
    const preparation = createFakeImagePreparationPort();
    const missingImage = createActor(createReceiptScanMachine({
      ai: createFakeGeminiPort(extractionDraft()),
      imagePreparation: preparation,
      resolveImage: () => Promise.reject(new Error("image entry was lost")),
    })).start();
    missingImage.send({ type: "receipt.open" });
    missingImage.send({ type: "receipt.image-selected" });
    missingImage.send({ type: "receipt.scan", input: scanInput });
    await waitForActorState(missingImage, "failed");
    assertEquals(missingImage.getSnapshot().context.error, {
      code: "not-found",
      message: "The requested resource was not found.",
      retryable: false,
      operation: "receipt.image.resolve",
    });
    missingImage.stop();

    const invalidOutput = createActor(createScanMachine(
      createFakeGeminiPort(extractionDraft({ printedTotal: "not-a-decimal" })),
      preparation,
      [],
    )).start();
    invalidOutput.send({ type: "receipt.open" });
    invalidOutput.send({ type: "receipt.image-selected" });
    invalidOutput.send({ type: "receipt.scan", input: scanInput });
    await waitForActorState(invalidOutput, "failed");
    assertEquals(invalidOutput.getSnapshot().context.error, {
      code: "invalid",
      message: "The supplied data is invalid.",
      retryable: false,
      operation: "receipt.normalize",
    });
    invalidOutput.stop();

    const rawProvider: ReceiptAiPort = {
      listModels: () => Promise.resolve([]),
      testConfiguration: () =>
        Promise.resolve({ status: "needs-test", missingCapabilities: [] }),
      extractReceipt: () =>
        Promise.reject(new Error("provider details must not cross the actor")),
    };
    const rawProviderFailure = createActor(createScanMachine(
      rawProvider,
      preparation,
      [],
    )).start();
    rawProviderFailure.send({ type: "receipt.open" });
    rawProviderFailure.send({ type: "receipt.image-selected" });
    rawProviderFailure.send({ type: "receipt.scan", input: scanInput });
    await waitForActorState(rawProviderFailure, "failed");
    assertEquals(rawProviderFailure.getSnapshot().context.error, {
      code: "unknown",
      message: "The operation failed for an unknown reason.",
      retryable: false,
      operation: "receipt.ai.extract",
    });
    rawProviderFailure.stop();

    const gemini = createFakeGeminiPort(extractionDraft());
    gemini.failNext("quota");
    const cleanupFailure = createActor(createReceiptScanMachine({
      ai: gemini,
      imagePreparation: preparation,
      resolveImage: () =>
        Promise.resolve({
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: "image/jpeg",
          width: 100,
          height: 100,
        }),
      releaseImage: () => {
        throw new Error("cleanup details must not replace the provider error");
      },
    })).start();
    cleanupFailure.send({ type: "receipt.open" });
    cleanupFailure.send({ type: "receipt.image-selected" });
    cleanupFailure.send({ type: "receipt.scan", input: scanInput });
    await waitForActorState(cleanupFailure, "failed");
    assertEquals(cleanupFailure.getSnapshot().context.error, {
      code: "quota",
      message: "Storage or service quota was exceeded.",
      retryable: true,
      operation: "gemini",
    });
    cleanupFailure.stop();
  },
);

Deno.test("receipt-actor scan: repeated extracted lines are consolidated before review", async () => {
  const gemini = createFakeGeminiPort(extractionDraft({
    printedTotal: "-5",
    lines: [{
      description: "Coffee",
      amount: "2.5",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      direction: "outflow",
      selected: true,
      rationale: "The receipt lists this purchased drink.",
    }, {
      description: "coffee",
      amount: "2.5",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      direction: "outflow",
      selected: true,
      rationale: "The receipt lists this purchased drink.",
    }],
  }));
  const actor = createActor(createScanMachine(
    gemini,
    createFakeImagePreparationPort(),
    [],
  )).start();
  actor.send({ type: "receipt.open" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await waitForActorState(actor, "reviewReady");

  const review = actor.getSnapshot().context.review;
  assert(review !== null);
  assertEquals(review.lines.length, 1);
  assertEquals(
    review.lines[0]?.type === "purchase" ? review.lines[0].quantity : undefined,
    "2",
  );
  assertEquals(
    review.lines[0]?.type === "purchase"
      ? review.lines[0].unitPrice
      : undefined,
    "2.5",
  );
  assertEquals(
    review.lines[0]?.type === "purchase"
      ? review.lines[0].lineTotal
      : undefined,
    "-5",
  );
  actor.stop();
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
  await waitForActorState(actor, "preparing");
  actor.send({ type: "receipt.cancel" });
  await waitForActorState(actor, "cancelled");
  assertEquals(released, ["image-memory-only"]);
  actor.stop();
});

Deno.test("receipt-actor scan: reset aborts an active attempt and clears transient failure state", async () => {
  const gemini = createFakeGeminiPort(extractionDraft());
  const preparation = createFakeImagePreparationPort();
  const released: string[] = [];
  gemini.pauseNext();
  const actor = createActor(createScanMachine(gemini, preparation, released))
    .start();
  actor.send({ type: "receipt.open" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await waitForActorState(actor, "preparing");
  actor.send({ type: "receipt.reset" });
  assertEquals(actor.getSnapshot().value, "idle");
  assertEquals(actor.getSnapshot().context.error, null);
  await settle();
  assertEquals(released, ["image-memory-only"]);
  actor.stop();
});

Deno.test("receipt-actor scan: replacing an image cancels an active attempt before selection", async () => {
  const gemini = createFakeGeminiPort(extractionDraft());
  const preparation = createFakeImagePreparationPort();
  const released: string[] = [];
  gemini.pauseNext();
  const actor = createActor(createScanMachine(gemini, preparation, released))
    .start();
  actor.send({ type: "receipt.open" });
  actor.send({ type: "receipt.image-selected" });
  actor.send({ type: "receipt.scan", input: scanInput });
  await waitForActorState(actor, "preparing");
  actor.send({ type: "receipt.replace-image" });
  assertEquals(actor.getSnapshot().value, "selecting");
  assertEquals(actor.getSnapshot().context.error, null);
  actor.send({ type: "receipt.image-selected" });
  assertEquals(actor.getSnapshot().value, "selected");
  await settle();
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
  await waitForActorState(first, "persisted");
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
  await waitForActorState(resumed, "persisted");
  assertEquals(resumed.getSnapshot().context.review?.lines.length, 2);
  resumed.send({ type: "receipt.review.submit", confirmMismatch: false });
  await waitForActorState(resumed, "mismatch");
  resumed.send({ type: "receipt.review.confirm-mismatch" });
  await waitForActorState(resumed, "saved");
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
  await waitForActorState(actor, "failed");
  assertEquals(actor.getSnapshot().context.error?.code, "quota");
  actor.send({ type: "receipt.review.retry" });
  await waitForActorState(actor, "persisted");
  actor.send({ type: "receipt.review.discard" });
  await waitForActorState(actor, "discarded");
  assertEquals(await local.query("workflow-snapshots"), []);
  assertEquals(
    await local.query("records", { index: "type", equals: "receipt" }),
    [],
  );
  actor.stop();
  void organization;
});

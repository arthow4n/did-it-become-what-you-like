import { createActor } from "xstate";
import {
  createManualExpenseMachine,
  type ManualExpenseDraft,
} from "../manual-expense.ts";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
} from "../../domain/organization.ts";
import { type Expense, UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";
import type { JsonValue } from "../../adapters/ports/index.ts";
import {
  createFakeLocalPort,
  type FakeLocalPort,
} from "../../test-support/fakes/ports.ts";

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

import { settle } from "../../test-support/index.ts";

const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-manual",
  name: "Manual project",
  defaultCurrency: "SEK" as const,
  archived: false,
};

type Harness = {
  readonly local: FakeLocalPort;
  readonly service: ProjectCategoryService;
  readonly now: Date;
};

async function createHarness(
  now = new Date(2026, 7, 24, 12, 0, 0),
): Promise<Harness> {
  const local = createFakeLocalPort();
  const service = createProjectCategoryService(local, {
    deviceId: "device-manual-tests",
    now: () => now.toISOString(),
  });
  await service.commitProject({ type: "create", project });
  return { local, service, now };
}

function createExpenseActor(
  harness: Harness,
  persistenceKey: string,
) {
  return createActor(
    createManualExpenseMachine({
      local: harness.local,
      organization: harness.service,
      clock: { now: () => harness.now.toISOString() },
      ids: { next: () => "expense-created" },
    }),
    { input: { persistenceKey } },
  ).start();
}

function expenseRecord(overrides: Partial<Expense> = {}): Expense {
  return {
    schemaVersion: 1,
    type: "expense",
    id: "expense-seeded",
    projectId: project.id,
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    date: "2026-08-24",
    amount: "-3",
    currency: "SEK",
    description: "Seeded",
    source: "manual",
    ...overrides,
  };
}

function draftWith(
  draft: ManualExpenseDraft,
  overrides: Partial<ManualExpenseDraft>,
): ManualExpenseDraft {
  return { ...draft, ...overrides };
}

Deno.test("manual-expense: defaults, canonical signs, create, edit, and duplicate submit", async () => {
  const harness = await createHarness();
  const actor = createExpenseActor(harness, "workflow:create-edit");
  actor.send({ type: "expense.open" });
  await settle();
  assertEquals(actor.getSnapshot().value, "editing");
  const initial = actor.getSnapshot().context.draft;
  assert(initial !== null);
  assertEquals(initial.projectId, project.id);
  assertEquals(initial.categoryId, UNCATEGORIZED_CATEGORY_ID);
  assertEquals(initial.currency, "SEK");
  assertEquals(initial.direction, "spent");
  assertEquals(initial.date, "2026-08-24");

  actor.send({
    type: "expense.change",
    draft: draftWith(initial, {
      amount: "0010.90",
      merchant: " Shop ",
      description: " Coffee ",
      direction: "spent",
      time: "09:15",
    }),
  });
  await settle();
  actor.send({ type: "expense.submit" });
  actor.send({ type: "expense.submit" });
  await settle();

  assertEquals(actor.getSnapshot().value, "saved");
  const result = actor.getSnapshot().context.result;
  assert(result !== null);
  assertEquals(result.operation, "created");
  assertEquals(result.expense.amount, "-10.9");
  assertEquals(result.expense.merchant, "Shop");
  assertEquals(
    harness.local.operations.filter((operation) =>
      operation === "put:records:expense-created"
    ).length,
    1,
  );
  const created = result.expense;
  actor.stop();

  const editActor = createExpenseActor(harness, "workflow:edit");
  editActor.send({ type: "expense.open", request: { expense: created } });
  await settle();
  assertEquals(editActor.getSnapshot().value, "editing");
  const editDraft = editActor.getSnapshot().context.draft;
  assert(editDraft !== null);
  editActor.send({
    type: "expense.change",
    draft: draftWith(editDraft, { amount: "1.2500", direction: "money-back" }),
  });
  await settle();
  editActor.send({ type: "expense.submit" });
  await settle();
  assertEquals(editActor.getSnapshot().value, "saved");
  const editResult = editActor.getSnapshot().context.result;
  assert(editResult !== null);
  assertEquals(editResult.operation, "updated");
  assertEquals(editResult.expense.id, created.id);
  assertEquals(editResult.expense.amount, "1.25");
  editActor.stop();
});

Deno.test("manual-expense: required and invalid decimals stay editable at the 03:00 boundary", async () => {
  const beforeBoundary = await createHarness(new Date(2026, 7, 24, 2, 59, 59));
  const beforeActor = createExpenseActor(beforeBoundary, "workflow:before");
  beforeActor.send({ type: "expense.open" });
  await settle();
  assertEquals(beforeActor.getSnapshot().context.draft?.date, "2026-08-23");
  beforeActor.stop();

  const atBoundary = await createHarness(new Date(2026, 7, 24, 3, 0, 0));
  const atActor = createExpenseActor(atBoundary, "workflow:at");
  atActor.send({ type: "expense.open" });
  await settle();
  assertEquals(atActor.getSnapshot().context.draft?.date, "2026-08-24");

  const draft = atActor.getSnapshot().context.draft;
  assert(draft !== null);
  atActor.send({
    type: "expense.change",
    draft: draftWith(draft, {
      amount: "1e2",
      projectId: "",
      categoryId: "",
      currency: "SE",
      date: "2026-02-30",
    }),
  });
  await settle();
  atActor.send({ type: "expense.submit" });
  assertEquals(atActor.getSnapshot().value, "editing");
  assertEquals(
    atActor.getSnapshot().context.validation.amount,
    "Enter a decimal amount such as 10.90.",
  );
  assertEquals(
    atActor.getSnapshot().context.validation.projectId,
    "Choose a project.",
  );
  assertEquals(
    atActor.getSnapshot().context.validation.categoryId,
    "Choose a category.",
  );
  assertEquals(
    atActor.getSnapshot().context.validation.currency,
    "Choose a three-letter currency code.",
  );
  assertEquals(
    atActor.getSnapshot().context.validation.date,
    "Enter a valid calendar date.",
  );

  atActor.send({
    type: "expense.change",
    draft: draftWith(atActor.getSnapshot().context.draft!, { amount: "" }),
  });
  await settle();
  atActor.send({ type: "expense.submit" });
  assertEquals(
    atActor.getSnapshot().context.validation.amount,
    "Amount is required.",
  );
  atActor.stop();
});

Deno.test("manual-expense: typed save completion supports add-another and saved undo", async () => {
  const harness = await createHarness();
  const addAnother = createExpenseActor(harness, "workflow:add-another");
  addAnother.send({ type: "expense.open" });
  await settle();
  const draft = addAnother.getSnapshot().context.draft;
  assert(draft !== null);
  addAnother.send({
    type: "expense.change",
    draft: draftWith(draft, { amount: "8.25", merchant: "Cafe" }),
  });
  await settle();
  addAnother.send({ type: "expense.submit-and-add-another" });
  await settle();
  assertEquals(addAnother.getSnapshot().value, "editing");
  assertEquals(
    addAnother.getSnapshot().context.result?.expense.amount,
    "-8.25",
  );
  assertEquals(
    addAnother.getSnapshot().context.result?.expense.merchant,
    "Cafe",
  );
  assertEquals(addAnother.getSnapshot().context.originalExpense, null);
  assertEquals(addAnother.getSnapshot().context.draft?.amount, "");
  assertEquals(addAnother.getSnapshot().context.draft?.projectId, project.id);
  addAnother.stop();

  const saved = createExpenseActor(harness, "workflow:saved-undo");
  saved.send({ type: "expense.open" });
  await settle();
  const savedDraft = saved.getSnapshot().context.draft;
  assert(savedDraft !== null);
  saved.send({
    type: "expense.change",
    draft: draftWith(savedDraft, { amount: "2.50" }),
  });
  await settle();
  saved.send({ type: "expense.submit" });
  await settle();
  assertEquals(saved.getSnapshot().value, "saved");
  const savedExpense = saved.getSnapshot().context.result?.expense;
  assert(savedExpense !== undefined);
  saved.send({ type: "expense.undo-saved" });
  await settle();
  assertEquals(saved.getSnapshot().value, "savedUndone");
  assertEquals(
    await harness.local.query("records", {
      index: "id",
      equals: savedExpense.id,
    }),
    [],
  );
  saved.stop();

  const finish = createExpenseActor(harness, "workflow:finish-save");
  finish.send({ type: "expense.open" });
  await settle();
  const finishDraft = finish.getSnapshot().context.draft;
  assert(finishDraft !== null);
  finish.send({
    type: "expense.change",
    draft: draftWith(finishDraft, { amount: "1.00" }),
  });
  await settle();
  finish.send({ type: "expense.submit" });
  await settle();
  finish.send({ type: "expense.finish-save" });
  await settle();
  assertEquals(finish.getSnapshot().value, "savedOutput");
  assertEquals(finish.getSnapshot().status, "done");
  assertEquals(finish.getSnapshot().context.result?.expense.amount, "-1");
  finish.stop();
});

Deno.test("manual-expense: null-draft hydration and open failures retry safely", async () => {
  const harness = await createHarness();
  harness.local.setScenario({ offline: true });

  const hydrate = createExpenseActor(harness, "workflow:hydrate-failure");
  hydrate.send({ type: "expense.hydrate" });
  await settle();
  assertEquals(hydrate.getSnapshot().value, "hydrateFailed");
  assertEquals(hydrate.getSnapshot().context.draft, null);
  assertEquals(hydrate.getSnapshot().context.error?.code, "offline");
  harness.local.setScenario({ offline: false });
  hydrate.send({ type: "expense.retry-draft" });
  await settle();
  assertEquals(hydrate.getSnapshot().value, "idle");
  hydrate.stop();

  harness.local.setScenario({ offline: true });
  const open = createExpenseActor(harness, "workflow:open-failure");
  open.send({ type: "expense.open" });
  await settle();
  assertEquals(open.getSnapshot().value, "openFailed");
  assertEquals(open.getSnapshot().context.draft, null);
  assertEquals(open.getSnapshot().context.error?.code, "offline");
  harness.local.setScenario({ offline: false });
  open.send({ type: "expense.retry-draft" });
  await settle();
  assertEquals(open.getSnapshot().value, "editing");
  assert(open.getSnapshot().context.draft !== null);
  open.stop();
});

Deno.test("manual-expense: queued open starts after empty draft hydration", async () => {
  const harness = await createHarness();
  const actor = createExpenseActor(harness, "workflow:queued-open");
  actor.send({ type: "expense.hydrate" });
  actor.send({ type: "expense.open", request: { projectId: project.id } });
  await settle();
  assertEquals(actor.getSnapshot().value, "editing");
  assertEquals(actor.getSnapshot().context.draft?.projectId, project.id);
  actor.stop();
});

Deno.test("manual-expense: transient and failed edits retain delete and merchant actions", async () => {
  const harness = await createHarness();
  const expense = expenseRecord({ id: "expense-transient-actions" });
  await harness.local.transaction(
    "readwrite",
    (transaction) =>
      transaction.put("records", expense.id, asExpenseValue(expense)),
  );

  const persisting = createExpenseActor(harness, "workflow:delete-persisting");
  persisting.send({ type: "expense.open", request: { expense } });
  await settle();
  persisting.send({
    type: "expense.change",
    draft: draftWith(persisting.getSnapshot().context.draft!, {
      description: "Changed while saving",
    }),
  });
  assertEquals(persisting.getSnapshot().value, "persistingDraft");
  persisting.send({ type: "expense.delete" });
  assertEquals(persisting.getSnapshot().value, "deleteConfirming");
  persisting.stop();

  const draftFailure = createExpenseActor(
    harness,
    "workflow:delete-draft-failure",
  );
  draftFailure.send({ type: "expense.open", request: { expense } });
  await settle();
  harness.local.failNext("quota");
  draftFailure.send({
    type: "expense.change",
    draft: draftWith(draftFailure.getSnapshot().context.draft!, {
      description: "Draft persistence fails",
    }),
  });
  await settle();
  assertEquals(draftFailure.getSnapshot().value, "draftSaveFailed");
  draftFailure.send({ type: "expense.delete" });
  assertEquals(draftFailure.getSnapshot().value, "deleteConfirming");
  draftFailure.stop();

  const saveFailure = createExpenseActor(
    harness,
    "workflow:save-failure-actions",
  );
  saveFailure.send({ type: "expense.open", request: { expense } });
  await settle();
  harness.local.failNext("quota");
  saveFailure.send({ type: "expense.submit" });
  await settle();
  assertEquals(saveFailure.getSnapshot().value, "saveFailed");
  saveFailure.send({ type: "expense.merchant.choose", merchant: " Market " });
  await settle();
  assertEquals(saveFailure.getSnapshot().value, "editing");
  assertEquals(saveFailure.getSnapshot().context.draft?.merchant, "Market");
  saveFailure.send({ type: "expense.merchant.clear" });
  await settle();
  assertEquals(saveFailure.getSnapshot().context.draft?.merchant, undefined);
  harness.local.failNext("quota");
  saveFailure.send({ type: "expense.submit" });
  await settle();
  assertEquals(saveFailure.getSnapshot().value, "saveFailed");
  saveFailure.send({ type: "expense.delete" });
  assertEquals(saveFailure.getSnapshot().value, "deleteConfirming");
  saveFailure.stop();
});

Deno.test("manual-expense: failed save-and-add-another keeps the draft editable", async () => {
  const harness = await createHarness();
  const actor = createExpenseActor(harness, "workflow:save-another-failure");
  actor.send({ type: "expense.open" });
  await settle();
  actor.send({
    type: "expense.change",
    draft: draftWith(actor.getSnapshot().context.draft!, { amount: "9.25" }),
  });
  await settle();
  harness.local.failNext("quota");
  actor.send({ type: "expense.submit-and-add-another" });
  await settle();
  assertEquals(actor.getSnapshot().value, "saveAnotherFailed");
  assert(actor.getSnapshot().hasTag("dirty"));
  assertEquals(actor.getSnapshot().context.draft?.amount, "9.25");
  actor.send({
    type: "expense.change",
    draft: draftWith(actor.getSnapshot().context.draft!, {
      description: "Corrected after failed save",
    }),
  });
  await settle();
  assertEquals(actor.getSnapshot().value, "editing");
  assertEquals(actor.getSnapshot().context.draft?.amount, "9.25");
  assertEquals(
    actor.getSnapshot().context.draft?.description,
    "Corrected after failed save",
  );
  actor.stop();
});

Deno.test("manual-expense: merchant suggestions can be chosen and cleared", async () => {
  const harness = await createHarness();
  await harness.local.transaction("readwrite", async (transaction) => {
    await transaction.put(
      "records",
      "expense-old",
      asExpenseValue(expenseRecord({
        id: "expense-old",
        date: "2026-08-22",
        merchant: "Market",
      })),
    );
    await transaction.put(
      "records",
      "expense-new",
      asExpenseValue(expenseRecord({
        id: "expense-new",
        merchant: "Cafe",
      })),
    );
    await transaction.put(
      "records",
      "expense-duplicate",
      asExpenseValue(expenseRecord({
        id: "expense-duplicate",
        date: "2026-08-23",
        merchant: "cafe",
      })),
    );
  });
  const actor = createExpenseActor(harness, "workflow:suggestions");
  actor.send({ type: "expense.open" });
  await settle();
  assertEquals(actor.getSnapshot().context.suggestions, ["Cafe", "Market"]);
  actor.send({ type: "expense.merchant.choose", merchant: " Cafe " });
  await settle();
  assertEquals(actor.getSnapshot().context.draft?.merchant, "Cafe");
  actor.send({ type: "expense.merchant.clear" });
  await settle();
  assertEquals(actor.getSnapshot().context.draft?.merchant, undefined);
  actor.stop();
});

Deno.test("manual-expense: draft survives reload and discard confirmation clears it", async () => {
  const harness = await createHarness();
  const first = createExpenseActor(harness, "workflow:reload");
  first.send({ type: "expense.open" });
  await settle();
  const draft = first.getSnapshot().context.draft;
  assert(draft !== null);
  first.send({
    type: "expense.change",
    draft: draftWith(draft, { amount: "7.50", description: "Durable" }),
  });
  await settle();
  assert(
    harness.local.operations.includes(
      "put:workflow-snapshots:workflow:reload",
    ),
  );
  first.stop();

  const reloaded = createExpenseActor(harness, "workflow:reload");
  reloaded.send({ type: "expense.hydrate" });
  await settle();
  assertEquals(reloaded.getSnapshot().value, "editing");
  assertEquals(reloaded.getSnapshot().context.draft?.amount, "7.5");
  assertEquals(reloaded.getSnapshot().context.draft?.description, "Durable");
  reloaded.send({ type: "expense.back" });
  assertEquals(reloaded.getSnapshot().value, "discardConfirming");
  reloaded.send({ type: "expense.keep-editing" });
  assertEquals(reloaded.getSnapshot().value, "editing");
  reloaded.send({ type: "expense.discard" });
  reloaded.send({ type: "expense.confirm-discard" });
  await settle();
  assertEquals(reloaded.getSnapshot().value, "discarded");
  assertEquals(
    await harness.local.query("workflow-snapshots"),
    [],
  );
  reloaded.stop();
});

Deno.test("manual-expense: repository failure retains input and retry saves", async () => {
  const harness = await createHarness();
  const actor = createExpenseActor(harness, "workflow:retry");
  actor.send({ type: "expense.open" });
  await settle();
  const draft = actor.getSnapshot().context.draft;
  assert(draft !== null);
  actor.send({
    type: "expense.change",
    draft: draftWith(draft, { amount: "4.00" }),
  });
  await settle();
  harness.local.setScenario({ offline: true });
  actor.send({ type: "expense.submit" });
  await settle();
  assertEquals(actor.getSnapshot().value, "saveFailed");
  assertEquals(actor.getSnapshot().context.error?.code, "offline");
  assertEquals(actor.getSnapshot().context.draft?.amount, "4");
  harness.local.setScenario({ offline: false });
  actor.send({ type: "expense.retry" });
  await settle();
  assertEquals(actor.getSnapshot().value, "saved");
  actor.stop();
});

Deno.test("manual-expense: delete and undo restore the local record", async () => {
  const harness = await createHarness();
  const expense = expenseRecord({ id: "expense-delete" });
  await harness.local.transaction(
    "readwrite",
    (transaction) =>
      transaction.put("records", expense.id, asExpenseValue(expense)),
  );
  const actor = createExpenseActor(harness, "workflow:delete");
  actor.send({ type: "expense.open", request: { expense } });
  await settle();
  actor.send({ type: "expense.delete" });
  assertEquals(actor.getSnapshot().value, "deleteConfirming");
  actor.send({ type: "expense.confirm-delete" });
  await settle();
  assertEquals(actor.getSnapshot().value, "deleted");
  assertEquals(
    await harness.local.query("records", { index: "id", equals: expense.id }),
    [],
  );
  actor.send({ type: "expense.undo" });
  await settle();
  assertEquals(actor.getSnapshot().value, "undone");
  assertEquals(
    (await harness.local.query<Expense>("records", {
      index: "id",
      equals: expense.id,
    }))[0]?.value.amount,
    "-3",
  );
  actor.stop();
});

function asExpenseValue(expense: Expense): JsonValue {
  return expense as unknown as JsonValue;
}

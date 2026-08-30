import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGeminiAdapter,
  createGoogleGenAiClient,
  createImagePreparationPort,
  geminiModelCapabilityLabel,
  REQUIRED_RECEIPT_AI_CAPABILITIES,
} from "../adapters/gemini/index.ts";
import {
  type ImageInput,
  type ReceiptAiModel,
  type ReceiptAiPort,
  type SecretStoragePort,
} from "../adapters/ports/index.ts";
import { createLocalStorageSecretStorage } from "../adapters/gemini/secrets.ts";
import type { ReceiptAiModelQuery } from "../adapters/ports/receipt-ai.ts";
import type { LocalPort } from "../adapters/ports/local.ts";
import type { JsonValue } from "../adapters/ports/common.ts";
import {
  CalendarDateSchema,
  CanonicalDecimalSchema,
  type Category,
  CurrencyCodeSchema,
  type DeviceLocalGeminiCompatibility,
  type DeviceLocalSettings,
  DeviceLocalSettingsSchema,
  StableIdSchema,
} from "../domain/index.ts";
import {
  type ReceiptDraftLine,
  receiptMismatchDifference,
  type ReceiptReviewDraft,
  receiptSelectedTotal,
} from "../domain/receipt.ts";
import type { ProjectCategoryState } from "../domain/organization.ts";
import {
  createReceiptReviewMachine,
  createReceiptScanMachine,
  type ReceiptImageResolver,
  type ReceiptReviewActorEvent,
  type ReceiptScanMachineDependencies,
} from "../actors/receipt.ts";
import type {
  ContractFailure,
  ReceiptImageRef,
} from "../actors/contracts/index.ts";
import { ArrowLeft, X } from "lucide-react";
import {
  AdaptiveDialog,
  Button,
  Card,
  ContentContainer,
  ErrorState,
  FileField,
  FormActions,
  GeminiConfigurationTest,
  GeminiQuickSetup,
  Heading,
  IconButton,
  Inline,
  InlineNotice,
  List,
  ListRow,
  ModelPicker,
  NativeDateField,
  PageHeader,
  ReceiptLineCard,
  ReceiptLineEditor,
  ReceiptMetadata,
  ReceiptReconciliation,
  ReceiptSourcePicker,
  Stack,
  StatusPanel,
  StickyActionBar,
  Switch,
  Text,
  TextField,
} from "../design-system/index.ts";
import { useSyncStatus } from "./sync-ui/index.ts";

const DEVICE_SETTINGS_KEY = "settings-device-local";
const DEFAULT_MODEL_QUERY: ReceiptAiModelQuery = {
  requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
};
const GEMINI_COMPATIBILITY_EVIDENCE_VERSION = "receipt-compatibility.v1";
const LEGACY_GEMINI_KEY_REVISION = "legacy-key";

type ReceiptGeminiPort = ReceiptAiPort & {
  getApiKey(options?: { signal?: AbortSignal }): Promise<
    {
      reveal(): string;
    } | undefined
  >;
  setApiKey(value: string, options?: { signal?: AbortSignal }): Promise<void>;
  removeApiKey(options?: { signal?: AbortSignal }): Promise<void>;
};

export type ReceiptUiDependencies = ReceiptScanMachineDependencies & {
  readonly ai: ReceiptAiPort;
  readonly gemini: ReceiptGeminiPort;
};

type ReceiptImageEntry = {
  readonly file: File;
  readonly previewUrl: string;
  bytes?: Uint8Array;
};

function modelFingerprint(model: ReceiptAiModel): string {
  return [
    model.id,
    model.lifecycle,
    ...REQUIRED_RECEIPT_AI_CAPABILITIES.map((capability) =>
      model.capabilities[capability] ? "1" : "0"
    ),
  ].join("|");
}

function geminiKeyRevision(settings: DeviceLocalSettings): string {
  return settings.geminiKeyRevision ?? LEGACY_GEMINI_KEY_REVISION;
}

function compatibilityEvidenceFor(
  settings: DeviceLocalSettings,
  model: ReceiptAiModel,
): DeviceLocalGeminiCompatibility | undefined {
  return settings.geminiCompatibilityEvidence?.find((evidence) =>
    evidence.modelId === model.id &&
    evidence.modelFingerprint === modelFingerprint(model) &&
    evidence.keyRevision === geminiKeyRevision(settings) &&
    evidence.evidenceVersion === GEMINI_COMPATIBILITY_EVIDENCE_VERSION
  );
}

function recordCompatibilityEvidence(
  settings: DeviceLocalSettings,
  model: ReceiptAiModel,
  status: DeviceLocalGeminiCompatibility["status"],
  keyRevision = geminiKeyRevision(settings),
): DeviceLocalSettings {
  const nextEvidence: DeviceLocalGeminiCompatibility = {
    modelId: model.id,
    modelFingerprint: modelFingerprint(model),
    keyRevision,
    evidenceVersion: GEMINI_COMPATIBILITY_EVIDENCE_VERSION,
    status,
  };
  const prior =
    settings.geminiCompatibilityEvidence?.filter((evidence) =>
      evidence.modelId !== model.id || evidence.keyRevision !== keyRevision
    ) ?? [];
  return {
    ...settings,
    geminiKeyRevision: keyRevision,
    geminiCompatibilityEvidence: [...prior, nextEvidence].slice(-32),
  };
}

function newGeminiKeyRevision(): string {
  return `key-revision-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
}

export class ReceiptImageStore {
  readonly #entries = new Map<string, ReceiptImageEntry>();

  add(file: File): ReceiptImageRef & { readonly previewUrl: string } {
    const ephemeralId = `receipt-image-${
      globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random()}`
    }`;
    const previewUrl = URL.createObjectURL(file);
    this.#entries.set(ephemeralId, { file, previewUrl });
    return {
      ephemeralId,
      mediaType: file.type,
      byteLength: file.size,
      previewUrl,
    };
  }

  async resolve(ref: ReceiptImageRef): Promise<ImageInput> {
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) {
      throw new Error("The selected receipt image is no longer available.");
    }
    const bytes = entry.bytes ?? new Uint8Array(await entry.file.arrayBuffer());
    entry.bytes = bytes;
    const dimensions = await imageDimensions(entry.file);
    return {
      bytes: bytes.slice(),
      mimeType: entry.file.type,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  release(ref: ReceiptImageRef): void {
    this.remove(ref);
  }

  /**
   * Discard decoded bytes after an attempt while retaining the ephemeral file
   * and preview URL for an in-session retry.
   */
  releaseForRetry(ref: ReceiptImageRef): void {
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) return;
    entry.bytes?.fill(0);
    entry.bytes = undefined;
  }

  remove(ref: ReceiptImageRef): void {
    const entry = this.#entries.get(ref.ephemeralId);
    if (!entry) return;
    URL.revokeObjectURL(entry.previewUrl);
    entry.bytes?.fill(0);
    this.#entries.delete(ref.ephemeralId);
  }

  clear(): void {
    for (const id of this.#entries.keys()) {
      const entry = this.#entries.get(id);
      if (entry) {
        URL.revokeObjectURL(entry.previewUrl);
        entry.bytes?.fill(0);
      }
    }
    this.#entries.clear();
  }
}

async function imageDimensions(
  file: File,
): Promise<{ readonly width: number; readonly height: number }> {
  if (typeof createImageBitmap !== "function") return { width: 1, height: 1 };
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return { width: 1, height: 1 };
  }
}

function messageForError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function readJsonRecord(value: JsonValue | undefined): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function readDeviceLocalSettings(
  local: LocalPort,
): Promise<DeviceLocalSettings> {
  const value = await local.transaction(
    "readonly",
    (transaction) =>
      transaction.get<JsonValue>("settings", DEVICE_SETTINGS_KEY),
  );
  const parsed = DeviceLocalSettingsSchema.safeParse(readJsonRecord(value));
  return parsed.success ? parsed.data : { imagePreparationEnabled: true };
}

export async function writeDeviceLocalSettings(
  local: LocalPort,
  settings: DeviceLocalSettings,
): Promise<void> {
  const safe = DeviceLocalSettingsSchema.parse({
    imagePreparationEnabled: settings.imagePreparationEnabled,
    ...(settings.lastSelectedProjectId === undefined
      ? {}
      : { lastSelectedProjectId: settings.lastSelectedProjectId }),
    ...(settings.selectedGeminiModel === undefined
      ? {}
      : { selectedGeminiModel: settings.selectedGeminiModel }),
    ...(settings.geminiKeyRevision === undefined
      ? {}
      : { geminiKeyRevision: settings.geminiKeyRevision }),
    ...(settings.geminiCompatibilityEvidence === undefined
      ? {}
      : { geminiCompatibilityEvidence: settings.geminiCompatibilityEvidence }),
  });
  await local.transaction(
    "readwrite",
    (transaction) =>
      transaction.put(
        "settings",
        DEVICE_SETTINGS_KEY,
        safe as unknown as JsonValue,
      ),
  );
}

export function createDefaultReceiptUiDependencies(
  imageStore: ReceiptImageStore,
): { dependencies: ReceiptUiDependencies; secretStorage: SecretStoragePort } {
  const secretStorage = createLocalStorageSecretStorage();
  const gemini = createGeminiAdapter({
    secretStorage,
    createClient: createGoogleGenAiClient,
  });
  const imagePreparation = createImagePreparationPort();
  const resolveImage: ReceiptImageResolver = (image) =>
    imageStore.resolve(image);
  return {
    secretStorage,
    dependencies: {
      ai: gemini,
      gemini,
      imagePreparation,
      resolveImage,
      releaseImage: (image) => imageStore.releaseForRetry(image),
    },
  };
}

export function modelOptions(
  models: readonly ReceiptAiModel[],
  settings: DeviceLocalSettings,
): Array<{
  id: string;
  label: string;
  status: "Compatible" | "Incompatible" | "Needs test";
  disabled?: boolean;
  reason?: string;
}> {
  return models.map((model) => {
    const evidence = compatibilityEvidenceFor(settings, model);
    const label = model.lifecycle !== "active"
      ? "Incompatible"
      : evidence?.status === "compatible"
      ? "Compatible"
      : evidence?.status === "incompatible"
      ? "Incompatible"
      : geminiModelCapabilityLabel(model, DEFAULT_MODEL_QUERY);
    return {
      id: model.id,
      label: `${model.displayName} · ${label}`,
      status: label,
      disabled: label === "Incompatible",
      ...(label === "Incompatible"
        ? {
          reason: model.lifecycle === "active"
            ? "Missing receipt capabilities"
            : model.lifecycle,
        }
        : {}),
    };
  });
}

function categoryOptions(categories: readonly Category[]) {
  return categories.filter((category) => !category.archived).map((
    category,
  ) => ({
    id: category.id,
    label: category.name,
  }));
}

function makeLineId(): string {
  return StableIdSchema.parse(
    `receipt-line-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );
}

function lineViewModel(
  line: ReceiptDraftLine,
  categories: readonly Category[],
) {
  const category = categories.find((candidate) =>
    candidate.id === line.categoryId
  );
  return {
    id: line.id,
    type: line.type,
    description: line.description,
    category: category?.name ?? "Uncategorized",
    amount: line.type === "purchase" ? line.lineTotal : line.amount,
    selected: line.selected,
    uncertain: line.uncertain,
    selectionReason: line.selectionReason,
    classificationReason: line.classificationReason,
    ...(line.type === "purchase"
      ? { quantity: line.quantity, unitPrice: line.unitPrice }
      : {}),
  };
}

export function ReceiptDisclosure({ onAccept, onDecline }: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <>
      <Card as="section">
        <Stack gap={4}>
          <Heading size="sm">Before sending this receipt</Heading>
          <Text>
            This receipt image, the extraction schema and instructions, active
            category IDs and names, your device locale, and the project currency
            code may be sent to Google Gemini for extraction.
          </Text>
          <Text tone="secondary">
            Expense history, project names, Drive data, other device identifiers
            or details, and sync metadata are excluded. The image remains only
            in memory while this scan is open and is removed when you leave or
            complete it; it is never saved to this app.
          </Text>
          <Inline>
            <Button variant="quiet" onPress={onDecline}>Cancel</Button>
          </Inline>
        </Stack>
      </Card>
      <StickyActionBar>
        <Button onPress={onAccept}>Continue to scan</Button>
      </StickyActionBar>
    </>
  );
}

export type ReceiptScanFailureNoticeProps = {
  readonly failure: ContractFailure;
  readonly canRetry: boolean;
  readonly onRetry: () => void;
  readonly onChooseAnotherImage: () => void;
  readonly onUseManualEntry: () => void;
};

/**
 * Keep scan failures useful without allowing provider text into the screen.
 * The actor supplies the allowlisted message, code, and bounded operation.
 */
export function ReceiptScanFailureNotice({
  failure,
  canRetry,
  onRetry,
  onChooseAnotherImage,
  onUseManualEntry,
}: ReceiptScanFailureNoticeProps) {
  return (
    <InlineNotice tone="danger" title="Receipt scan failed">
      {failure.message}
      <Text size="caption" tone="secondary">
        Error code: {failure.code}
        {failure.operation ? ` · Operation: ${failure.operation}` : ""}
      </Text>
      <Inline>
        <Button
          variant="secondary"
          isDisabled={!canRetry}
          onPress={onRetry}
        >
          Retry
        </Button>
        <Button variant="quiet" onPress={onChooseAnotherImage}>
          Choose another image
        </Button>
        <Button variant="quiet" onPress={onUseManualEntry}>
          Use manual entry
        </Button>
      </Inline>
    </InlineNotice>
  );
}

export function ReceiptScanScreen({
  dependencies,
  secretStorage,
  imageStore,
  state,
  settings,
  offline,
  onSettingsChange,
  onDirtyChange,
  discardRequest,
  onDirtyDiscarded,
  onReview,
  onClose,
  onOpenSettings,
}: {
  dependencies: ReceiptUiDependencies;
  secretStorage: SecretStoragePort;
  imageStore: ReceiptImageStore;
  state: ProjectCategoryState;
  settings: DeviceLocalSettings;
  offline: boolean;
  onSettingsChange: (settings: DeviceLocalSettings) => void;
  onDirtyChange?: (dirty: boolean) => void;
  discardRequest?: number;
  onDirtyDiscarded?: () => void;
  onReview: (review: ReceiptReviewDraft) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const machine = useMemo(
    () => createReceiptScanMachine(dependencies),
    [dependencies],
  );
  const [snapshot, send] = useActor(machine, { input: {} });
  const [selectedImage, setSelectedImage] = useState<
    (ReceiptImageRef & { readonly previewUrl: string }) | null
  >(null);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState<string>();
  const [keyBusy, setKeyBusy] = useState(false);
  const [models, setModels] = useState<readonly ReceiptAiModel[]>([]);
  const [modelError, setModelError] = useState<string>();
  const [modelsLoading, setModelsLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [pendingScan, setPendingScan] = useState(false);
  const [testState, setTestState] = useState<
    "idle" | "testing" | "passed" | "failed"
  >("idle");
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const openSent = useRef(false);
  const reviewSent = useRef(false);
  const selectedImageRef = useRef(selectedImage);
  const pendingScanRef = useRef(false);
  const quickSetupReturnFocusRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const handledDiscardRequest = useRef(discardRequest ?? 0);

  const setPendingScanState = (value: boolean) => {
    pendingScanRef.current = value;
    setPendingScan(value);
  };

  const clearSelectedImage = () => {
    if (selectedImageRef.current) imageStore.remove(selectedImageRef.current);
    selectedImageRef.current = null;
    setSelectedImage(null);
    if (sourceInputRef.current) sourceInputRef.current.value = "";
  };

  useEffect(() => {
    selectedImageRef.current = selectedImage;
  }, [selectedImage]);

  useEffect(() => () => {
    // Stop the invoked scan before its in-memory image reference is removed.
    // This also covers route changes and component teardown that bypass the
    // visible close button.
    send({ type: "receipt.cancel" });
    if (selectedImageRef.current) imageStore.remove(selectedImageRef.current);
    imageStore.clear();
  }, [imageStore, send]);

  useEffect(() => {
    if (openSent.current) return;
    openSent.current = true;
    send({
      type: "receipt.open",
      disclosureRequired: !disclosureAccepted,
    });
  }, [disclosureAccepted, send]);

  useEffect(() => {
    if (offline && snapshot.matches("selecting")) {
      send({ type: "receipt.network.offline" });
    } else if (!offline && snapshot.matches("offline")) {
      send({ type: "receipt.network.online" });
    }
  }, [offline, send, snapshot]);

  useEffect(() => {
    if (
      !optionsOpen ||
      typeof globalThis.matchMedia !== "function" ||
      !globalThis.matchMedia("(max-width: 719px)").matches
    ) return;
    optionsRef.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [optionsOpen]);

  useEffect(() => {
    let active = true;
    void secretStorage.get("gemini-api-key").then((key) => {
      if (active) setHasKey(key !== undefined);
    }).catch(() => {
      if (active) {
        setKeyError("Gemini key storage is unavailable on this device.");
      }
    });
    return () => {
      active = false;
    };
  }, [secretStorage]);

  const refreshModels = async (): Promise<readonly ReceiptAiModel[]> => {
    setModelsLoading(true);
    setModelError(undefined);
    try {
      const next = await dependencies.ai.listModels(DEFAULT_MODEL_QUERY);
      setModels(next);
      return next;
    } catch (error) {
      setModelError(
        messageForError(error, "Available Gemini models could not be loaded."),
      );
      return [];
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasKey || offline || models.length > 0) return;
    void refreshModels();
  }, [hasKey, offline, models.length]);

  useEffect(() => {
    if (
      snapshot.matches("reviewReady") && snapshot.context.review &&
      !reviewSent.current
    ) {
      reviewSent.current = true;
      clearSelectedImage();
      onReview(snapshot.context.review);
    }
  }, [imageStore, onReview, snapshot]);

  useEffect(() => {
    if (snapshot.matches("cancelled") || snapshot.matches("manualEntry")) {
      clearSelectedImage();
      onClose();
    }
  }, [onClose, snapshot]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (
      !(["image/jpeg", "image/png", "image/webp"] as string[]).includes(
        file.type,
      )
    ) {
      setModelError("Choose a JPEG, PNG, or WebP receipt image.");
      return;
    }
    // The picker remains available while a scan is running. Cancel the
    // current invocation before removing its ephemeral source so a resolver
    // cannot report `receipt.image.resolve not-found` for the old image.
    const needsSelectionReset = scanBusy || snapshot.matches("failed");
    if (needsSelectionReset) send({ type: "receipt.replace-image" });
    if (selectedImage) imageStore.remove(selectedImage);
    const next = imageStore.add(file);
    setSelectedImage(next);
    selectedImageRef.current = next;
    reviewSent.current = false;
    if (needsSelectionReset || snapshot.matches("selecting")) {
      send({ type: "receipt.image-selected" });
    } else if (snapshot.matches("offline")) {
      setModelError(
        "Scanning is unavailable while offline. The image was not queued.",
      );
    }
  };

  const startFilePicker = (capture: boolean) => {
    const input = sourceInputRef.current;
    if (input) {
      input.value = "";
      if (capture) input.setAttribute("capture", "environment");
      else input.removeAttribute("capture");
    }
    setCaptureMode(capture);
    input?.click();
  };

  const saveAndContinue = async () => {
    if (!apiKey.trim()) {
      setKeyError("Enter an API key.");
      return;
    }
    setKeyBusy(true);
    setKeyError(undefined);
    try {
      await dependencies.gemini.setApiKey(apiKey.trim());
      const nextSettings = {
        ...settings,
        geminiKeyRevision: newGeminiKeyRevision(),
        geminiCompatibilityEvidence: [],
      };
      onSettingsChange(nextSettings);
      const nextModels = await refreshModels();
      if (nextModels.length === 0) {
        throw new Error("The key did not return any Gemini models.");
      }
      const nextModelOptions = modelOptions(nextModels, nextSettings);
      const nextSelectedModel = settings.selectedGeminiModel &&
          nextModelOptions.find((option) =>
              option.id === settings.selectedGeminiModel
            )?.status === "Compatible"
        ? settings.selectedGeminiModel
        : undefined;
      setHasKey(true);
      setApiKey("");
      setQuickSetupOpen(false);
      setOptionsOpen(true);
      if (nextSelectedModel) {
        const pendingScanInput = makeScanInput(nextSelectedModel);
        if (!pendingScanInput) throw new Error("The receipt image is missing.");
        setPendingScanState(false);
        setModelError(undefined);
        send({ type: "receipt.scan", input: pendingScanInput });
      } else {
        setPendingScanState(true);
        setModelError(
          "Select a compatible Gemini model to continue this scan.",
        );
      }
    } catch (error) {
      setKeyError(
        messageForError(error, "The API key could not be validated."),
      );
    } finally {
      setKeyBusy(false);
    }
  };

  const availableModelOptions = modelOptions(models, settings);
  const selectedOption = settings.selectedGeminiModel
    ? availableModelOptions.find((option) =>
      option.id === settings.selectedGeminiModel
    )
    : undefined;
  const selectedModel = selectedOption?.status === "Compatible"
    ? selectedOption.id
    : undefined;
  const project =
    state.projects.find((candidate) =>
      candidate.id === state.selectedProjectId
    ) ?? state.projects.find((candidate) => !candidate.archived);
  const categoryCatalogue = state.categories.filter((category) =>
    !category.archived
  )
    .map((category) => ({ id: category.id, name: category.name }));
  const makeScanInput = (model: string) =>
    selectedImage && project
      ? {
        image: selectedImage,
        projectId: project.id,
        currency: project.defaultCurrency,
        locale: globalThis.navigator?.language ?? "en-US",
        categoryCatalogue,
        model,
        prepareImage: settings.imagePreparationEnabled,
        disclosure: {
          version: "receipt-disclosure.v1",
          accepted: true as const,
        },
      }
      : null;
  const scanInput = selectedModel ? makeScanInput(selectedModel) : null;
  const selectModel = (modelId: string) => {
    const option = availableModelOptions.find((candidate) =>
      candidate.id === modelId
    );
    const nextSettings = { ...settings, selectedGeminiModel: modelId };
    setTestState("idle");
    void onSettingsChange(nextSettings);
    if (pendingScanRef.current && option?.status === "Compatible") {
      const pendingInput = makeScanInput(modelId);
      if (!pendingInput) return;
      setPendingScanState(false);
      setOptionsOpen(false);
      setModelError(undefined);
      send({ type: "receipt.scan", input: pendingInput });
    }
  };
  const testSelectedModel = async () => {
    const selectedId = settings.selectedGeminiModel;
    const model = selectedId
      ? models.find((candidate) => candidate.id === selectedId)
      : undefined;
    if (!selectedId || !model) return;
    setTestState("testing");
    setModelError(undefined);
    try {
      const result = await dependencies.ai.testConfiguration(
        selectedId,
        DEFAULT_MODEL_QUERY,
      );
      const nextSettings = recordCompatibilityEvidence(
        settings,
        model,
        result.status === "compatible" ? "compatible" : "incompatible",
      );
      onSettingsChange(nextSettings);
      if (result.status === "compatible") {
        setTestState("passed");
        if (pendingScanRef.current) {
          const pendingInput = makeScanInput(selectedId);
          if (pendingInput) {
            setPendingScanState(false);
            setOptionsOpen(false);
            send({ type: "receipt.scan", input: pendingInput });
          }
        }
      } else {
        setTestState("failed");
        setModelError("This model is incompatible with receipt scanning.");
      }
    } catch (error) {
      setTestState("failed");
      setModelError(
        messageForError(error, "The model compatibility test failed."),
      );
    }
  };
  const scan = () => {
    if (!selectedImage) return;
    // A discard can reset the actor before React has finished tearing down the
    // screen. Keep the visible selected image and actor state in sync instead
    // of silently sending a scan event that `idle`/`selecting` cannot handle.
    if (snapshot.matches("idle")) {
      send({ type: "receipt.open", disclosureRequired: false });
      send({ type: "receipt.image-selected" });
    } else if (snapshot.matches("selecting")) {
      send({ type: "receipt.image-selected" });
    }
    if (!hasKey) {
      const activeElement = document.activeElement;
      quickSetupReturnFocusRef.current = activeElement instanceof HTMLElement
        ? activeElement
        : null;
      setPendingScanState(true);
      setQuickSetupOpen(true);
      return;
    }
    if (!settings.selectedGeminiModel) {
      setPendingScanState(true);
      setOptionsOpen(true);
      setModelError("Select a compatible Gemini model before scanning.");
      return;
    }
    if (selectedOption?.status === "Needs test") {
      setPendingScanState(true);
      setOptionsOpen(true);
      setModelError("Test this Gemini model before scanning.");
      return;
    }
    if (!scanInput) {
      setModelError(
        "The selected Gemini model is not compatible with receipt scanning.",
      );
      return;
    }
    setPendingScanState(false);
    send(
      snapshot.matches("failed")
        ? { type: "receipt.retry", input: scanInput }
        : { type: "receipt.scan", input: scanInput },
    );
  };

  const actorFailure = snapshot.context.error;
  const scanBusy = snapshot.matches("preparing") ||
    snapshot.matches("requesting") ||
    snapshot.matches("validating");

  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    send({ type: "receipt.reset" });
    clearSelectedImage();
    imageStore.clear();
    setPendingScanState(false);
    setQuickSetupOpen(false);
    setOptionsOpen(false);
    setModelError(undefined);
    onDirtyChange?.(false);
    onDirtyDiscarded?.();
  }, [
    discardRequest,
    imageStore,
    onDirtyChange,
    onDirtyDiscarded,
    send,
  ]);

  useEffect(() => {
    onDirtyChange?.(
      selectedImage !== null || scanBusy || quickSetupOpen || pendingScan,
    );
  }, [
    onDirtyChange,
    pendingScan,
    quickSetupOpen,
    scanBusy,
    selectedImage,
  ]);
  if (snapshot.matches("disclosure")) {
    return (
      <ContentContainer size="form">
        <PageHeader
          title="Scan receipt"
          headingLevel={1}
          leading={
            <IconButton
              icon={<X />}
              aria-label="Close"
              variant="quiet"
              onPress={() => send({ type: "receipt.cancel" })}
            />
          }
        />
        <ReceiptDisclosure
          onAccept={() => {
            setDisclosureAccepted(true);
            send({ type: "receipt.disclosure.accept" });
          }}
          onDecline={() => send({ type: "receipt.disclosure.decline" })}
        />
      </ContentContainer>
    );
  }

  if (snapshot.matches("offline")) {
    return (
      <ContentContainer size="form">
        <PageHeader
          title="Scan receipt"
          headingLevel={1}
          leading={
            <IconButton
              icon={<X />}
              aria-label="Close"
              variant="quiet"
              onPress={() => send({ type: "receipt.cancel" })}
            />
          }
        />
        <InlineNotice tone="warning" title="Scanning is unavailable offline">
          Connect to the internet to send a receipt to Gemini. The selected
          image is not queued for later.
          <Inline>
            <Button
              variant="secondary"
              onPress={() => send({ type: "receipt.use-manual" })}
            >
              Use manual entry
            </Button>
            <Button variant="quiet" onPress={onClose}>Close</Button>
          </Inline>
        </InlineNotice>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer size="form">
      <FileField
        label="Receipt image file"
        accept="image/jpeg,image/png,image/webp"
        capture={captureMode ? "environment" : undefined}
        multiple={false}
        className="receipt-ui-file-field"
        inputRef={sourceInputRef}
        onChange={(event) => void chooseFile(event.currentTarget.files?.[0])}
      />
      <Stack gap={5}>
        <PageHeader
          title="Scan receipt"
          headingLevel={1}
          leading={
            <IconButton
              icon={<X />}
              aria-label="Close"
              variant="quiet"
              onPress={() => send({ type: "receipt.cancel" })}
            />
          }
        />
        <ReceiptSourcePicker
          preview={selectedImage
            ? (
              <img
                src={selectedImage.previewUrl}
                alt="Selected receipt preview"
                className="receipt-ui-preview"
              />
            )
            : undefined}
          onTakePhoto={() => startFilePicker(true)}
          onChooseImage={() => startFilePicker(false)}
          onRemove={() => {
            if (scanBusy || snapshot.matches("failed")) {
              send({ type: "receipt.replace-image" });
            }
            clearSelectedImage();
            setPendingScanState(false);
            setModelError(undefined);
          }}
        />
        {selectedImage
          ? (
            <InlineNotice tone="info" title="Receipt is sent to Google Gemini.">
              Embedded metadata is always removed before sending. The image
              remains in memory only while this scan is open so you can retry or
              replace it; it is removed when you leave, discard, or complete the
              scan.
            </InlineNotice>
          )
          : null}
        <StatusPanel
          title={selectedOption
            ? `Gemini: ${selectedOption.id} · ${selectedOption.status}`
            : "Gemini model not selected"}
          detail={pendingScan
            ? "Select a compatible model to continue this scan"
            : settings.imagePreparationEnabled
            ? "Image preparation: On"
            : "Image preparation: Off · privacy sanitization remains on"}
          action={
            <Button
              variant="quiet"
              onPress={() => setOptionsOpen((open) => !open)}
            >
              {optionsOpen ? "Hide options" : "Options"}
            </Button>
          }
        />
        {optionsOpen
          ? (
            <Stack
              ref={optionsRef}
              gap={1}
              className="receipt-ui-scan-options"
            >
              <Card as="section">
                <Stack gap={4}>
                  <ModelPicker
                    options={availableModelOptions}
                    value={settings.selectedGeminiModel}
                    onValueChange={selectModel}
                    disabled={modelsLoading || models.length === 0}
                  />
                  {selectedOption?.status === "Needs test"
                    ? (
                      <GeminiConfigurationTest
                        state={testState}
                        onTest={() => void testSelectedModel()}
                      />
                    )
                    : null}
                  <Switch
                    isSelected={settings.imagePreparationEnabled}
                    onChange={(imagePreparationEnabled) =>
                      void onSettingsChange({
                        ...settings,
                        imagePreparationEnabled,
                      })}
                  >
                    Prepare image before sending (resize and compress)
                  </Switch>
                  <Button
                    variant="quiet"
                    onPress={onOpenSettings}
                  >
                    Open Gemini settings
                  </Button>
                </Stack>
              </Card>
            </Stack>
          )
          : null}
        {modelError
          ? (
            <InlineNotice tone="danger" title="Gemini is not ready">
              {modelError}
            </InlineNotice>
          )
          : null}
        {actorFailure
          ? (
            <ReceiptScanFailureNotice
              failure={actorFailure}
              canRetry={Boolean(selectedImage)}
              onRetry={scan}
              onChooseAnotherImage={() => startFilePicker(false)}
              onUseManualEntry={() => send({ type: "receipt.use-manual" })}
            />
          )
          : null}
        {scanBusy
          ? (
            <StatusPanel
              title="Scanning receipt"
              detail="This can take a moment."
              action={
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "receipt.cancel" })}
                >
                  Cancel scan
                </Button>
              }
            />
          )
          : null}
        <StickyActionBar>
          <Button
            pending={scanBusy}
            isDisabled={scanBusy || !selectedImage || offline}
            onPress={scan}
          >
            Scan with AI
          </Button>
        </StickyActionBar>
      </Stack>
      {quickSetupOpen
        ? (
          <AdaptiveDialog
            trigger={
              <Button
                className="receipt-ui-dialog-trigger"
                aria-hidden="true"
                isDisabled
                variant="quiet"
              >
                Open setup dialog
              </Button>
            }
            title="Set up Gemini"
            isOpen={quickSetupOpen}
            onOpenChange={(open) => {
              setQuickSetupOpen(open);
              if (!open) {
                const returnFocus = quickSetupReturnFocusRef.current;
                queueMicrotask(() => {
                  if (returnFocus?.isConnected) returnFocus.focus();
                });
              }
            }}
          >
            <Stack gap={1} className="receipt-ui-quick-setup">
              <GeminiQuickSetup
                showHeading={false}
                autoFocus
                value={apiKey}
                onChange={(value) => {
                  setApiKey(value);
                  setKeyError(undefined);
                }}
                onSave={() => void saveAndContinue()}
                error={keyError}
                busy={keyBusy}
              />
            </Stack>
          </AdaptiveDialog>
        )
        : null}
    </ContentContainer>
  );
}

function editorValue(line: ReceiptDraftLine): {
  type: "purchase" | "adjustment";
  description: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  unitPrice?: string;
  lineId?: string;
} {
  return line.type === "purchase"
    ? {
      type: line.type,
      description: line.description,
      categoryId: line.categoryId,
      amount: line.lineTotal,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }
    : {
      type: line.type,
      description: line.description,
      categoryId: line.categoryId,
      amount: line.amount,
      lineId: line.lineId,
    };
}

function updatedLine(
  line: ReceiptDraftLine,
  value: ReturnType<typeof editorValue>,
): ReceiptDraftLine | undefined {
  const amount = CanonicalDecimalSchema.safeParse(value.amount);
  if (!amount.success) return undefined;
  if (line.type === "purchase" && value.type === "purchase") {
    const quantity = value.quantity?.trim();
    const unitPrice = value.unitPrice?.trim();
    if (quantity && !CanonicalDecimalSchema.safeParse(quantity).success) {
      return undefined;
    }
    if (unitPrice && !CanonicalDecimalSchema.safeParse(unitPrice).success) {
      return undefined;
    }
    return {
      ...line,
      description: value.description,
      categoryId: StableIdSchema.parse(value.categoryId),
      lineTotal: amount.data,
      ...(quantity ? { quantity } : { quantity: undefined }),
      ...(unitPrice ? { unitPrice } : { unitPrice: undefined }),
    };
  }
  if (line.type === "adjustment" && value.type === "adjustment") {
    return {
      ...line,
      description: value.description,
      categoryId: StableIdSchema.parse(value.categoryId),
      amount: amount.data,
      ...(value.lineId
        ? { lineId: StableIdSchema.parse(value.lineId) }
        : { lineId: undefined }),
    };
  }
  return undefined;
}

export function LineEditorDialog({
  line,
  categories,
  linkOptions,
  onSave,
  onClose,
  triggerLabel,
  triggerVariant = "quiet",
  fullWidth,
}: {
  line: ReceiptDraftLine;
  categories: readonly Category[];
  linkOptions: Array<{ id: string; label: string }>;
  onSave: (line: ReceiptDraftLine) => void;
  onClose?: () => void;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "quiet" | "danger";
  fullWidth?: boolean;
}) {
  const [value, setValue] = useState(editorValue(line));
  const [error, setError] = useState<string>();
  return (
    <AdaptiveDialog
      trigger={
        <Button variant={triggerVariant} fullWidth={fullWidth}>
          {triggerLabel}
        </Button>
      }
      title={line.type === "purchase" ? "Edit receipt line" : "Edit adjustment"}
    >
      {(close) => (
        <Stack gap={4}>
          <ReceiptLineEditor
            value={value}
            categories={categoryOptions(categories)}
            linkOptions={linkOptions}
            onChange={(next) => {
              setValue(next);
              setError(undefined);
            }}
          />
          {error
            ? (
              <InlineNotice tone="danger" title="Check this line">
                {error}
              </InlineNotice>
            )
            : null}
          <FormActions>
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button
              isDisabled={value.description.trim().length === 0}
              onPress={() => {
                const next = updatedLine(line, value);
                if (!next) {
                  setError(
                    "Enter valid decimal values before saving this line.",
                  );
                  return;
                }
                onSave(next);
                close();
                onClose?.();
              }}
            >
              Save line
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export function ReceiptReviewScreen({
  local,
  state,
  initialReview,
  onDirtyChange,
  discardRequest,
  onClose,
}: {
  local: LocalPort;
  state: ProjectCategoryState;
  initialReview?: ReceiptReviewDraft;
  onDirtyChange?: (dirty: boolean) => void;
  discardRequest?: number;
  onClose: () => void;
}) {
  const machine = useMemo(
    () => createReceiptReviewMachine({ local, organization: local }),
    [local],
  );
  const [snapshot, send] = useActor(machine, { input: {} });
  const [openSent, setOpenSent] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataError, setMetadataError] = useState<string>();
  const doneRef = useRef(false);
  const syncMutationHandled = useRef(false);
  const metadataReturnFocusRef = useRef<HTMLElement | null>(null);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const syncStatus = useSyncStatus();

  const openMetadata = () => {
    const activeElement = document.activeElement;
    metadataReturnFocusRef.current = activeElement instanceof HTMLElement
      ? activeElement
      : null;
    setMetadataOpen(true);
  };
  const closeMetadata = () => {
    setMetadataOpen(false);
    const returnFocus = metadataReturnFocusRef.current;
    queueMicrotask(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  };

  useEffect(() => {
    if (openSent) return;
    setOpenSent(true);
    if (initialReview) {
      send({ type: "receipt.review.open", review: initialReview });
    } else send({ type: "receipt.review.hydrate" });
  }, [initialReview, openSent, send]);

  useEffect(() => {
    onDirtyChange?.(snapshot.hasTag("dirty"));
  }, [onDirtyChange, snapshot]);

  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    send({ type: "receipt.review.discard" });
  }, [discardRequest, send]);

  useEffect(() => {
    if (doneRef.current) return;
    if (
      snapshot.matches("saved") || snapshot.matches("discarded") ||
      snapshot.matches("cancelled")
    ) {
      doneRef.current = true;
      if (snapshot.matches("saved") && !syncMutationHandled.current) {
        syncMutationHandled.current = true;
        syncStatus?.notifyLocalMutation();
      }
      onClose();
    }
  }, [onClose, snapshot, syncStatus]);

  if (
    snapshot.matches("hydrating") || snapshot.matches("persisting") ||
    snapshot.matches("clearing")
  ) {
    return (
      <ContentContainer size="review">
        <PageHeader title="Review receipt" headingLevel={1} />
        <StatusPanel
          title="Saving receipt review locally"
          detail="The structured draft stays on this device."
        />
      </ContentContainer>
    );
  }
  if (snapshot.matches("closed")) {
    return (
      <ContentContainer size="review">
        <Stack gap={4}>
          <PageHeader title="Review receipt" headingLevel={1} />
          <Text>There is no receipt review to restore.</Text>
        </Stack>
      </ContentContainer>
    );
  }
  const review = snapshot.context.review;
  if (!review) {
    return (
      <ContentContainer size="review">
        <Stack gap={4}>
          <PageHeader title="Review receipt" headingLevel={1} />
          <ErrorState title="Receipt review unavailable">
            The validated receipt draft could not be opened.
          </ErrorState>
        </Stack>
      </ContentContainer>
    );
  }
  const selectedTotal = receiptSelectedTotal(review);
  const difference = receiptMismatchDifference(review);
  const selectedCount = review.lines.filter((line) => line.selected).length;
  const categories = state.categories;
  const links = review.lines.filter((line) =>
    line.type === "purchase" && line.selected
  ).map((line) => ({
    id: line.id,
    label: line.description || "Unclear purchase",
  }));
  const sendReview = (event: ReceiptReviewActorEvent) => {
    send(event);
  };
  const updateParent = (parent: ReceiptReviewDraft["parent"]) => {
    if (
      !CalendarDateSchema.safeParse(parent.date).success ||
      !CurrencyCodeSchema.safeParse(parent.currency).success ||
      !CanonicalDecimalSchema.safeParse(parent.printedTotal).success
    ) {
      setMetadataError("Enter a valid date, currency, and printed total.");
      return;
    }
    setMetadataError(undefined);
    sendReview({ type: "receipt.review.change-parent", parent });
    setMetadataOpen(false);
  };
  const newLine = {
    type: "purchase" as const,
    id: makeLineId(),
    description: "",
    categoryId: categories.find((category) => !category.archived)?.id ??
      "category-uncategorized",
    lineTotal: "0" as const,
    selected: false,
    uncertain: false,
  } satisfies ReceiptDraftLine;

  return (
    <ContentContainer size="review">
      <Stack gap={5}>
        <PageHeader
          title="Review receipt"
          headingLevel={1}
          leading={snapshot.hasTag("dirty")
            ? (
              <AdaptiveDialog
                trigger={
                  <IconButton
                    icon={<X />}
                    aria-label="Close"
                    variant="quiet"
                  />
                }
                title="Discard receipt review?"
              >
                {(close) => (
                  <Stack gap={4}>
                    <Text>Your saved review draft will be removed.</Text>
                    <Inline>
                      <Button variant="quiet" onPress={close}>
                        Keep reviewing
                      </Button>
                      <Button
                        variant="danger"
                        onPress={() => {
                          send({ type: "receipt.review.discard" });
                          close();
                        }}
                      >
                        Discard review
                      </Button>
                    </Inline>
                  </Stack>
                )}
              </AdaptiveDialog>
            )
            : (
              <IconButton
                icon={<X />}
                aria-label="Close"
                variant="quiet"
                onPress={onClose}
              />
            )}
        />
        <ReceiptMetadata
          metadata={review.parent}
          onEdit={openMetadata}
        />
        <ReceiptReconciliation
          printed={review.parent.printedTotal}
          selected={selectedTotal}
          difference={difference}
          currency={review.parent.currency}
        />
        {review.uncertainty.length
          ? (
            <InlineNotice tone="warning" title="AI review notes">
              <List label="AI review notes">
                {review.uncertainty.map((item) => (
                  <ListRow key={item}>{item}</ListRow>
                ))}
              </List>
            </InlineNotice>
          )
          : null}
        {snapshot.matches("mismatch")
          ? (
            <InlineNotice
              tone="warning"
              title="Confirm the printed-total mismatch"
            >
              The selected entries differ from the printed total. You can go
              back and edit them, or explicitly confirm this mismatch.
              <Button
                onPress={() =>
                  send({ type: "receipt.review.confirm-mismatch" })}
              >
                Confirm mismatch and save
              </Button>
            </InlineNotice>
          )
          : null}
        {snapshot.matches("failed")
          ? (
            <InlineNotice tone="danger" title="Receipt was not saved">
              {snapshot.context.error?.message ?? "Try again."}
              <Inline>
                <Button
                  variant="secondary"
                  onPress={() => send({ type: "receipt.review.retry" })}
                >
                  Retry
                </Button>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "receipt.review.discard" })}
                >
                  Discard review
                </Button>
              </Inline>
            </InlineNotice>
          )
          : null}
        <Stack gap={3}>
          {review.lines.map((line) => (
            <ReceiptLineCard
              key={line.id}
              line={lineViewModel(line, categories)}
              currency={review.parent.currency}
              onSelectedChange={(selected) =>
                sendReview({
                  type: "receipt.review.select-line",
                  lineId: line.id,
                  selected,
                })}
              editControl={
                <LineEditorDialog
                  line={line}
                  categories={categories}
                  linkOptions={links}
                  triggerLabel="Edit"
                  onSave={(next) =>
                    sendReview({
                      type: "receipt.review.edit-line",
                      line: next,
                    })}
                />
              }
              onRemove={() =>
                sendReview({
                  type: "receipt.review.remove-line",
                  lineId: line.id,
                })}
            />
          ))}
        </Stack>
        <LineEditorDialog
          line={newLine}
          categories={categories}
          linkOptions={links}
          triggerLabel="Add missing line"
          triggerVariant="secondary"
          fullWidth
          onSave={(line) =>
            sendReview({ type: "receipt.review.add-line", line })}
        />
        <StickyActionBar>
          <Button
            pending={snapshot.matches("saving")}
            isDisabled={snapshot.hasTag("saving") || selectedCount === 0}
            onPress={() =>
              send({ type: "receipt.review.submit", confirmMismatch: false })}
          >
            Save {selectedCount} selected{" "}
            {selectedCount === 1 ? "entry" : "entries"}
          </Button>
        </StickyActionBar>
      </Stack>
      {metadataOpen
        ? (
          <ReceiptMetadataEditor
            parent={review.parent}
            onSave={updateParent}
            error={metadataError}
            onClose={closeMetadata}
          />
        )
        : null}
    </ContentContainer>
  );
}

export function ReceiptMetadataEditor({
  parent,
  onSave,
  onClose,
  error,
}: {
  parent: ReceiptReviewDraft["parent"];
  onSave: (parent: ReceiptReviewDraft["parent"]) => void;
  onClose: () => void;
  error?: string;
}) {
  const [merchant, setMerchant] = useState(parent.merchant ?? "");
  const [date, setDate] = useState(parent.date);
  const [currency, setCurrency] = useState(parent.currency);
  const [printedTotal, setPrintedTotal] = useState(parent.printedTotal);
  return (
    <AdaptiveDialog
      trigger={
        <Button
          className="receipt-ui-dialog-trigger"
          aria-hidden="true"
          isDisabled
          variant="quiet"
        >
          Open metadata dialog
        </Button>
      }
      isOpen
      title="Edit receipt details"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Stack gap={4}>
        <TextField
          autoFocus
          label="Merchant"
          value={merchant}
          onChange={setMerchant}
        />
        <NativeDateField
          label="Date"
          value={date}
          onChange={(event) => setDate(event.currentTarget.value)}
        />
        <TextField label="Currency" value={currency} onChange={setCurrency} />
        <TextField
          label="Printed receipt total"
          value={printedTotal}
          onChange={setPrintedTotal}
        />
        {error
          ? (
            <InlineNotice tone="danger" title="Check receipt details">
              {error}
            </InlineNotice>
          )
          : null}
        <FormActions>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            onPress={() =>
              onSave({
                ...parent,
                merchant: merchant.trim() || undefined,
                date,
                currency,
                printedTotal,
              })}
          >
            Save details
          </Button>
        </FormActions>
      </Stack>
    </AdaptiveDialog>
  );
}

export function GeminiSettingsScreen({
  gemini,
  settings,
  onSettingsChange,
  onClose,
}: {
  gemini: ReceiptGeminiPort;
  settings: DeviceLocalSettings;
  onSettingsChange: (settings: DeviceLocalSettings) => void;
  onClose: () => void;
}) {
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<readonly ReceiptAiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [testState, setTestState] = useState<
    "idle" | "testing" | "passed" | "failed"
  >("idle");

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const key = await gemini.getApiKey();
      setHasKey(key !== undefined);
      setMaskedKey(key ? `••••••••${key.reveal().slice(-4)}` : "");
      if (key) setModels(await gemini.listModels(DEFAULT_MODEL_QUERY));
      else setModels([]);
    } catch (failure) {
      setError(
        messageForError(failure, "Gemini settings could not be loaded."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [gemini]);

  const saveKey = async () => {
    if (!apiKey.trim()) {
      setError("Enter an API key.");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      await gemini.setApiKey(apiKey.trim());
      onSettingsChange({
        ...settings,
        geminiKeyRevision: newGeminiKeyRevision(),
        geminiCompatibilityEvidence: [],
      });
      setApiKey("");
      await refresh();
    } catch (failure) {
      setError(messageForError(failure, "The API key could not be saved."));
    } finally {
      setLoading(false);
    }
  };

  const removeKey = async () => {
    await gemini.removeApiKey();
    setHasKey(false);
    setMaskedKey("");
    setModels([]);
    setTestState("idle");
    onSettingsChange({
      ...settings,
      selectedGeminiModel: undefined,
      geminiKeyRevision: undefined,
      geminiCompatibilityEvidence: undefined,
    });
  };

  const options = modelOptions(models, settings);
  const test = async () => {
    const selectedModelId = settings.selectedGeminiModel;
    if (!selectedModelId) return;
    const selectedModel = models.find((model) => model.id === selectedModelId);
    if (!selectedModel) return;
    setTestState("testing");
    setError(undefined);
    try {
      const result = await gemini.testConfiguration(
        selectedModelId,
        DEFAULT_MODEL_QUERY,
      );
      const nextSettings = recordCompatibilityEvidence(
        settings,
        selectedModel,
        result.status === "compatible" ? "compatible" : "incompatible",
      );
      onSettingsChange(nextSettings);
      if (result.status === "compatible") {
        setTestState("passed");
      } else {
        setTestState("failed");
        setError(
          "This model is incompatible with receipt scanning.",
        );
      }
    } catch (failure) {
      setTestState("failed");
      setError(messageForError(failure, "The configuration test failed."));
    }
  };

  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader
          title="Gemini receipt scanning"
          headingLevel={1}
          leading={
            <IconButton
              icon={<ArrowLeft />}
              aria-label="Back"
              variant="quiet"
              onPress={onClose}
            />
          }
        />
        {hasKey
          ? (
            <Card as="section">
              <Stack gap={3}>
                <Inline justify="space-between">
                  <Stack gap={1}>
                    <Heading size="sm">API key</Heading>
                    <Text tone="secondary">{maskedKey}</Text>
                  </Stack>
                  <Button variant="danger" onPress={() => void removeKey()}>
                    Remove
                  </Button>
                </Inline>
                <Text tone="secondary">
                  Stored only on this device. It is not a browser secret.
                </Text>
              </Stack>
            </Card>
          )
          : (
            <GeminiQuickSetup
              value={apiKey}
              onChange={setApiKey}
              onSave={() => void saveKey()}
              error={error}
              busy={loading}
            />
          )}
        {hasKey
          ? (
            <>
              <ModelPicker
                options={options}
                value={settings.selectedGeminiModel}
                onValueChange={(selectedGeminiModel) =>
                  void onSettingsChange({ ...settings, selectedGeminiModel })}
                disabled={loading || models.length === 0}
              />
              <Button
                variant="secondary"
                pending={loading}
                isDisabled={loading}
                onPress={() => void refresh()}
              >
                Refresh available models
              </Button>
              <Switch
                isSelected={settings.imagePreparationEnabled}
                onChange={(imagePreparationEnabled) =>
                  void onSettingsChange({
                    ...settings,
                    imagePreparationEnabled,
                  })}
              >
                Image preparation · resize and compress before sending
              </Switch>
              <Text tone="secondary">
                Changing this setting affects future scans. Mandatory metadata
                removal remains on.
              </Text>
              <GeminiConfigurationTest
                state={testState}
                onTest={() => void test()}
              />
            </>
          )
          : null}
        {error && hasKey
          ? (
            <InlineNotice tone="danger" title="Gemini settings need attention">
              {error}
            </InlineNotice>
          )
          : null}
      </Stack>
    </ContentContainer>
  );
}

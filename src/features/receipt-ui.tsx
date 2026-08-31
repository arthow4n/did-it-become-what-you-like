import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGeminiAdapter,
  createGoogleGenAiClient,
  createImagePreparationPort,
  REQUIRED_RECEIPT_AI_CAPABILITIES,
} from "../adapters/gemini/index.ts";
import {
  createOpenRouterAdapter,
  type OpenRouterEndpoint,
  type OpenRouterRoutingOptions,
} from "../adapters/openrouter/index.ts";
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
  DEFAULT_DEVICE_LOCAL_SETTINGS,
  type DeviceLocalSettings,
  parseDeviceLocalSettings,
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
  Checkbox,
  ContentContainer,
  ErrorState,
  FileField,
  FormActions,
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
  ReceiptQuickSetup,
  ReceiptReconciliation,
  ReceiptSourcePicker,
  SelectField,
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

type ReceiptProviderPort = ReceiptAiPort & {
  getApiKey(options?: { signal?: AbortSignal }): Promise<
    {
      reveal(): string;
    } | undefined
  >;
  setApiKey(value: string, options?: { signal?: AbortSignal }): Promise<void>;
  removeApiKey(options?: { signal?: AbortSignal }): Promise<void>;
};

export type ReceiptOpenRouterPort = ReceiptProviderPort & {
  listEndpoints(
    modelId: string,
    options?: { signal?: AbortSignal },
  ): Promise<readonly OpenRouterEndpoint[]>;
};

export type ReceiptProvider = "gemini" | "openrouter";

export const RECEIPT_PROVIDER_NAMES: Record<ReceiptProvider, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export type ReceiptUiDependencies = ReceiptScanMachineDependencies & {
  readonly ai: ReceiptAiPort;
  readonly gemini: ReceiptProviderPort;
  readonly openrouter: ReceiptOpenRouterPort;
};

type ReceiptImageEntry = {
  readonly file: File;
  readonly previewUrl: string;
  bytes?: Uint8Array;
};

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
  try {
    return parseDeviceLocalSettings(readJsonRecord(value));
  } catch {
    return DEFAULT_DEVICE_LOCAL_SETTINGS;
  }
}

export async function writeDeviceLocalSettings(
  local: LocalPort,
  settings: DeviceLocalSettings,
): Promise<void> {
  const safe = parseDeviceLocalSettings(settings);
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
  getRoutingOptions: () => OpenRouterRoutingOptions = () => ({}),
): { dependencies: ReceiptUiDependencies; secretStorage: SecretStoragePort } {
  const secretStorage = createLocalStorageSecretStorage();
  const gemini = createGeminiAdapter({
    secretStorage,
    createClient: createGoogleGenAiClient,
  });
  const openrouter = createOpenRouterAdapter({
    secretStorage,
    getRoutingOptions,
  });
  const imagePreparation = createImagePreparationPort();
  const resolveImage: ReceiptImageResolver = (image) =>
    imageStore.resolve(image);
  return {
    secretStorage,
    dependencies: {
      ai: gemini,
      gemini,
      openrouter,
      imagePreparation,
      resolveImage,
      releaseImage: (image) => imageStore.releaseForRetry(image),
    },
  };
}

function providerPort(
  dependencies: ReceiptUiDependencies,
  provider: ReceiptProvider,
): ReceiptProviderPort {
  return provider === "gemini" ? dependencies.gemini : dependencies.openrouter;
}

function selectedModelFor(
  settings: DeviceLocalSettings,
  provider: ReceiptProvider,
): string | undefined {
  return provider === "gemini"
    ? settings.selectedGeminiModel
    : settings.selectedOpenRouterModel;
}

function settingsWithSelectedModel(
  settings: DeviceLocalSettings,
  provider: ReceiptProvider,
  model: string | undefined,
): DeviceLocalSettings {
  return provider === "gemini"
    ? { ...settings, selectedGeminiModel: model }
    : { ...settings, selectedOpenRouterModel: model };
}

export function modelOptions(
  models: readonly ReceiptAiModel[],
): Array<{
  id: string;
  label: string;
  disabled?: boolean;
  reason?: string;
}> {
  return models.map((model) => {
    return {
      id: model.id,
      label: model.displayName,
      disabled: model.lifecycle !== "active",
      ...(model.lifecycle !== "active"
        ? {
          reason: model.lifecycle,
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

export function ReceiptDisclosure({
  providerName = "your selected receipt-AI provider",
  onAccept,
  onDecline,
}: {
  providerName?: string;
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
            code may be sent to {providerName} for extraction.
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

function useDirtyBeforeUnload(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export function ReceiptScanScreen({
  dependencies,
  imageStore,
  state,
  settings,
  offline,
  onSettingsChange,
  onDirtyChange,
  onDiscardDisabledChange,
  discardRequest,
  onDirtyDiscarded,
  onReview,
  onClose,
  onOpenSettings,
}: {
  dependencies: ReceiptUiDependencies;
  imageStore: ReceiptImageStore;
  state: ProjectCategoryState;
  settings: DeviceLocalSettings;
  offline: boolean;
  onSettingsChange: (settings: DeviceLocalSettings) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onDiscardDisabledChange?: (disabled: boolean) => void;
  discardRequest?: number;
  onDirtyDiscarded?: () => void;
  onReview: (review: ReceiptReviewDraft) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const activeProvider = settings.activeProvider as ReceiptProvider;
  const activeProviderName = RECEIPT_PROVIDER_NAMES[activeProvider];
  const activeProviderPort = providerPort(dependencies, activeProvider);
  const scanDependencies = useMemo(
    () => ({ ...dependencies, ai: activeProviderPort }),
    [activeProviderPort, dependencies],
  );
  const machine = useMemo(
    () => createReceiptScanMachine(scanDependencies),
    [scanDependencies],
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
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const openSent = useRef(false);
  const reviewSent = useRef(false);
  const selectedImageRef = useRef(selectedImage);
  const pendingScanRef = useRef(false);
  const quickSetupReturnFocusRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const previousProviderRef = useRef(activeProvider);
  const modelRefreshGeneration = useRef(0);
  const activeProviderRef = useRef(activeProvider);
  activeProviderRef.current = activeProvider;

  const isCurrentModelRefresh = (request: {
    readonly generation: number;
    readonly provider: ReceiptProvider;
    readonly port: ReceiptProviderPort;
  }): boolean =>
    request.generation === modelRefreshGeneration.current &&
    request.provider === activeProviderRef.current &&
    request.port === providerPort(dependencies, activeProviderRef.current);

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
    if (previousProviderRef.current === activeProvider) return;
    previousProviderRef.current = activeProvider;
    modelRefreshGeneration.current += 1;
    openSent.current = true;
    send({
      type: "receipt.open",
      disclosureRequired: !disclosureAccepted,
    });
  }, [activeProvider, disclosureAccepted, send]);

  useEffect(() => {
    if (
      offline && snapshot.status === "active" &&
      !snapshot.matches("offline")
    ) {
      send({ type: "receipt.network.offline" });
      clearSelectedImage();
      setPendingScanState(false);
      setQuickSetupOpen(false);
      setOptionsOpen(false);
      setCaptureMode(false);
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
    void activeProviderPort.getApiKey().then((key) => {
      if (active) setHasKey(key !== undefined);
    }).catch(() => {
      if (active) {
        setKeyError(
          `${activeProviderName} key storage is unavailable on this device.`,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [activeProviderName, activeProviderPort]);

  const refreshModels = async (request: {
    readonly generation: number;
    readonly provider: ReceiptProvider;
    readonly port: ReceiptProviderPort;
  } = {
    generation: modelRefreshGeneration.current + 1,
    provider: activeProvider,
    port: activeProviderPort,
  }): Promise<readonly ReceiptAiModel[]> => {
    if (request.generation > modelRefreshGeneration.current) {
      modelRefreshGeneration.current = request.generation;
    }
    setModelsLoading(true);
    setModelError(undefined);
    try {
      const next = await request.port.listModels(DEFAULT_MODEL_QUERY);
      if (!isCurrentModelRefresh(request)) return [];
      setModels(next);
      return next;
    } catch (error) {
      if (!isCurrentModelRefresh(request)) return [];
      setModelError(
        messageForError(
          error,
          `Available ${
            RECEIPT_PROVIDER_NAMES[request.provider]
          } models could not be loaded.`,
        ),
      );
      return [];
    } finally {
      if (isCurrentModelRefresh(request)) setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasKey || offline || models.length > 0) return;
    void refreshModels();
  }, [activeProviderPort, hasKey, offline, models.length]);

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
    const request = {
      generation: modelRefreshGeneration.current + 1,
      provider: activeProvider,
      port: activeProviderPort,
    } as const;
    modelRefreshGeneration.current = request.generation;
    try {
      await request.port.setApiKey(apiKey.trim());
      if (!isCurrentModelRefresh(request)) return;
      const nextModels = await refreshModels(request);
      if (!isCurrentModelRefresh(request)) return;
      if (nextModels.length === 0) {
        throw new Error(
          `The key did not return any ${activeProviderName} models.`,
        );
      }
      const nextModelOptions = modelOptions(nextModels);
      const configuredModel = selectedModelFor(settings, activeProvider);
      const nextSelectedModel = configuredModel &&
          nextModelOptions.find((option) =>
            option.id === configuredModel &&
            option.disabled !== true
          )
        ? configuredModel
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
          `Select a ${activeProviderName} model to continue this scan.`,
        );
      }
    } catch (error) {
      if (isCurrentModelRefresh(request)) {
        setKeyError(
          messageForError(error, "The API key could not be validated."),
        );
      }
    } finally {
      if (isCurrentModelRefresh(request)) setKeyBusy(false);
    }
  };

  const availableModelOptions = modelOptions(models);
  const configuredModel = selectedModelFor(settings, activeProvider);
  const selectedOption = configuredModel
    ? availableModelOptions.find((option) => option.id === configuredModel)
    : undefined;
  const selectedModel = selectedOption && selectedOption.disabled !== true
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
    const nextSettings = settingsWithSelectedModel(
      settings,
      activeProvider,
      modelId,
    );
    void onSettingsChange(nextSettings);
    if (pendingScanRef.current && option?.disabled !== true) {
      const pendingInput = makeScanInput(modelId);
      if (!pendingInput) return;
      setPendingScanState(false);
      setOptionsOpen(false);
      setModelError(undefined);
      send({ type: "receipt.scan", input: pendingInput });
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
    if (!configuredModel) {
      setPendingScanState(true);
      setOptionsOpen(true);
      setModelError(`Select a ${activeProviderName} model before scanning.`);
      return;
    }
    if (!selectedOption || selectedOption.disabled === true) {
      setPendingScanState(true);
      setOptionsOpen(true);
      setModelError(
        `Refresh ${activeProviderName} models and select an available model.`,
      );
      return;
    }
    if (!scanInput) {
      setModelError(`The selected ${activeProviderName} model is unavailable.`);
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
  const changeProvider = (nextProvider: string) => {
    if (nextProvider !== "gemini" && nextProvider !== "openrouter") return;
    if (nextProvider === activeProvider || scanBusy) return;
    activeProviderRef.current = nextProvider;
    modelRefreshGeneration.current += 1;
    void onSettingsChange({
      ...settings,
      activeProvider: nextProvider,
    });
    setModels([]);
    setHasKey(false);
    setKeyBusy(false);
    setModelsLoading(false);
    setModelError(undefined);
    setOptionsOpen(true);
  };
  const dirty = selectedImage !== null || scanBusy || quickSetupOpen ||
    pendingScan;
  useDirtyBeforeUnload(dirty);

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
    onDirtyChange?.(dirty);
  }, [
    dirty,
    onDirtyChange,
  ]);
  useEffect(() => {
    onDiscardDisabledChange?.(false);
  }, [onDiscardDisabledChange]);
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
          providerName={activeProviderName}
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
          Connect to the internet to send a receipt to{" "}
          {activeProviderName}. The selected image is not queued for later.
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
            <InlineNotice
              tone="info"
              title={`Receipt is sent to ${activeProviderName}.`}
            >
              Embedded metadata is always removed before sending. The image
              remains in memory only while this scan is open so you can retry or
              replace it; it is removed when you leave, discard, or complete the
              scan.
            </InlineNotice>
          )
          : null}
        <StatusPanel
          title={selectedOption
            ? `${activeProviderName}: ${selectedOption.id}`
            : `${activeProviderName} model not selected`}
          detail={pendingScan
            ? "Select a model to continue this scan"
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
                  <SelectField
                    label="Receipt AI provider"
                    options={[
                      { id: "gemini", label: "Gemini" },
                      { id: "openrouter", label: "OpenRouter" },
                    ]}
                    value={activeProvider}
                    onValueChange={changeProvider}
                    isDisabled={scanBusy}
                  />
                  <Text tone="secondary">
                    Receipt scanning requires image input and structured output
                    constrained by JSON Schema. A listed model is a candidate,
                    not a user-run test.
                  </Text>
                  <ModelPicker
                    options={availableModelOptions}
                    value={configuredModel}
                    onValueChange={selectModel}
                    disabled={modelsLoading || models.length === 0}
                  />
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
                    Open receipt scanning settings
                  </Button>
                </Stack>
              </Card>
            </Stack>
          )
          : null}
        {modelError
          ? (
            <InlineNotice
              tone="danger"
              title={`${activeProviderName} is not ready`}
            >
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
            title={`Set up ${activeProviderName}`}
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
              <ReceiptQuickSetup
                providerName={activeProviderName}
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
  onDiscardDisabledChange,
  discardRequest,
  onClose,
}: {
  local: LocalPort;
  state: ProjectCategoryState;
  initialReview?: ReceiptReviewDraft;
  onDirtyChange?: (dirty: boolean) => void;
  onDiscardDisabledChange?: (disabled: boolean) => void;
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

  const dirty = snapshot.hasTag("dirty");
  useDirtyBeforeUnload(dirty);

  useEffect(() => {
    onDirtyChange?.(dirty);
    onDiscardDisabledChange?.(snapshot.hasTag("saving"));
  }, [onDiscardDisabledChange, onDirtyChange, snapshot]);

  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    if (snapshot.hasTag("saving")) return;
    send({ type: "receipt.review.discard" });
  }, [discardRequest, send, snapshot]);

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
    snapshot.matches("saving") || snapshot.matches("clearing")
  ) {
    return (
      <ContentContainer size="review">
        <PageHeader title="Review receipt" headingLevel={1} />
        <StatusPanel
          title={snapshot.matches("saving")
            ? "Saving receipt"
            : "Saving receipt review locally"}
          detail={snapshot.matches("saving")
            ? "The receipt is being committed to this device."
            : "The structured draft stays on this device."}
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
  if (snapshot.matches("failed") && snapshot.context.review === null) {
    return (
      <ContentContainer size="review">
        <Stack gap={4}>
          <PageHeader title="Review receipt" headingLevel={1} />
          <ErrorState
            title="Receipt review needs recovery"
            action={
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
            }
          >
            {snapshot.context.error?.message ??
              "The receipt review could not be recovered."}
          </ErrorState>
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
            isDisabled={snapshot.hasTag("saving") ||
              snapshot.matches("failed") || selectedCount === 0}
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

function endpointOptions(
  endpoints: readonly OpenRouterEndpoint[],
): Array<{ id: string; label: string }> {
  return endpoints.filter(endpointSupportsReceiptSchema).map((endpoint) => ({
    id: endpoint.tag,
    label: endpoint.providerName,
  }));
}

function endpointSupportsReceiptSchema(endpoint: OpenRouterEndpoint): boolean {
  return ["structured_outputs", "response_format"].every((parameter) =>
    endpoint.supportedParameters.includes(parameter)
  );
}

type ReceiptSettingsRefreshRequest = {
  readonly generation: number;
  readonly provider: ReceiptProvider;
  readonly port: ReceiptProviderPort;
};

export function ReceiptSettingsScreen({
  gemini,
  openrouter,
  settings,
  onSettingsChange,
  onClose,
}: {
  gemini: ReceiptProviderPort;
  openrouter: ReceiptOpenRouterPort;
  settings: DeviceLocalSettings;
  onSettingsChange: (settings: DeviceLocalSettings) => void;
  onClose: () => void;
}) {
  const activeProvider = settings.activeProvider as ReceiptProvider;
  const activeProviderName = RECEIPT_PROVIDER_NAMES[activeProvider];
  const activeProviderPort = activeProvider === "gemini" ? gemini : openrouter;
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<readonly ReceiptAiModel[]>([]);
  const [endpoints, setEndpoints] = useState<readonly OpenRouterEndpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [endpointLoading, setEndpointLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const refreshGeneration = useRef(0);
  const activeProviderRef = useRef(activeProvider);
  activeProviderRef.current = activeProvider;

  const beginRefresh = (
    provider = activeProvider,
    port = activeProviderPort,
  ): ReceiptSettingsRefreshRequest => {
    const request = {
      generation: refreshGeneration.current + 1,
      provider,
      port,
    } as const;
    refreshGeneration.current = request.generation;
    return request;
  };

  const isCurrentRefresh = (
    request: ReceiptSettingsRefreshRequest,
  ): boolean =>
    request.generation === refreshGeneration.current &&
    request.provider === activeProviderRef.current &&
    request.port ===
      (activeProviderRef.current === "gemini" ? gemini : openrouter);

  useEffect(() => () => {
    refreshGeneration.current += 1;
  }, []);

  const selectedModel = selectedModelFor(settings, activeProvider);

  const refreshEndpoints = async (
    providerSettings: DeviceLocalSettings = settings,
    request: ReceiptSettingsRefreshRequest = beginRefresh(),
  ): Promise<readonly OpenRouterEndpoint[]> => {
    if (
      !isCurrentRefresh(request) || request.provider !== "openrouter" ||
      !providerSettings.selectedOpenRouterModel
    ) {
      if (isCurrentRefresh(request)) setEndpoints([]);
      return [];
    }
    setEndpointLoading(true);
    try {
      const next = await openrouter.listEndpoints(
        providerSettings.selectedOpenRouterModel,
      );
      const qualified = next.filter(endpointSupportsReceiptSchema);
      if (!isCurrentRefresh(request)) return [];
      setEndpoints(qualified);
      const preferredTag = providerSettings.preferredProviderTag;
      if (
        preferredTag &&
        !qualified.some((endpoint) => endpoint.tag === preferredTag)
      ) {
        onSettingsChange({
          ...providerSettings,
          preferredProviderTag: undefined,
        });
        setNotice(
          "The previous preferred provider is unavailable with the current model or privacy filters. Preference reset to Automatic.",
        );
      }
      return qualified;
    } catch (failure) {
      if (isCurrentRefresh(request)) {
        setError(
          messageForError(
            failure,
            "OpenRouter provider options could not be loaded.",
          ),
        );
      }
      return [];
    } finally {
      if (isCurrentRefresh(request)) setEndpointLoading(false);
    }
  };

  const refresh = async (
    providerSettings: DeviceLocalSettings = settings,
    request: ReceiptSettingsRefreshRequest = beginRefresh(),
  ): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const key = await request.port.getApiKey();
      if (!isCurrentRefresh(request)) return;
      setHasKey(key !== undefined);
      setMaskedKey(key ? `••••••••${key.reveal().slice(-4)}` : "");
      if (!key) {
        setModels([]);
        setEndpoints([]);
        return;
      }
      const nextModels = await request.port.listModels(
        DEFAULT_MODEL_QUERY,
      );
      if (!isCurrentRefresh(request)) return;
      setModels(nextModels);
      const configuredModel = selectedModelFor(
        providerSettings,
        request.provider,
      );
      const configuredModelIsAvailable = configuredModel === undefined ||
        nextModels.some((model) =>
          model.id === configuredModel && model.lifecycle === "active"
        );
      let effectiveSettings = providerSettings;
      if (configuredModel && !configuredModelIsAvailable) {
        effectiveSettings = settingsWithSelectedModel(
          providerSettings,
          request.provider,
          undefined,
        );
        if (request.provider === "openrouter") {
          effectiveSettings = {
            ...effectiveSettings,
            preferredProviderTag: undefined,
          };
        }
        if (!isCurrentRefresh(request)) return;
        onSettingsChange(effectiveSettings);
        setNotice(
          request.provider === "openrouter"
            ? `The saved ${
              RECEIPT_PROVIDER_NAMES[request.provider]
            } model is no longer available. Choose another model; the preferred provider was reset to Automatic.`
            : `The saved ${
              RECEIPT_PROVIDER_NAMES[request.provider]
            } model is no longer available. Choose another model.`,
        );
      }
      if (
        request.provider === "openrouter" &&
        effectiveSettings.selectedOpenRouterModel
      ) {
        await refreshEndpoints(effectiveSettings, request);
      } else {
        if (isCurrentRefresh(request)) setEndpoints([]);
      }
    } catch (failure) {
      if (isCurrentRefresh(request)) {
        setError(
          messageForError(
            failure,
            `Available ${
              RECEIPT_PROVIDER_NAMES[request.provider]
            } models could not be loaded.`,
          ),
        );
        setModels([]);
        setEndpoints([]);
      }
    } finally {
      if (isCurrentRefresh(request)) setLoading(false);
    }
  };

  useEffect(() => {
    setApiKey("");
    setModels([]);
    setEndpoints([]);
    setError(undefined);
    setNotice(undefined);
    void refresh();
  }, [activeProviderPort]);

  const saveKey = async () => {
    if (!apiKey.trim()) {
      setError("Enter an API key.");
      return;
    }
    setLoading(true);
    setError(undefined);
    const request = beginRefresh();
    try {
      await request.port.setApiKey(apiKey.trim());
      if (!isCurrentRefresh(request)) return;
      onSettingsChange(settings);
      setApiKey("");
      await refresh(settings, request);
    } catch (failure) {
      if (isCurrentRefresh(request)) {
        setError(messageForError(failure, "The API key could not be saved."));
      }
    } finally {
      if (isCurrentRefresh(request)) setLoading(false);
    }
  };

  const removeKey = async () => {
    setLoading(true);
    setError(undefined);
    const request = beginRefresh();
    try {
      await request.port.removeApiKey();
      if (!isCurrentRefresh(request)) return;
      setHasKey(false);
      setMaskedKey("");
      setModels([]);
      setEndpoints([]);
    } catch (failure) {
      if (isCurrentRefresh(request)) {
        setError(messageForError(failure, "The API key could not be removed."));
      }
    } finally {
      if (isCurrentRefresh(request)) setLoading(false);
    }
  };

  const changeProvider = (nextProvider: string) => {
    if (nextProvider !== "gemini" && nextProvider !== "openrouter") return;
    if (nextProvider === activeProvider) return;
    activeProviderRef.current = nextProvider;
    refreshGeneration.current += 1;
    onSettingsChange({ ...settings, activeProvider: nextProvider });
  };

  const changeModel = (modelId: string) => {
    const nextSettings = settingsWithSelectedModel(
      settings,
      activeProvider,
      modelId,
    );
    const request = beginRefresh();
    onSettingsChange(nextSettings);
    setNotice(undefined);
    setEndpoints([]);
    if (activeProvider === "openrouter") {
      void refreshEndpoints(nextSettings, request);
    }
  };

  const changePrivacySetting = (
    change: Partial<
      Pick<
        DeviceLocalSettings,
        "requireZdr" | "denyProviderDataCollection"
      >
    >,
  ) => {
    const nextSettings = { ...settings, ...change };
    const request = beginRefresh();
    onSettingsChange(nextSettings);
    setNotice(undefined);
    if (activeProvider === "openrouter") void refresh(nextSettings, request);
  };

  const changePreferredProvider = (value: string) => {
    if (activeProvider !== "openrouter") return;
    const nextSettings = {
      ...settings,
      preferredProviderTag: value === "automatic" ? undefined : value,
    };
    beginRefresh();
    onSettingsChange(nextSettings);
  };

  const changeImagePreparation = (imagePreparationEnabled: boolean) => {
    refreshGeneration.current += 1;
    void onSettingsChange({ ...settings, imagePreparationEnabled });
  };

  const providerOptions = activeProvider === "openrouter"
    ? [
      { id: "automatic", label: "Automatic" },
      ...endpointOptions(endpoints),
    ]
    : [];
  const preferredValue = settings.preferredProviderTag &&
      endpoints.some((endpoint) =>
        endpoint.tag === settings.preferredProviderTag
      )
    ? settings.preferredProviderTag
    : "automatic";

  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader
          title={activeProvider === "gemini"
            ? "Gemini receipt scanning"
            : "OpenRouter receipt scanning"}
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
        <SelectField
          label="Receipt AI provider"
          options={[
            { id: "gemini", label: "Gemini" },
            { id: "openrouter", label: "OpenRouter" },
          ]}
          value={activeProvider}
          onValueChange={changeProvider}
        />
        <Text tone="secondary">
          Receipt scanning requires a model that accepts image input and
          supports structured output constrained by JSON Schema. Model lists
          provide metadata-qualified candidates, not a user-run test; an
          unsupported model reports an actionable error only when you explicitly
          scan.
        </Text>
        {hasKey
          ? (
            <Card as="section">
              <Stack gap={3}>
                <Inline justify="space-between">
                  <Stack gap={1}>
                    <Heading size="sm">API key</Heading>
                    <Text tone="secondary">{maskedKey}</Text>
                  </Stack>
                  <Button
                    variant="danger"
                    isDisabled={loading}
                    onPress={() => void removeKey()}
                  >
                    Remove
                  </Button>
                </Inline>
                <Text tone="secondary">
                  Stored only on this device. It is not a browser secret and can
                  be read by code running on this origin.
                </Text>
              </Stack>
            </Card>
          )
          : (
            <ReceiptQuickSetup
              providerName={activeProviderName}
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
                options={modelOptions(models)}
                value={selectedModel}
                onValueChange={changeModel}
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
            </>
          )
          : null}
        <Switch
          isSelected={settings.imagePreparationEnabled}
          onChange={changeImagePreparation}
        >
          Prepare image before sending (resize and compress)
        </Switch>
        <Text tone="secondary">
          Metadata removal remains on for every scan. This preference is stored
          on this device and affects future scans.
        </Text>
        {activeProvider === "openrouter"
          ? (
            <Card as="section">
              <Stack gap={4}>
                <Heading size="sm">OpenRouter routing and privacy</Heading>
                <SelectField
                  label="Preferred provider"
                  options={providerOptions}
                  value={preferredValue}
                  onValueChange={changePreferredProvider}
                  isDisabled={endpointLoading || loading}
                  description="Automatic keeps OpenRouter's normal routing. A selected provider is preferred for this exact model; same-model fallback remains enabled."
                />
                <Button
                  variant="secondary"
                  pending={endpointLoading}
                  isDisabled={endpointLoading || loading || !hasKey ||
                    !selectedModel}
                  onPress={() => void refreshEndpoints()}
                >
                  Refresh provider options
                </Button>
                <Checkbox
                  isSelected={settings.requireZdr}
                  onChange={(requireZdr) =>
                    changePrivacySetting({ requireZdr })}
                >
                  Require Zero Data Retention (ZDR)
                </Checkbox>
                <Checkbox
                  isSelected={settings.denyProviderDataCollection}
                  onChange={(denyProviderDataCollection) =>
                    changePrivacySetting({ denyProviderDataCollection })}
                >
                  Deny provider data collection
                </Checkbox>
                <Text tone="secondary">
                  ZDR and data-collection controls are separate. Either filter
                  can reduce route availability and may make this model or a
                  preferred provider unavailable.
                </Text>
              </Stack>
            </Card>
          )
          : null}
        {notice
          ? (
            <InlineNotice tone="warning" title="Receipt settings updated">
              {notice}
            </InlineNotice>
          )
          : null}
        {error && hasKey
          ? (
            <InlineNotice
              tone="danger"
              title={`${activeProviderName} settings need attention`}
            >
              {error}
            </InlineNotice>
          )
          : null}
      </Stack>
    </ContentContainer>
  );
}

import { useActor } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReceiptAiModel } from "../../adapters/ports/index.ts";
import {
  type DeviceLocalSettings,
  type GeminiThinkingLevel,
} from "../../domain/index.ts";
import type { ReceiptReviewDraft } from "../../domain/receipt.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import { createReceiptScanMachine } from "../../actors/receipt.ts";
import type {
  ContractFailure,
  ReceiptImageRef,
} from "../../actors/contracts/index.ts";
import { FileText, RotateCcw, RotateCw, Trash2, X } from "lucide-react";
import {
  AdaptiveDialog,
  Button,
  Card,
  ContentContainer,
  FileField,
  Heading,
  IconButton,
  Inline,
  InlineNotice,
  ModelPicker,
  PageHeader,
  ReceiptQuickSetup,
  ReceiptSourcePicker,
  SegmentedControl,
  SelectField,
  Stack,
  StatusPanel,
  StickyActionBar,
  Switch,
  Text,
} from "../../design-system/index.ts";
import { fileMediaType } from "./image.ts";
import { ReceiptImageStore } from "./store.ts";
import {
  DEFAULT_MODEL_QUERY,
  localCalendarDate,
  messageForError,
  modelOptions,
  preferredDefaultModel,
  providerPort,
  RECEIPT_PROVIDER_NAMES,
  receiptDisclosureDetails,
  receiptDisclosureName,
  type ReceiptProvider,
  type ReceiptProviderPort,
  type ReceiptReviewMode,
  type ReceiptUiDependencies,
  selectedModelFor,
  settingsWithSelectedModel,
} from "./types.ts";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReceiptDisclosure({
  provider,
  onAccept,
  onDecline,
}: {
  provider: ReceiptProvider;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const providerName = receiptDisclosureName(provider);
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
          <Text>{receiptDisclosureDetails(provider)}</Text>
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
      {failure.reason
        ? (
          <Text size="caption" tone="secondary">
            Details: {failure.reason}
          </Text>
        )
        : null}
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

const modelCache = new WeakMap<
  ReceiptProviderPort,
  readonly ReceiptAiModel[]
>();

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
  onReview: (review: ReceiptReviewDraft, mode?: ReceiptReviewMode) => void;
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
  const scanBusy = snapshot.matches("preparing") ||
    snapshot.matches("requesting") ||
    snapshot.matches("validating");
  const [scanMode, setScanMode] = useState<"receipt" | "menu">("receipt");
  const [selectedImages, setSelectedImages] = useState<
    ReadonlyArray<
      ReceiptImageRef & {
        readonly previewUrl: string;
        readonly rotation: number;
      }
    >
  >([]);
  const [disclosureAccepted, setDisclosureAccepted] = useState(
    Boolean(settings.disclosureAccepted),
  );
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState<string>();
  const [keyBusy, setKeyBusy] = useState(false);
  const [models, setModels] = useState<readonly ReceiptAiModel[]>(() =>
    modelCache.get(activeProviderPort) ?? []
  );
  const [modelError, setModelError] = useState<string>();
  const [modelsLoading, setModelsLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState(false);
  const [pendingScan, setPendingScan] = useState(false);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const openSent = useRef(false);
  const reviewSent = useRef(false);
  const selectedImagesRef = useRef(selectedImages);
  selectedImagesRef.current = selectedImages;
  const selectedImage = selectedImages[0] ?? null;
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

  const clearSelectedImages = useCallback(() => {
    if (selectedImagesRef.current.length > 0) {
      for (const image of selectedImagesRef.current) {
        imageStore.remove(image);
      }
      selectedImagesRef.current = [];
      setSelectedImages([]);
    }
    if (sourceInputRef.current) sourceInputRef.current.value = "";
  }, [imageStore]);
  const clearSelectedImage = clearSelectedImages;

  const removeImage = (ref: ReceiptImageRef) => {
    imageStore.remove(ref);
    const nextImages = selectedImagesRef.current.filter(
      (candidate) => candidate.ephemeralId !== ref.ephemeralId,
    );
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
    if (nextImages.length === 0) {
      if (scanBusy || snapshot.matches("failed")) {
        send({ type: "receipt.replace-image" });
      }
      setPendingScanState(false);
      setModelError(undefined);
    }
  };

  const rotateImage = (image: ReceiptImageRef, degrees: 90 | -90) => {
    if (scanBusy) return;
    try {
      const rotated = imageStore.rotate(image, degrees);
      const nextImages = selectedImagesRef.current.map((item) =>
        item.ephemeralId === image.ephemeralId ? rotated : item
      );
      selectedImagesRef.current = nextImages;
      setSelectedImages(nextImages);
      if (snapshot.matches("failed")) {
        send({ type: "receipt.replace-image" });
      }
    } catch {
      setModelError("Failed to rotate the image.");
    }
  };

  useEffect(() => {
    if (
      "cache" in dependencies.imagePreparation &&
      dependencies.imagePreparation.cache instanceof WeakMap
    ) {
      imageStore.setPreparationCache(
        dependencies.imagePreparation.cache as WeakMap<object, unknown>,
      );
    }
  }, [dependencies.imagePreparation, imageStore]);

  useEffect(() => () => {
    // Stop the invoked scan before its in-memory image reference is removed.
    // This also covers route changes and component teardown that bypass the
    // visible close button.
    send({ type: "receipt.cancel" });
    for (const image of selectedImagesRef.current) {
      imageStore.remove(image);
    }
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
      modelCache.set(request.port, next);
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

  const configuredModel = selectedModelFor(settings, activeProvider);

  useEffect(() => {
    // Avoid fetching the model list if not in options editing mode and a model is already configured
    if (!optionsOpen && Boolean(configuredModel)) return;
    if (!hasKey || offline || models.length > 0) return;
    void refreshModels();
  }, [
    activeProviderPort,
    configuredModel,
    hasKey,
    models.length,
    offline,
    optionsOpen,
  ]);

  useEffect(() => {
    if (
      snapshot.matches("reviewReady") && snapshot.context.review &&
      !reviewSent.current
    ) {
      reviewSent.current = true;
      clearSelectedImages();
      onReview(
        snapshot.context.review,
        scanMode === "menu" ? "menu" : "scanned",
      );
    }
  }, [clearSelectedImages, onReview, scanMode, snapshot]);

  useEffect(() => {
    if (snapshot.matches("cancelled") || snapshot.matches("manualEntry")) {
      clearSelectedImages();
      onClose();
    }
  }, [clearSelectedImages, onClose, snapshot]);

  const chooseFiles = (files: readonly File[]) => {
    if (files.length === 0) return;
    const validFiles: File[] = [];
    for (const file of files) {
      const mediaType = fileMediaType(file);
      if (
        !([
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ] as string[]).includes(mediaType)
      ) {
        setModelError(
          scanMode === "menu"
            ? "Choose JPEG, PNG, WebP, or PDF menu files."
            : "Choose a JPEG, PNG, WebP, or PDF receipt file.",
        );
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    const needsSelectionReset = scanBusy || snapshot.matches("failed");
    if (needsSelectionReset) send({ type: "receipt.replace-image" });

    if (scanMode === "receipt") {
      for (const image of selectedImagesRef.current) {
        imageStore.remove(image);
      }
      const next = imageStore.add(validFiles[0]!);
      selectedImagesRef.current = [next];
      setSelectedImages([next]);
    } else {
      const added = validFiles.map((file) => imageStore.add(file));
      const nextList = [...selectedImagesRef.current, ...added];
      selectedImagesRef.current = nextList;
      setSelectedImages(nextList);
    }
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
        : preferredDefaultModel(nextModels, activeProvider);
      setHasKey(true);
      setApiKey("");
      setQuickSetupOpen(false);
      setOptionsOpen(true);
      if (nextSelectedModel) {
        if (!configuredModel) {
          void onSettingsChange(
            settingsWithSelectedModel(
              settings,
              activeProvider,
              nextSelectedModel,
            ),
          );
        }
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
  const selectedOption = configuredModel
    ? availableModelOptions.find((option) => option.id === configuredModel)
    : undefined;
  const displayModelName = selectedOption?.label ?? selectedOption?.id ??
    (configuredModel ? configuredModel.replace(/^models\//, "") : undefined);
  const effectiveModelOptions = useMemo(() => {
    if (
      configuredModel &&
      !availableModelOptions.some((candidate) =>
        candidate.id === configuredModel
      )
    ) {
      return [
        {
          id: configuredModel,
          label: configuredModel.replace(/^models\//, ""),
        },
        ...availableModelOptions,
      ];
    }
    return availableModelOptions;
  }, [availableModelOptions, configuredModel]);
  const project =
    state.projects.find((candidate) =>
      candidate.id === state.selectedProjectId
    ) ?? state.projects.find((candidate) => !candidate.archived);
  const categoryCatalogue = state.categories.filter((category) =>
    !category.archived
  )
    .map((category) => ({
      id: category.id,
      name: category.name,
      ...(category.description ? { description: category.description } : {}),
    }));
  const makeScanInput = (model: string) =>
    selectedImages.length > 0 && project
      ? {
        image: selectedImages[0]!,
        images: selectedImages,
        scanMode,
        today: localCalendarDate(),
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
    if (selectedImages.length === 0) return;
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
    const effectiveModel = configuredModel ??
      preferredDefaultModel(models, activeProvider);
    if (!effectiveModel) {
      setPendingScanState(true);
      setOptionsOpen(true);
      setModelError(`Select a ${activeProviderName} model before scanning.`);
      return;
    }
    if (models.length > 0) {
      const effectiveOption = availableModelOptions.find((option) =>
        option.id === effectiveModel
      );
      if (!effectiveOption || effectiveOption.disabled === true) {
        setPendingScanState(true);
        setOptionsOpen(true);
        setModelError(
          `Refresh ${activeProviderName} models and select an available model.`,
        );
        return;
      }
    }
    if (!configuredModel && effectiveModel) {
      void onSettingsChange(
        settingsWithSelectedModel(settings, activeProvider, effectiveModel),
      );
    }
    const input = makeScanInput(effectiveModel);
    if (!input) {
      setModelError(
        scanMode === "menu"
          ? "The menu images are missing."
          : "The receipt image is missing.",
      );
      return;
    }
    setPendingScanState(false);
    send(
      snapshot.matches("failed")
        ? { type: "receipt.retry", input }
        : { type: "receipt.scan", input },
    );
  };

  const actorFailure = snapshot.context.error;
  const changeProvider = (nextProvider: string) => {
    if (nextProvider !== "gemini" && nextProvider !== "openrouter") return;
    if (nextProvider === activeProvider || scanBusy) return;
    activeProviderRef.current = nextProvider;
    modelRefreshGeneration.current += 1;
    void onSettingsChange({
      ...settings,
      activeProvider: nextProvider,
    });
    const nextPort = providerPort(dependencies, nextProvider);
    setModels(modelCache.get(nextPort) ?? []);
    setHasKey(false);
    setKeyBusy(false);
    setModelsLoading(false);
    setModelError(undefined);
    setOptionsOpen(true);
  };
  const dirty = selectedImages.length > 0 || scanBusy || quickSetupOpen ||
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
          provider={activeProvider}
          onAccept={() => {
            setDisclosureAccepted(true);
            void onSettingsChange({
              ...settings,
              disclosureAccepted: true,
            });
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
        label={scanMode === "menu" ? "Menu image files" : "Receipt image file"}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture={captureMode ? "environment" : undefined}
        multiple={scanMode === "menu"}
        className="receipt-ui-file-field"
        inputRef={sourceInputRef}
        onChange={(event) => {
          const files = event.currentTarget.files;
          if (files && files.length > 0) {
            chooseFiles(Array.from(files));
          }
        }}
      />
      <Stack gap={5}>
        <PageHeader
          title={scanMode === "menu" ? "Scan restaurant menu" : "Scan receipt"}
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
        <SegmentedControl
          label="Scan document type"
          value={scanMode}
          onChange={(val) => {
            const nextMode = val as "receipt" | "menu";
            setScanMode(nextMode);
            if (scanBusy || snapshot.matches("failed")) {
              send({ type: "receipt.replace-image" });
            }
            clearSelectedImages();
            setPendingScanState(false);
            setModelError(undefined);
          }}
          options={[
            { id: "receipt", label: "Receipt" },
            { id: "menu", label: "Restaurant Menu" },
          ]}
        />
        <ReceiptSourcePicker
          previews={scanMode === "menu" && selectedImages.length > 0
            ? selectedImages.map((image, index) => (
              <Card key={image.ephemeralId}>
                <Stack gap={2}>
                  <Inline justify="space-between">
                    <Text size="label">Page {index + 1}</Text>
                    <Inline gap={1}>
                      {image.mediaType !== "application/pdf"
                        ? (
                          <>
                            <IconButton
                              icon={<RotateCcw size={16} />}
                              aria-label={`Rotate page ${
                                index + 1
                              } counter-clockwise 90 degrees`}
                              variant="quiet"
                              isDisabled={scanBusy}
                              onPress={() => rotateImage(image, -90)}
                            />
                            <IconButton
                              icon={<RotateCw size={16} />}
                              aria-label={`Rotate page ${
                                index + 1
                              } clockwise 90 degrees`}
                              variant="quiet"
                              isDisabled={scanBusy}
                              onPress={() =>
                                rotateImage(image, 90)}
                            />
                          </>
                        )
                        : null}
                      <IconButton
                        icon={<Trash2 size={16} />}
                        aria-label={`Remove page ${index + 1}`}
                        variant="quiet"
                        isDisabled={scanBusy}
                        onPress={() => removeImage(image)}
                      />
                    </Inline>
                  </Inline>
                  {image.mediaType === "application/pdf"
                    ? (
                      <div
                        className="receipt-ui-preview receipt-ui-preview--pdf"
                        role="region"
                        aria-label={`Page ${index + 1} preview`}
                      >
                        <div className="receipt-ui-pdf-card">
                          <FileText
                            size={24}
                            className="receipt-ui-pdf-icon"
                            aria-hidden="true"
                          />
                          <Stack gap={1} className="receipt-ui-pdf-info">
                            <Text size="label">PDF menu document</Text>
                            <Text size="caption" tone="secondary">
                              {formatBytes(image.byteLength)} · Ready to scan
                            </Text>
                          </Stack>
                        </div>
                      </div>
                    )
                    : (
                      <div className="receipt-ui-preview-frame">
                        <img
                          src={image.previewUrl}
                          alt={`Page ${index + 1} preview`}
                          className="receipt-ui-preview"
                          data-rotation={image.rotation || undefined}
                          style={image.rotation
                            ? { transform: `rotate(${image.rotation}deg)` }
                            : undefined}
                        />
                      </div>
                    )}
                </Stack>
              </Card>
            ))
            : undefined}
          preview={scanMode === "receipt" && selectedImage
            ? (
              <Stack gap={2}>
                {selectedImage.mediaType !== "application/pdf"
                  ? (
                    <Inline justify="flex-end" gap={1}>
                      <IconButton
                        icon={<RotateCcw size={16} />}
                        aria-label="Rotate receipt counter-clockwise 90 degrees"
                        variant="quiet"
                        isDisabled={scanBusy}
                        onPress={() => rotateImage(selectedImage, -90)}
                      />
                      <IconButton
                        icon={<RotateCw size={16} />}
                        aria-label="Rotate receipt clockwise 90 degrees"
                        variant="quiet"
                        isDisabled={scanBusy}
                        onPress={() => rotateImage(selectedImage, 90)}
                      />
                    </Inline>
                  )
                  : null}
                {selectedImage.mediaType === "application/pdf"
                  ? (
                    <div
                      className="receipt-ui-preview receipt-ui-preview--pdf"
                      role="region"
                      aria-label="Selected receipt preview"
                    >
                      <div className="receipt-ui-pdf-card">
                        <FileText
                          size={32}
                          className="receipt-ui-pdf-icon"
                          aria-hidden="true"
                        />
                        <Stack gap={1} className="receipt-ui-pdf-info">
                          <Text size="label">PDF receipt document</Text>
                          <Text size="caption" tone="secondary">
                            {formatBytes(selectedImage.byteLength)}{" "}
                            · Ready to scan
                          </Text>
                        </Stack>
                      </div>
                    </div>
                  )
                  : (
                    <div className="receipt-ui-preview-frame">
                      <img
                        src={selectedImage.previewUrl}
                        alt="Selected receipt preview"
                        className="receipt-ui-preview"
                        data-rotation={selectedImage.rotation || undefined}
                        style={selectedImage.rotation
                          ? {
                            transform: `rotate(${selectedImage.rotation}deg)`,
                          }
                          : undefined}
                      />
                    </div>
                  )}
              </Stack>
            )
            : undefined}
          emptyTitle={scanMode === "menu"
            ? "No menu pages selected"
            : "No receipt selected"}
          emptyDescription={scanMode === "menu"
            ? "Take photos or choose images of each page of the menu before extracting items."
            : "Choose an image or PDF, or take a photo to preview it before sending."}
          takePhotoLabel={scanMode === "menu" && selectedImages.length > 0
            ? "Add photo"
            : "Take photo"}
          chooseImageLabel={scanMode === "menu" && selectedImages.length > 0
            ? "Add image"
            : "Choose image"}
          onTakePhoto={() => startFilePicker(true)}
          onChooseImage={() => startFilePicker(false)}
          onFilesSelected={chooseFiles}
          onRemove={selectedImages.length > 0
            ? () => {
              if (scanBusy || snapshot.matches("failed")) {
                send({ type: "receipt.replace-image" });
              }
              clearSelectedImages();
              setPendingScanState(false);
              setModelError(undefined);
            }
            : undefined}
        />
        {selectedImages.length > 0
          ? (
            <InlineNotice
              tone="info"
              title={`${
                scanMode === "menu" ? "Menu is" : "Receipt is"
              } sent to ${receiptDisclosureName(activeProvider)}.`}
            >
              In-memory processing only. Embedded metadata is removed before
              sending.
            </InlineNotice>
          )
          : null}
        <StatusPanel
          title={displayModelName
            ? `${activeProviderName}: ${displayModelName}`
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
                    options={effectiveModelOptions}
                    value={configuredModel}
                    onValueChange={selectModel}
                    disabled={modelsLoading &&
                      availableModelOptions.length === 0 && !configuredModel}
                  />
                  {activeProvider === "gemini"
                    ? (
                      <SelectField
                        label="Thinking effort"
                        options={[
                          { id: "auto", label: "Model default (recommended)" },
                          { id: "minimal", label: "Minimal (fastest)" },
                          { id: "low", label: "Low" },
                          { id: "medium", label: "Medium" },
                          { id: "high", label: "High" },
                        ]}
                        value={settings.geminiThinkingLevel ?? "auto"}
                        onValueChange={(level) => {
                          void onSettingsChange({
                            ...settings,
                            geminiThinkingLevel: level as GeminiThinkingLevel,
                          });
                        }}
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
              canRetry={selectedImages.length > 0}
              onRetry={scan}
              onChooseAnotherImage={() => startFilePicker(false)}
              onUseManualEntry={() => send({ type: "receipt.use-manual" })}
            />
          )
          : null}
        {scanBusy
          ? (
            <StatusPanel
              title={scanMode === "menu"
                ? "Extracting menu items"
                : "Scanning receipt"}
              detail="This can take a moment."
              action={
                <Button
                  variant="quiet"
                  onPress={() => {
                    setPendingScanState(false);
                    send({ type: "receipt.cancel-scan" });
                  }}
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
            isDisabled={scanBusy || selectedImages.length === 0 || offline}
            onPress={scan}
          >
            {scanMode === "menu"
              ? (scanBusy ? "Extracting menu items…" : "Extract menu items")
              : (scanBusy ? "Scanning receipt…" : "Scan with AI")}
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
                providerName={receiptDisclosureName(activeProvider)}
                providerDisclosure={receiptDisclosureDetails(activeProvider)}
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

import { useEffect, useRef, useState } from "react";
import type { OpenRouterEndpoint } from "../../adapters/openrouter/index.ts";
import type { ReceiptAiModel } from "../../adapters/ports/index.ts";
import type {
  DeviceLocalSettings,
  GeminiThinkingLevel,
} from "../../domain/index.ts";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Checkbox,
  ContentContainer,
  Heading,
  IconButton,
  Inline,
  InlineNotice,
  ModelPicker,
  PageHeader,
  ReceiptQuickSetup,
  SelectField,
  Stack,
  Switch,
  Text,
} from "../../design-system/index.ts";
import {
  DEFAULT_MODEL_QUERY,
  messageForError,
  modelOptions,
  preferredDefaultModel,
  RECEIPT_PROVIDER_NAMES,
  receiptDisclosureDetails,
  receiptDisclosureName,
  type ReceiptOpenRouterPort,
  type ReceiptProvider,
  type ReceiptProviderPort,
  selectedModelFor,
  settingsWithSelectedModel,
} from "./types.ts";

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
      if (!configuredModel && nextModels.length > 0) {
        const defaultModel = preferredDefaultModel(
          nextModels,
          request.provider,
        );
        if (defaultModel) {
          effectiveSettings = settingsWithSelectedModel(
            effectiveSettings,
            request.provider,
            defaultModel,
          );
          if (!isCurrentRefresh(request)) return;
          onSettingsChange(effectiveSettings);
        }
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
                  <IconButton
                    icon={<Trash2 size={18} />}
                    aria-label="Remove"
                    variant="quiet"
                    isDisabled={loading}
                    onPress={() => void removeKey()}
                  />
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
              providerName={receiptDisclosureName(activeProvider)}
              providerDisclosure={receiptDisclosureDetails(activeProvider)}
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
                  ZDR applies only when enabled: OpenRouter restricts model
                  discovery and requests to ZDR-eligible routes. Deny provider
                  data collection is separate and applies only when enabled by
                  sending the provider data-collection preference. Neither
                  control promises the other policy. Either enabled filter can
                  reduce route availability and may make this model or a
                  preferred provider unavailable.
                </Text>
              </Stack>
            </Card>
          )
          : null}
        {activeProvider === "gemini" && hasKey
          ? (
            <Card as="section">
              <Stack gap={3}>
                <Heading size="sm">Gemini reasoning</Heading>
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
                    onSettingsChange({
                      ...settings,
                      geminiThinkingLevel: level as GeminiThinkingLevel,
                    });
                  }}
                  description="Controls Gemini's thinking budget. Model default lets the model choose its native effort (e.g. Medium on Flash-Lite, High on Pro). Minimal turns off or minimizes reasoning for lowest latency."
                />
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

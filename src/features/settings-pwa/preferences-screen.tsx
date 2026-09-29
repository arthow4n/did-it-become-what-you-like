import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Button,
  Card,
  ContentContainer,
  FormActions,
  IconButton,
  InlineNotice,
  NativeTimeField,
  PageHeader,
  Stack,
  StatusMessage,
  Text,
} from "../../design-system/index.ts";
import { createPreferencesMachine } from "../../actors/preferences.ts";
import type { LocalPort } from "../../adapters/ports/local.ts";

export function PreferencesScreen({
  local,
  onClose,
  onSaved,
  onDirtyChange,
  discardRequest,
  onDiscarded,
}: {
  readonly local: LocalPort;
  readonly onClose: () => void;
  readonly onSaved?: (expenseDayBoundary: string) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly discardRequest?: number;
  readonly onDiscarded?: () => void;
}) {
  const machine = useMemo(() => createPreferencesMachine({ local }), [local]);
  const [snapshot, send] = useActor(machine);
  const loaded = useRef(false);
  const lastSaved = useRef<string | undefined>(undefined);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const pendingDiscardRef = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      send({ type: "preferences.load" });
    }
  }, [send]);

  const dirty = snapshot.hasTag("dirty");
  const preferenceFailed = snapshot.matches("loadFailed") ||
    snapshot.matches("saveFailed");
  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    pendingDiscardRef.current = true;
    send({ type: "preferences.discard" });
  }, [discardRequest, send]);

  useEffect(() => {
    if (!pendingDiscardRef.current || !snapshot.matches("ready")) return;
    pendingDiscardRef.current = false;
    onDiscarded?.();
  }, [onDiscarded, snapshot]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    if (
      snapshot.matches("saved") &&
      lastSaved.current !== snapshot.context.expenseDayBoundary
    ) {
      lastSaved.current = snapshot.context.expenseDayBoundary;
      onSaved?.(snapshot.context.expenseDayBoundary);
    }
  }, [
    dirty,
    onDirtyChange,
    onSaved,
    snapshot,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), 60_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  if (snapshot.matches("loading") || snapshot.matches("idle")) {
    return (
      <ContentContainer size="readable">
        <Text>Loading preferences…</Text>
      </ContentContainer>
    );
  }

  const boundary = snapshot.context.expenseDayBoundary;
  const boundaryDate = new Date(now);
  const currentTime = now.toTimeString().slice(0, 5);
  if (currentTime < boundary) boundaryDate.setDate(boundaryDate.getDate() - 1);
  const enteredDate = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const suggestedDate = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(boundaryDate);
  const resetToDefault = () => {
    if (snapshot.hasTag("saving") || boundary === "03:00") return;
    send({ type: "preferences.change", expenseDayBoundary: "03:00" });
    send({ type: "preferences.save" });
  };

  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader
          title="Preferences"
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
        <Card as="section">
          <Stack gap={4}>
            <NativeTimeField
              label="Expense-day boundary"
              required
              value={boundary}
              onChange={(event) =>
                send({
                  type: "preferences.change",
                  expenseDayBoundary: event.currentTarget.value,
                })}
              description="Before this local time, a new manual expense defaults to the previous calendar date."
            />
            <InlineNotice tone="info" title="Example">
              Entered at {currentTime} on {enteredDate}. Suggested date:{" "}
              {suggestedDate}.
            </InlineNotice>
            {preferenceFailed
              ? (
                <InlineNotice tone="danger" title="Preferences need attention">
                  {snapshot.context.error?.message ??
                    "The preference could not be saved."}
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "preferences.retry" })}
                  >
                    Retry
                  </Button>
                </InlineNotice>
              )
              : null}
            {snapshot.hasTag("saving")
              ? <StatusMessage>Saving preference locally…</StatusMessage>
              : snapshot.matches("saved")
              ? <StatusMessage tone="positive">Preference saved.</StatusMessage>
              : null}
            <FormActions>
              <Button
                variant="quiet"
                onPress={resetToDefault}
                isDisabled={snapshot.hasTag("saving") || boundary === "03:00"}
              >
                Reset to default (03:00)
              </Button>
              <Button
                variant="quiet"
                onPress={onClose}
                isDisabled={snapshot.hasTag("saving")}
              >
                Close
              </Button>
              <Button
                onPress={() => send({ type: "preferences.save" })}
                isDisabled={!dirty || snapshot.hasTag("saving")}
              >
                Save preferences
              </Button>
            </FormActions>
          </Stack>
        </Card>
      </Stack>
    </ContentContainer>
  );
}

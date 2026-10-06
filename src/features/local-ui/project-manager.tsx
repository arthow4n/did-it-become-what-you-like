import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  createProjectDeletionDependencies,
  createProjectDeletionMachine,
} from "../../actors/project-deletion.ts";
import { createProjectOrganizationMachine } from "../../actors/project-category.ts";
import type { LocalRepository } from "../../adapters/local/index.ts";
import { type Project } from "../../domain/index.ts";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../../domain/organization.ts";
import {
  AdaptiveDialog,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ContentContainer,
  CurrencyPicker,
  DefinitionList,
  Disclosure,
  EmptyState,
  FormActions,
  Heading,
  IconButton,
  Inline,
  InlineNotice,
  List,
  ListRow,
  PageHeader,
  Stack,
  Text,
  TextField,
} from "../../design-system/index.ts";
import {
  CURRENCY_OPTIONS,
  type EditorState,
  idFor,
  type LocalUiPath,
} from "./types.ts";
function isProjectEmpty(
  state: ProjectCategoryState,
  projectId: string,
): boolean {
  return !state.expenses.some((expense) => expense.projectId === projectId) &&
    !state.receipts.some((receipt) => receipt.projectId === projectId) &&
    !state.receiptPurchaseLines.some((line) => line.projectId === projectId) &&
    !state.receiptAdjustments.some((line) => line.projectId === projectId);
}
async function saveProjectSafetyExport(json: string): Promise<void> {
  if (
    globalThis.document === undefined ||
    globalThis.URL?.createObjectURL === undefined
  ) {
    throw { code: "unavailable" };
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "did-it-become-what-you-like-project-safety.json";
  anchor.click();
  URL.revokeObjectURL(url);
  await Promise.resolve();
}
function ProjectDeletionReview({
  repository,
  state,
  project,
  onDeleted,
}: {
  repository: LocalRepository;
  state: ProjectCategoryState;
  project: Project;
  onDeleted: () => void;
}) {
  const dependencies = useMemo(
    () =>
      createProjectDeletionDependencies(repository, {
        deviceId: repository.deviceId,
        saveSafetyExport: saveProjectSafetyExport,
      }),
    [repository],
  );
  const [generation, setGeneration] = useState(0);
  const machine = useMemo(
    () => createProjectDeletionMachine(dependencies),
    [dependencies, generation],
  );
  const [snapshot, send] = useActor(machine);
  const [isOpen, setIsOpen] = useState(false);
  const [openRequested, setOpenRequested] = useState(false);
  const handledResult = useRef(false);
  const expenses = state.expenses.filter((expense) =>
    expense.projectId === project.id
  );
  const receipts = state.receipts.filter((receipt) =>
    receipt.projectId === project.id
  );
  const purchaseLines = state.receiptPurchaseLines.filter((line) =>
    line.projectId === project.id
  );
  const adjustments = state.receiptAdjustments.filter((adjustment) =>
    adjustment.projectId === project.id
  );
  const dates = [
    ...expenses.map((expense) => expense.date),
    ...receipts.map((receipt) => receipt.date),
  ].sort();
  const currencies = [
    ...new Set([
      ...expenses.map((expense) => expense.currency),
      ...receipts.map((receipt) => receipt.currency),
    ]),
  ].sort();
  const target = {
    projectId: project.id,
    projectName: project.name,
    expenseCount: expenses.length,
    receiptCount: receipts.length,
  };
  useEffect(() => {
    if (!openRequested || !snapshot.matches("idle")) return;
    setOpenRequested(false);
    send({
      type: "project-delete.open",
      target,
      safetyExportRequired: true,
    });
  }, [openRequested, send, snapshot, target]);
  useEffect(() => {
    if (
      !snapshot.matches("completed") || snapshot.context.result === null ||
      handledResult.current
    ) return;
    handledResult.current = true;
    setIsOpen(false);
    onDeleted();
  }, [onDeleted, snapshot]);
  const cancel = (close: () => void) => {
    send({ type: "project-delete.cancel" });
    setOpenRequested(false);
    setIsOpen(false);
    close();
  };
  const terminal = snapshot.matches("completed") ||
    snapshot.matches("cancelled");
  const saving = snapshot.hasTag("saving");
  const failure = snapshot.context.error?.message;
  return (
    <AdaptiveDialog
      trigger={<Button variant="quiet">Delete project</Button>}
      title={`Delete ${project.name}?`}
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (next) {
          handledResult.current = false;
          if (terminal) setGeneration((value) => value + 1);
          setIsOpen(true);
          setOpenRequested(true);
        } else {
          send({ type: "project-delete.cancel" });
          setOpenRequested(false);
          setIsOpen(false);
        }
      }}
      isDismissable={!saving}
      className="local-ui-project-delete-dialog"
    >
      {(close) => (
        <Stack gap={5}>
          <InlineNotice tone="danger" title="Destructive action">
            This will permanently delete this project and all its expenses from
            your devices. Recovery is only possible from a JSON backup.
          </InlineNotice>
          <DefinitionList
            items={[
              { term: "Project", description: project.name },
              { term: "Expenses", description: expenses.length },
              { term: "Receipts", description: receipts.length },
              { term: "Purchase lines", description: purchaseLines.length },
              { term: "Adjustments", description: adjustments.length },
              {
                term: "Currencies",
                description: currencies.length ? currencies.join(", ") : "None",
              },
              {
                term: "Date range",
                description: dates.length
                  ? `${dates[0]} – ${dates[dates.length - 1]}`
                  : "None",
              },
            ]}
          />
          {snapshot.matches("reviewing")
            ? (
              <Stack gap={3}>
                <Text>
                  Export a safety backup before deleting this project.
                </Text>
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() =>
                      send({ type: "project-delete.export-safety" })}
                  >
                    Export safety copy
                  </Button>
                </FormActions>
              </Stack>
            )
            : null}
          {snapshot.matches("exporting")
            ? (
              <InlineNotice tone="info" title="Creating safety export">
                Keep this window open while the complete JSON file is created.
              </InlineNotice>
            )
            : null}
          {snapshot.matches("exportFailed")
            ? (
              <InlineNotice tone="danger" title="Safety export failed">
                {failure ?? "The safety export was not created."}
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "project-delete.retry" })}
                  >
                    Retry export
                  </Button>
                </FormActions>
              </InlineNotice>
            )
            : null}
          {snapshot.matches("confirming")
            ? (
              <Stack gap={4}>
                <TextField
                  label={`Type ${project.name} to confirm`}
                  value={snapshot.context.typedName}
                  onChange={(value) =>
                    send({ type: "project-delete.type-name", value })}
                  description="The name must match exactly."
                  error={failure}
                  autoFocus
                />
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isDisabled={snapshot.context.typedName !== project.name}
                    onPress={() => send({ type: "project-delete.confirm" })}
                  >
                    Delete project
                  </Button>
                </FormActions>
              </Stack>
            )
            : null}
          {snapshot.matches("deleting")
            ? (
              <InlineNotice tone="info" title="Deleting project">
                Deleting project and related records…
              </InlineNotice>
            )
            : null}
          {snapshot.matches("failed")
            ? (
              <InlineNotice tone="danger" title="Project deletion failed">
                {failure ?? "The deletion was not committed."}
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "project-delete.retry" })}
                  >
                    Retry deletion
                  </Button>
                </FormActions>
              </InlineNotice>
            )
            : null}
        </Stack>
      )}
    </AdaptiveDialog>
  );
}
export function ProjectManager({
  repository,
  service,
  state,
  initialCreate = false,
  isEmbedded = false,
  onStateChange,
  onNavigate,
  onDirtyChange,
  onEditorOpenChange,
  discardRequest,
  onDirtyDiscarded,
  onComplete,
}: {
  repository?: LocalRepository;
  service: ProjectCategoryService;
  state: ProjectCategoryState;
  initialCreate?: boolean;
  isEmbedded?: boolean;
  onStateChange: (state: ProjectCategoryState) => void;
  onNavigate: (path: LocalUiPath) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onEditorOpenChange?: (open: boolean) => void;
  discardRequest?: number;
  onDirtyDiscarded?: () => void;
  onComplete?: () => void;
}) {
  const machine = useMemo(() => createProjectOrganizationMachine(service), [
    service,
  ]);
  const [snapshot, send] = useActor(machine);
  const [editor, setEditor] = useState<EditorState<Project> | null>(
    initialCreate ? { kind: "create" } : null,
  );
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [saveTarget, setSaveTarget] = useState<Project | null>(null);
  const [recordDeleted, setRecordDeleted] = useState(false);
  const handledInitialCreate = useRef(false);
  const isSubmittingRef = useRef(false);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const editorIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (snapshot.matches("closed")) {
      send({ type: "project.open", state });
    }
  }, [send, snapshot, state]);
  useEffect(() => {
    if (snapshot.context.state) onStateChange(snapshot.context.state);
  }, [onStateChange, snapshot.context.state]);
  useEffect(() => {
    if (
      (snapshot.matches("ready") || snapshot.matches("failed")) &&
      snapshot.context.state !== state
    ) {
      send({ type: "project.open", state });
    }
  }, [send, snapshot, state]);
  useEffect(() => {
    if (initialCreate && !handledInitialCreate.current) {
      handledInitialCreate.current = true;
      setEditor({ kind: "create" });
    }
  }, [initialCreate]);
  useEffect(() => {
    const nextIdentity = editor === null
      ? null
      : editor.kind === "create"
      ? "create"
      : `edit:${editor.record.id}`;
    const changed = editorIdentity.current !== nextIdentity;
    editorIdentity.current = nextIdentity;
    if (!editor || !changed) return;
    if (editor.kind === "create") {
      setName("");
      setCurrency("SEK");
    } else {
      setName(editor.record.name);
      setCurrency(editor.record.defaultCurrency);
    }
    setSaveTarget(null);
  }, [editor]);
  useEffect(() => {
    onEditorOpenChange?.(editor !== null);
  }, [editor, onEditorOpenChange]);
  useEffect(() => {
    if (!saveTarget || !snapshot.context.state || !snapshot.matches("ready")) {
      return;
    }
    const project = snapshot.context.state.projects.find((candidate) =>
      candidate.id === saveTarget.id
    );
    if (!project) return;
    const normalizedName = name.trim();
    if (project.name !== normalizedName) {
      send({
        type: "project.command",
        command: {
          type: "rename",
          projectId: project.id,
          name: normalizedName,
        },
      });
      return;
    }
    if (project.defaultCurrency !== currency) {
      send({
        type: "project.set-default-currency",
        projectId: project.id,
        currency: currency as Project["defaultCurrency"],
      });
      return;
    }
    setSaveTarget(null);
    setEditor(null);
    onComplete?.();
  }, [currency, name, onComplete, saveTarget, send, snapshot]);
  useEffect(() => {
    if (
      editor?.kind === "create" &&
      isSubmittingRef.current &&
      snapshot.context.result &&
      snapshot.matches("ready")
    ) {
      isSubmittingRef.current = false;
      setEditor(null);
      onComplete?.();
    }
  }, [editor, onComplete, snapshot]);
  const dirty = editor !== null && (
    editor.kind === "create"
      ? name.length > 0 || currency !== "SEK"
      : name !== editor.record.name ||
        currency !== editor.record.defaultCurrency
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (
      editor?.kind !== "edit" || saveTarget !== null ||
      snapshot.context.state === null
    ) return;
    const freshRecord = state.projects.find((project) =>
      project.id === editor.record.id
    );
    if (freshRecord === undefined) {
      setRecordDeleted(true);
      return;
    }
    if (freshRecord === editor.record) return;
    setRecordDeleted(false);
    setEditor({ kind: "edit", record: freshRecord });
    if (!dirty) {
      setName(freshRecord.name);
      setCurrency(freshRecord.defaultCurrency);
    }
  }, [dirty, editor, saveTarget, snapshot.context.state, state.projects]);
  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    setEditor(null);
    setSaveTarget(null);
    isSubmittingRef.current = false;
    onDirtyChange?.(false);
    onDirtyDiscarded?.();
  }, [discardRequest, onDirtyChange, onDirtyDiscarded]);
  const openEditor = (nextEditor: EditorState<Project>) => {
    setRecordDeleted(false);
    setEditor(nextEditor);
  };
  const submitEditor = () => {
    if (!name.trim() || !snapshot.matches("ready")) return;
    if (editor?.kind === "create") {
      isSubmittingRef.current = true;
      send({
        type: "project.command",
        command: {
          type: "create",
          project: {
            schemaVersion: 1,
            type: "project",
            id: idFor("project"),
            name: name.trim(),
            defaultCurrency: currency as Project["defaultCurrency"],
            archived: false,
          },
        },
      });
      return;
    }
    if (!editor || editor.kind !== "edit") return;
    setSaveTarget(editor.record);
    if (editor.record.name !== name.trim()) {
      send({
        type: "project.command",
        command: {
          type: "rename",
          projectId: editor.record.id,
          name: name.trim(),
        },
      });
    } else if (editor.record.defaultCurrency !== currency) {
      send({
        type: "project.set-default-currency",
        projectId: editor.record.id,
        currency: currency as Project["defaultCurrency"],
      });
    } else {
      setSaveTarget(null);
      setEditor(null);
    }
  };
  if (editor) {
    const isSaving = snapshot.hasTag("saving");
    return (
      <ContentContainer size="form">
        <Stack gap={5}>
          <PageHeader
            title={editor.kind === "create" ? "Create project" : "Edit project"}
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={() => onNavigate("/projects")}
              />
            }
          />
          <Card as="section">
            <Stack gap={5}>
              <TextField
                label="Project name"
                isRequired
                value={name}
                onChange={setName}
                error={snapshot.context.error?.code === "conflict"
                  ? snapshot.context.error.message
                  : undefined}
              />
              <CurrencyPicker
                label="Default currency"
                options={CURRENCY_OPTIONS.map((code) => ({
                  id: code,
                  label: code,
                }))}
                value={currency}
                onValueChange={setCurrency}
              />
              {recordDeleted
                ? (
                  <InlineNotice
                    tone="warning"
                    title="Project deleted elsewhere"
                  >
                    This project no longer exists in the current organization.
                    Discard this draft before continuing.
                  </InlineNotice>
                )
                : snapshot.context.error
                ? (
                  <InlineNotice tone="danger" title="Project was not saved">
                    {snapshot.context.error.message}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                <Button
                  variant="secondary"
                  onPress={() => {
                    send({ type: "project.cancel" });
                    setEditor(null);
                    onComplete?.();
                  }}
                >
                  {recordDeleted ? "Discard draft" : "Cancel"}
                </Button>
                {snapshot.matches("failed")
                  ? (
                    <Button
                      variant="secondary"
                      onPress={() => send({ type: "project.retry" })}
                    >
                      Retry
                    </Button>
                  )
                  : null}
                <Button
                  pending={isSaving}
                  isDisabled={recordDeleted || isSaving || !name.trim()}
                  onPress={submitEditor}
                >
                  Save project
                </Button>
              </FormActions>
            </Stack>
          </Card>
        </Stack>
      </ContentContainer>
    );
  }
  const current =
    state.projects.find((project) => project.id === state.selectedProjectId) ??
      state.projects.find((project) => !project.archived);
  const activeOthers = state.projectOrder.map((id) =>
    state.projects.find((project) => project.id === id)
  ).filter((project): project is Project =>
    Boolean(project && !project.archived && project.id !== current?.id)
  );
  const archived = state.projects.filter((project) => project.archived);
  const moveOther = (projectId: string, direction: -1 | 1) => {
    const index = activeOthers.findIndex((project) => project.id === projectId);
    const nextIndex = index + direction;
    if (
      index < 0 || nextIndex < 0 || nextIndex >= activeOthers.length || !current
    ) return;
    const next = [...activeOthers];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(nextIndex, 0, moved);
    send({
      type: "project.command",
      command: {
        type: "reorder",
        orderedIds: [current.id, ...next.map((project) => project.id)],
      },
    });
  };
  const content = (
    <Stack gap={5}>
      {!isEmbedded
        ? (
          <PageHeader
            headingLevel={1}
            title="Manage projects"
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back to organize"
                variant="quiet"
                onPress={() => onNavigate("/organize")}
              />
            }
            actions={
              <Button onPress={() => openEditor({ kind: "create" })}>
                Create project
              </Button>
            }
          />
        )
        : (
          <Inline justify="space-between">
            <Heading size="sm">Projects</Heading>
            <Button onPress={() => openEditor({ kind: "create" })}>
              Create project
            </Button>
          </Inline>
        )}
      {snapshot.context.error
        ? (
          <InlineNotice tone="danger" title="Project change failed">
            {snapshot.context.error.message}
          </InlineNotice>
        )
        : null}
      <section
        className="local-ui-management-section"
        aria-label="Current project"
      >
        <Heading size="sm">Current project</Heading>
        {current
          ? (
            <List>
              <ListRow trailing={<Badge tone="positive">Current</Badge>}>
                <Inline justify="space-between">
                  <Stack gap={1}>
                    <strong>{current.name}</strong>
                    <Text tone="secondary">{current.defaultCurrency}</Text>
                  </Stack>
                  <IconButton
                    icon={<Pencil size={18} />}
                    aria-label="Edit"
                    variant="quiet"
                    onPress={() =>
                      openEditor({ kind: "edit", record: current })}
                  />
                </Inline>
              </ListRow>
            </List>
          )
          : (
            <EmptyState title="No active project">
              Create a project to start tracking expenses.
            </EmptyState>
          )}
      </section>
      <section
        className="local-ui-management-section"
        aria-label="Other projects"
      >
        <Heading size="sm">Other projects</Heading>
        <List>
          {activeOthers.map((project, index) => (
            <ListRow key={project.id}>
              <Stack gap={2}>
                <Inline justify="space-between">
                  <Stack gap={1}>
                    <strong>{project.name}</strong>
                    <Text tone="secondary">{project.defaultCurrency}</Text>
                  </Stack>
                  <Inline gap={2}>
                    <Button
                      variant="secondary"
                      onPress={() =>
                        send({
                          type: "project.command",
                          command: { type: "select", projectId: project.id },
                        })}
                    >
                      Use
                    </Button>
                    <IconButton
                      icon={<Pencil size={18} />}
                      aria-label="Edit"
                      variant="quiet"
                      onPress={() =>
                        openEditor({ kind: "edit", record: project })}
                    />
                  </Inline>
                </Inline>
                <div className="local-ui-card-actions--primary-stack">
                  <div className="local-ui-card-actions--grid">
                    <Button
                      variant="quiet"
                      isDisabled={index === 0 || snapshot.hasTag("saving")}
                      onPress={() => moveOther(project.id, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="quiet"
                      isDisabled={index === activeOthers.length - 1 ||
                        snapshot.hasTag("saving")}
                      onPress={() => moveOther(project.id, 1)}
                    >
                      Move down
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="quiet"
                          isDisabled={snapshot.hasTag("saving")}
                        >
                          Archive
                        </Button>
                      }
                      title={`Archive ${project.name}?`}
                      description="The project and its expenses stay on this device and can be restored later."
                      confirmLabel="Archive project"
                      onConfirm={() =>
                        send({
                          type: "project.command",
                          command: { type: "archive", projectId: project.id },
                        })}
                    />
                    {isProjectEmpty(state, project.id)
                      ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="quiet">Delete empty</Button>
                          }
                          title={`Delete ${project.name}?`}
                          description="This empty project will be removed locally. This action cannot be undone from the project list."
                          confirmLabel="Delete project"
                          confirmVariant="danger"
                          onConfirm={() =>
                            send({
                              type: "project.command",
                              command: {
                                type: "delete-empty",
                                projectId: project.id,
                              },
                            })}
                        />
                      )
                      : repository
                      ? (
                        <ProjectDeletionReview
                          repository={repository}
                          state={state}
                          project={project}
                          onDeleted={() => {
                            void service.getState().then(onStateChange);
                          }}
                        />
                      )
                      : (
                        <Text size="caption" tone="muted">
                          Deletion unavailable.
                        </Text>
                      )}
                  </div>
                </div>
              </Stack>
            </ListRow>
          ))}
        </List>
      </section>
      {current
        ? (
          <Text tone="secondary">
            Switch to another project before archiving {current.name}.
          </Text>
        )
        : null}
      <Disclosure title={`Archived projects (${archived.length})`}>
        {archived.length
          ? (
            <List>
              {archived.map((project) => (
                <ListRow key={project.id} trailing={<Badge>Archived</Badge>}>
                  <Stack gap={2}>
                    <Inline justify="space-between">
                      <Stack gap={1}>
                        <strong>{project.name}</strong>
                        <Text tone="secondary">
                          {project.defaultCurrency}
                        </Text>
                      </Stack>
                      <IconButton
                        icon={<Pencil size={18} />}
                        aria-label="Edit"
                        variant="quiet"
                        onPress={() =>
                          openEditor({ kind: "edit", record: project })}
                      />
                    </Inline>
                    <div className="local-ui-card-actions--grid">
                      <Button
                        variant="secondary"
                        onPress={() =>
                          send({
                            type: "project.command",
                            command: {
                              type: "restore",
                              projectId: project.id,
                            },
                          })}
                      >
                        Restore
                      </Button>
                      {isProjectEmpty(state, project.id)
                        ? (
                          <ConfirmDialog
                            trigger={
                              <Button variant="quiet">Delete empty</Button>
                            }
                            title={`Delete ${project.name}?`}
                            description="This archived project is empty and will be removed locally. This action cannot be undone from the project list."
                            confirmLabel="Delete project"
                            confirmVariant="danger"
                            onConfirm={() =>
                              send({
                                type: "project.command",
                                command: {
                                  type: "delete-empty",
                                  projectId: project.id,
                                },
                              })}
                          />
                        )
                        : repository
                        ? (
                          <ProjectDeletionReview
                            repository={repository}
                            state={state}
                            project={project}
                            onDeleted={() => {
                              void service.getState().then(onStateChange);
                            }}
                          />
                        )
                        : (
                          <Text size="caption" tone="muted">
                            Deletion unavailable.
                          </Text>
                        )}
                    </div>
                  </Stack>
                </ListRow>
              ))}
            </List>
          )
          : null}
      </Disclosure>
    </Stack>
  );

  return isEmbedded ? content : <ContentContainer>{content}</ContentContainer>;
}

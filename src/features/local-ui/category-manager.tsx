import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { createCategoryOrganizationMachine } from "../../actors/project-category.ts";
import type { Category } from "../../domain/index.ts";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../../domain/organization.ts";
import {
  Badge,
  Button,
  Card,
  ColorChoiceField,
  ConfirmDialog,
  ContentContainer,
  DeleteAndReassign,
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
  SearchField,
  Stack,
  Text,
  TextArea,
  TextField,
} from "../../design-system/index.ts";
import { type EditorState, idFor, type LocalUiPath } from "./types.ts";
export function CategoryManager({
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
  const machine = useMemo(() => createCategoryOrganizationMachine(service), [
    service,
  ]);
  const [snapshot, send] = useActor(machine);
  const [editor, setEditor] = useState<EditorState<Category> | null>(
    initialCreate ? { kind: "create" } : null,
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [recordDeleted, setRecordDeleted] = useState(false);
  const handledInitialCreate = useRef(false);
  const isSubmittingRef = useRef(false);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const editorIdentity = useRef<string | null>(null);
  useEffect(() => {
    if (snapshot.matches("closed")) send({ type: "category.open", state });
  }, [send, snapshot, state]);
  useEffect(() => {
    if (snapshot.context.state) onStateChange(snapshot.context.state);
  }, [onStateChange, snapshot.context.state]);
  useEffect(() => {
    if (
      !isSubmittingRef.current &&
      (snapshot.matches("ready") || snapshot.matches("failed")) &&
      snapshot.context.state !== state
    ) {
      send({ type: "category.open", state });
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
      setColor(undefined);
      setDescription("");
    } else {
      setName(editor.record.name);
      setColor(editor.record.color);
      setDescription(editor.record.description ?? "");
    }
  }, [editor]);
  useEffect(() => {
    onEditorOpenChange?.(editor !== null);
  }, [editor, onEditorOpenChange]);
  const submitEditor = () => {
    if (!name.trim() || !snapshot.matches("ready")) return;
    isSubmittingRef.current = true;
    const trimmedDescription = description.trim() || undefined;
    if (editor?.kind === "create") {
      send({
        type: "category.command",
        command: {
          type: "create",
          category: {
            schemaVersion: 1,
            type: "category",
            id: idFor("category"),
            name: name.trim(),
            ...(color ? { color } : {}),
            ...(trimmedDescription ? { description: trimmedDescription } : {}),
            sortOrder: state.categories.length + 1,
            archived: false,
            system: false,
          },
        },
      });
    } else if (editor?.kind === "edit") {
      send({
        type: "category.command",
        command: {
          type: "rename",
          categoryId: editor.record.id,
          name: name.trim(),
          color,
          description: trimmedDescription,
        },
      });
    }
  };
  useEffect(() => {
    if (
      editor &&
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
      ? name.length > 0 || color !== undefined || description.length > 0
      : name !== editor.record.name || color !== editor.record.color ||
        (description.trim() || undefined) !==
          (editor.record.description ?? undefined)
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (editor?.kind !== "edit" || isSubmittingRef.current) return;
    const freshRecord = state.categories.find((category) =>
      category.id === editor.record.id
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
      setColor(freshRecord.color);
      setDescription(freshRecord.description ?? "");
    }
  }, [dirty, editor, state.categories]);
  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    setEditor(null);
    isSubmittingRef.current = false;
    onDirtyChange?.(false);
    onDirtyDiscarded?.();
  }, [discardRequest, onDirtyChange, onDirtyDiscarded]);
  const openEditor = (nextEditor: EditorState<Category>) => {
    setRecordDeleted(false);
    setEditor(nextEditor);
  };
  if (editor) {
    return (
      <ContentContainer size="form">
        <Stack gap={5}>
          <PageHeader
            title={editor.kind === "create"
              ? "Create category"
              : "Edit category"}
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={() => {
                  if (dirty) {
                    onNavigate("/categories");
                  } else {
                    send({ type: "category.cancel" });
                    setEditor(null);
                    onComplete?.();
                  }
                }}
              />
            }
          />
          <Card as="section">
            <Stack gap={5}>
              <TextField
                label="Category name"
                isRequired
                value={name}
                onChange={setName}
                error={snapshot.context.error?.code === "conflict"
                  ? snapshot.context.error.message
                  : undefined}
              />
              <ColorChoiceField
                label="Category color (optional)"
                value={color}
                onValueChange={setColor}
              />
              {color
                ? (
                  <Button variant="quiet" onPress={() => setColor(undefined)}>
                    Clear color
                  </Button>
                )
                : null}
              <TextArea
                label="AI matching description (optional)"
                placeholder="e.g., Groceries, pantry items, coffee beans, snacks"
                description="Helps AI match items to this category."
                value={description}
                onChange={setDescription}
              />
              {recordDeleted
                ? (
                  <InlineNotice
                    tone="warning"
                    title="Category deleted elsewhere"
                  >
                    This category no longer exists in the current organization.
                    Discard this draft before continuing.
                  </InlineNotice>
                )
                : snapshot.context.error
                ? (
                  <InlineNotice tone="danger" title="Category was not saved">
                    {snapshot.context.error.message}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                <Button
                  variant="secondary"
                  onPress={() => {
                    send({ type: "category.cancel" });
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
                      onPress={() => send({ type: "category.retry" })}
                    >
                      Retry
                    </Button>
                  )
                  : null}
                <Button
                  pending={snapshot.hasTag("saving")}
                  isDisabled={recordDeleted || snapshot.hasTag("saving") ||
                    !name.trim()}
                  onPress={submitEditor}
                >
                  Save category
                </Button>
              </FormActions>
            </Stack>
          </Card>
        </Stack>
      </ContentContainer>
    );
  }
  const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
  const matches = (category: Category) =>
    !normalizedSearch ||
    category.name.toLocaleLowerCase("en-US").includes(normalizedSearch);
  const active = state.categories.filter((category) =>
    !category.archived && matches(category)
  );
  const archived = state.categories.filter((category) =>
    category.archived && matches(category)
  );
  const customActive = active.filter((category) => !category.system);
  const moveCategory = (categoryId: string, direction: -1 | 1) => {
    const ordered = state.categories.filter((category) =>
      !category.archived && !category.system
    );
    const index = ordered.findIndex((category) => category.id === categoryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(nextIndex, 0, moved);
    send({
      type: "category.command",
      command: {
        type: "reorder",
        orderedIds: next.map((category) => category.id),
      },
    });
  };
  const uncategorized = state.categories.find((category) => category.system);
  const replacementCategories = state.categories
    .filter((candidate) =>
      !candidate.archived && candidate.id !== uncategorized?.id
    )
    .concat(uncategorized ? [uncategorized] : []);
  const listContent = (
    <Stack gap={5}>
      {!isEmbedded
        ? (
          <PageHeader
            headingLevel={1}
            title="Manage categories"
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
                Create category
              </Button>
            }
          />
        )
        : (
          <Inline justify="space-between">
            <Heading size="sm">Categories</Heading>
            <Button onPress={() => openEditor({ kind: "create" })}>
              Create category
            </Button>
          </Inline>
        )}
      <SearchField
        label="Search categories"
        placeholder="Find an active or archived category"
        value={search}
        onValueChange={setSearch}
      />
      {snapshot.context.error
        ? (
          <InlineNotice tone="danger" title="Category change failed">
            {snapshot.context.error.message}
          </InlineNotice>
        )
        : null}
      <List label="Active categories">
        {customActive.map((category, index) => (
          <ListRow key={category.id}>
            <Inline
              justify="space-between"
              className="local-ui-category-row-inner"
            >
              <Inline gap={2}>
                {category.color
                  ? (
                    <span
                      className="local-ui-category-swatch"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                  )
                  : null}
                <strong>{category.name}</strong>
              </Inline>
              <div
                className="local-ui-category-actions"
                aria-label={`Actions for ${category.name}`}
                role="group"
              >
                <div
                  className="local-ui-category-actions__reorder"
                  role="group"
                  aria-label="Reorder"
                >
                  <IconButton
                    icon={<ArrowUp size={18} />}
                    aria-label={`Move ${category.name} up`}
                    title="Move up"
                    variant="quiet"
                    isDisabled={index === 0 || snapshot.hasTag("saving")}
                    onPress={() => moveCategory(category.id, -1)}
                  />
                  <IconButton
                    icon={<ArrowDown size={18} />}
                    aria-label={`Move ${category.name} down`}
                    title="Move down"
                    variant="quiet"
                    isDisabled={index === customActive.length - 1 ||
                      snapshot.hasTag("saving")}
                    onPress={() => moveCategory(category.id, 1)}
                  />
                </div>
                <div className="local-ui-category-actions__manage">
                  <IconButton
                    icon={<Pencil size={18} />}
                    aria-label={`Edit ${category.name}`}
                    title="Edit"
                    variant="quiet"
                    onPress={() =>
                      openEditor({ kind: "edit", record: category })}
                  />
                  <ConfirmDialog
                    trigger={
                      <IconButton
                        icon={<Archive size={18} />}
                        aria-label={`Archive ${category.name}`}
                        title="Archive"
                        variant="quiet"
                        isDisabled={snapshot.hasTag("saving")}
                      />
                    }
                    title={`Archive ${category.name}?`}
                    description="Existing expenses keep this category, while new entries use active categories."
                    confirmLabel="Archive category"
                    onConfirm={() =>
                      send({
                        type: "category.command",
                        command: { type: "archive", categoryId: category.id },
                      })}
                  />
                  <DeleteAndReassign
                    trigger={
                      <IconButton
                        icon={<Trash2 size={18} />}
                        aria-label={`Delete ${category.name}`}
                        title="Delete and reassign"
                        variant="quiet"
                        isDisabled={snapshot.hasTag("saving")}
                      />
                    }
                    title={`Delete ${category.name}?`}
                    description="Choose the category which should receive every reference to this category."
                    replacementOptions={replacementCategories.map(
                      (replacement) => ({
                        id: replacement.id,
                        label: replacement.name,
                      }),
                    )}
                    defaultReplacementId={uncategorized?.id ?? ""}
                    affectedCount={state.expenses.filter((expense) =>
                      expense.categoryId === category.id
                    ).length}
                    onConfirm={(replacementCategoryId) =>
                      send({
                        type: "category.command",
                        command: {
                          type: "delete-and-reassign",
                          categoryId: category.id,
                          replacementCategoryId,
                        },
                      })}
                  />
                </div>
              </div>
            </Inline>
          </ListRow>
        ))}
        {uncategorized && matches(uncategorized)
          ? (
            <ListRow trailing={<Badge>Built-in</Badge>}>
              <strong>{uncategorized.name}</strong>
            </ListRow>
          )
          : null}
      </List>
      {!active.length
        ? (
          <EmptyState title="No matching active categories">
            Create a category or clear the search.
          </EmptyState>
        )
        : null}
      <Disclosure title={`Archived categories (${archived.length})`}>
        {archived.length
          ? (
            <List label="Archived categories">
              {archived.map((category) => (
                <ListRow key={category.id}>
                  <Stack gap={2}>
                    <Inline justify="space-between">
                      <Stack gap={1}>
                        <strong>{category.name}</strong>
                        <Text tone="secondary">Archived</Text>
                      </Stack>
                      <IconButton
                        icon={<Pencil size={18} />}
                        aria-label="Edit"
                        variant="quiet"
                        onPress={() =>
                          openEditor({ kind: "edit", record: category })}
                      />
                    </Inline>
                    <div className="local-ui-card-actions--grid">
                      <Button
                        variant="secondary"
                        onPress={() =>
                          send({
                            type: "category.command",
                            command: {
                              type: "restore",
                              categoryId: category.id,
                            },
                          })}
                      >
                        Restore
                      </Button>
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

  return isEmbedded ? listContent : (
    <ContentContainer>
      {listContent}
    </ContentContainer>
  );
}

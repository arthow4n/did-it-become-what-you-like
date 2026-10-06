import { useEffect, useState } from "react";
import type { LocalRepository } from "../../adapters/local/index.ts";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../../domain/organization.ts";
import {
  Badge,
  Button,
  ContentContainer,
  EmptyState,
  Heading,
  Inline,
  List,
  ListRow,
  PageHeader,
  SegmentedControl,
  Stack,
  Text,
} from "../../design-system/index.ts";
import { type LocalUiPath } from "./types.ts";
import { ProjectManager } from "./project-manager.tsx";
import { CategoryManager } from "./category-manager.tsx";

export type OrganizeScreenProps = {
  state: ProjectCategoryState;
  service?: ProjectCategoryService;
  repository?: LocalRepository;
  initialSection?: "projects" | "categories";
  projectEditorOpen?: boolean;
  categoryEditorOpen?: boolean;
  onStateChange?: (state: ProjectCategoryState) => void;
  onNavigate?: (path: LocalUiPath) => void;
  onDirtyChange?: (dirty: boolean) => void;
  discardRequest?: number;
  onDirtyDiscarded?: () => void;
  onCompleteProject?: () => void;
  onCompleteCategory?: () => void;
  // Legacy / fallback props
  onProjects?: () => void;
  onCategories?: () => void;
  onNewProject?: () => void;
  onNewCategory?: () => void;
};

function LegacyOrganizeOverview({
  state,
  onProjects,
  onCategories,
  onNewProject,
  onNewCategory,
}: {
  state: ProjectCategoryState;
  onProjects?: () => void;
  onCategories?: () => void;
  onNewProject?: () => void;
  onNewCategory?: () => void;
}) {
  const projects = state.projects.filter((project) => !project.archived);
  const categories = state.categories.filter((category) => !category.archived);
  return (
    <ContentContainer>
      <Stack gap={6}>
        <PageHeader title="Organize" headingLevel={1} />
        <section className="local-ui-management-section" aria-label="Projects">
          <Inline justify="space-between">
            <Heading size="sm">Projects</Heading>
            <Inline>
              <Button variant="quiet" onPress={onProjects}>
                Manage projects
              </Button>
              <Button variant="secondary" onPress={onNewProject}>New</Button>
            </Inline>
          </Inline>
          <List>
            {projects.map((project) => (
              <ListRow
                key={project.id}
                trailing={project.id === state.selectedProjectId
                  ? <Badge tone="positive">Current</Badge>
                  : null}
              >
                <Inline justify="space-between">
                  <strong>{project.name}</strong>
                  <Text tone="secondary">{project.defaultCurrency}</Text>
                </Inline>
              </ListRow>
            ))}
          </List>
          {!projects.length
            ? <EmptyState title="No projects yet">{null}</EmptyState>
            : null}
        </section>
        <section
          className="local-ui-management-section"
          aria-label="Categories"
        >
          <Inline justify="space-between">
            <Heading size="sm">Categories</Heading>
            <Inline>
              <Button variant="quiet" onPress={onCategories}>
                Manage categories
              </Button>
              <Button variant="secondary" onPress={onNewCategory}>New</Button>
            </Inline>
          </Inline>
          <List>
            {categories.map((category) => (
              <ListRow
                key={category.id}
                trailing={category.system ? <Badge>Built-in</Badge> : null}
              >
                <strong>{category.name}</strong>
              </ListRow>
            ))}
          </List>
        </section>
      </Stack>
    </ContentContainer>
  );
}

export function OrganizeScreen({
  state,
  service,
  repository,
  initialSection = "projects",
  projectEditorOpen = false,
  categoryEditorOpen = false,
  onStateChange,
  onNavigate,
  onDirtyChange,
  discardRequest,
  onDirtyDiscarded,
  onCompleteProject,
  onCompleteCategory,
  onProjects,
  onCategories,
  onNewProject,
  onNewCategory,
}: OrganizeScreenProps) {
  if (!service) {
    return (
      <LegacyOrganizeOverview
        state={state}
        onProjects={onProjects}
        onCategories={onCategories}
        onNewProject={onNewProject}
        onNewCategory={onNewCategory}
      />
    );
  }

  const [section, setSection] = useState<"projects" | "categories">(
    initialSection,
  );
  const [isEditing, setIsEditing] = useState(
    projectEditorOpen || categoryEditorOpen,
  );

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

  const handleSectionChange = (val: string) => {
    const nextSection = val as "projects" | "categories";
    setSection(nextSection);
    onNavigate?.(nextSection === "categories" ? "/categories" : "/projects");
  };

  const projectManagerNode = (
    <ProjectManager
      repository={repository}
      service={service}
      state={state}
      initialCreate={projectEditorOpen}
      isEmbedded
      onStateChange={onStateChange ?? (() => undefined)}
      onNavigate={onNavigate ?? (() => undefined)}
      onDirtyChange={onDirtyChange}
      onEditorOpenChange={setIsEditing}
      discardRequest={discardRequest}
      onDirtyDiscarded={onDirtyDiscarded}
      onComplete={onCompleteProject}
    />
  );

  const categoryManagerNode = (
    <CategoryManager
      service={service}
      state={state}
      initialCreate={categoryEditorOpen}
      isEmbedded
      onStateChange={onStateChange ?? (() => undefined)}
      onNavigate={onNavigate ?? (() => undefined)}
      onDirtyChange={onDirtyChange}
      onEditorOpenChange={setIsEditing}
      discardRequest={discardRequest}
      onDirtyDiscarded={onDirtyDiscarded}
      onComplete={onCompleteCategory}
    />
  );

  if (isEditing) {
    return section === "projects" ? projectManagerNode : categoryManagerNode;
  }

  return (
    <ContentContainer>
      <Stack gap={5}>
        <PageHeader title="Organize" headingLevel={1} />
        <SegmentedControl
          label="Organize view"
          options={[
            { id: "projects", label: "Projects" },
            { id: "categories", label: "Categories" },
          ]}
          value={section}
          onChange={handleSectionChange}
          fullWidth
        />
        {section === "projects" ? projectManagerNode : categoryManagerNode}
      </Stack>
    </ContentContainer>
  );
}

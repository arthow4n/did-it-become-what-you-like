import type { ProjectCategoryState } from "../../domain/organization.ts";
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
  Stack,
  Text,
} from "../../design-system/index.ts";

export function OrganizeScreen({
  state,
  onProjects,
  onCategories,
  onNewProject,
  onNewCategory,
}: {
  state: ProjectCategoryState;
  onProjects: () => void;
  onCategories: () => void;
  onNewProject: () => void;
  onNewCategory: () => void;
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

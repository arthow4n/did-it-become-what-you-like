import { ArrowLeft } from "lucide-react";
import {
  Button,
  Card,
  ContentContainer,
  DefinitionList,
  FormActions,
  Heading,
  IconButton,
  InlineNotice,
  LinkButton,
  List,
  ListRow,
  PageHeader,
  Stack,
  Text,
} from "../../design-system/index.ts";
import {
  APP_COMMIT,
  APP_NAME,
  APP_VERSION,
  LICENSE_NAME,
  LICENSE_URL,
  NOTICES_URL,
  SOURCE_URL,
} from "../../app/build-info.ts";
import { type PwaController, usePwaController } from "./pwa-runtime.tsx";

export function updateStatusLabel(controller: PwaController): string {
  switch (controller.status) {
    case "checking":
      return "Checking for updates…";
    case "current":
      return "Up to date";
    case "update-ready":
      return controller.version ? "Update ready" : "Update ready to install";
    case "installing":
      return controller.installKind === "app"
        ? "Installing app…"
        : "Installing update…";
    case "offline":
      return "Update check unavailable offline";
    case "unsupported":
      return "Updates are unavailable in this browser";
    case "error":
      return "Update check failed";
  }
}

export function AboutScreen({
  onClose,
  onPrivacy,
}: {
  readonly onClose: () => void;
  readonly onPrivacy: () => void;
}) {
  const pwa = usePwaController();
  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader
          title="About"
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
          <Stack gap={3}>
            <Heading level={2} size="sm">{APP_NAME}</Heading>
            <DefinitionList
              items={[
                { term: "Version", description: APP_VERSION },
                { term: "Build", description: APP_COMMIT },
                { term: "License", description: LICENSE_NAME },
              ]}
            />
            <InlineNotice tone="info" title="Update status">
              {updateStatusLabel(pwa)}
              {pwa.error ? " " + pwa.error : ""}
              {pwa.status === "offline"
                ? " Reconnect to check for a newer build."
                : null}
            </InlineNotice>
            <FormActions>
              <Button
                pending={pwa.status === "checking"}
                isDisabled={pwa.status === "checking" ||
                  pwa.status === "installing" ||
                  pwa.status === "offline"}
                onPress={pwa.checkForUpdates}
              >
                Check for updates
              </Button>
              {pwa.status === "update-ready"
                ? (
                  <Button onPress={pwa.reloadToUpdate}>
                    Reload to update
                  </Button>
                )
                : null}
            </FormActions>
            {pwa.status === "unsupported"
              ? (
                <Text tone="secondary">
                  This browser can still use supported local features, but it
                  does not provide the service-worker or install capability
                  needed for PWA updates.
                </Text>
              )
              : null}
            {pwa.canInstall
              ? (
                <Button variant="secondary" onPress={pwa.install}>
                  Install app
                </Button>
              )
              : null}
          </Stack>
        </Card>
        <Card as="section">
          <Stack gap={3}>
            <Heading level={2} size="sm">Privacy</Heading>
            <Text>
              Local-first · no analytics, advertising, or unrelated tracking.
            </Text>
            <Button variant="secondary" onPress={onPrivacy}>
              Data and privacy details
            </Button>
          </Stack>
        </Card>
        <List label="About and source" className="settings-pwa-about-links">
          <ListRow>
            <LinkButton href={LICENSE_URL} target="_blank" rel="noreferrer">
              Application license (MIT)
            </LinkButton>
          </ListRow>
          <ListRow>
            <LinkButton href={NOTICES_URL} target="_blank" rel="noreferrer">
              Third-party licenses and notices
            </LinkButton>
          </ListRow>
          <ListRow>
            <LinkButton href={SOURCE_URL} target="_blank" rel="noreferrer">
              View source on GitHub
            </LinkButton>
          </ListRow>
        </List>
      </Stack>
    </ContentContainer>
  );
}

export function UnsupportedBrowserScreen() {
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <PageHeader title="Browser not supported" headingLevel={1} />
        <InlineNotice tone="danger" title="Local storage is unavailable">
          This browser does not provide the IndexedDB and cryptographic features
          needed for local-first expense data. Use a current browser with site
          storage enabled to continue.
        </InlineNotice>
      </Stack>
    </ContentContainer>
  );
}

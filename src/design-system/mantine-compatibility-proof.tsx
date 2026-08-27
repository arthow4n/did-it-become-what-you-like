import {
  Button,
  createTheme,
  FileInput,
  MantineProvider,
  Modal,
  Progress,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import { Dropzone } from "@mantine/dropzone";
import { Notifications, notifications } from "@mantine/notifications";
import { useState } from "react";

export const mantineCompatibilityTheme = createTheme({
  defaultRadius: "sm",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  primaryColor: "cyan",
  respectReducedMotion: true,
});

export function MantineCompatibilityProof() {
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState<string | null>("2026-08-27");
  const [timeValue, setTimeValue] = useState("14:30");
  const [fileValue, setFileValue] = useState<File | null>(null);
  const [dropStatus, setDropStatus] = useState("Waiting for a file");
  const [modalOpened, setModalOpened] = useState(false);

  return (
    <MantineProvider
      defaultColorScheme="dark"
      theme={mantineCompatibilityTheme}
    >
      <Stack maw={480} mx="auto" p="md" gap="md">
        <Text component="h1" size="xl" fw={700}>
          Mantine compatibility proof
        </Text>
        <TextInput
          label="Controlled input"
          value={inputValue}
          onChange={(event) => setInputValue(event.currentTarget.value)}
        />
        <Select
          label="Keyboard select"
          placeholder="Choose a currency"
          data={[
            { value: "sek", label: "Swedish krona" },
            { value: "eur", label: "Euro" },
          ]}
          value={selectValue}
          onChange={setSelectValue}
        />
        <DateInput
          label="Date candidate"
          valueFormat="YYYY-MM-DD"
          value={dateValue}
          onChange={setDateValue}
        />
        <TimeInput
          label="Time candidate"
          value={timeValue}
          onChange={(event) => setTimeValue(event.currentTarget.value)}
        />
        <FileInput
          label="File candidate"
          placeholder={fileValue?.name ?? "Choose a receipt"}
          accept="image/png,image/jpeg"
          capture="environment"
          value={fileValue}
          onChange={setFileValue}
        />
        <Dropzone
          accept={["image/png", "image/jpeg"]}
          multiple={false}
          onDrop={(files) => setDropStatus(`${files.length} file accepted`)}
          onReject={() => setDropStatus("File rejected")}
          inputProps={{
            accept: "image/png,image/jpeg",
            capture: "environment",
            "aria-label": "Dropzone file",
          }}
        >
          <Text>Drop a receipt here or activate the file picker</Text>
          <Text size="sm" c="dimmed">{dropStatus}</Text>
        </Dropzone>
        <Progress value={62} aria-label="Compatibility progress" />
        <Button onClick={() => setModalOpened(true)}>
          Open compatibility modal
        </Button>
        <Button
          variant="light"
          onClick={() =>
            notifications.show({
              id: "mantine-compatibility",
              title: "Notification works",
              message: "The public notifications API rendered successfully.",
              autoClose: false,
            })}
        >
          Show notification
        </Button>
      </Stack>
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Compatibility modal"
        transitionProps={{ duration: 0 }}
      >
        <Button data-autofocus onClick={() => setModalOpened(false)}>
          Close modal
        </Button>
      </Modal>
      <Notifications transitionDuration={0} autoClose={false} />
    </MantineProvider>
  );
}

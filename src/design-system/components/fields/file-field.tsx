import { useId, useState } from "react";
import type { ComponentProps, ReactNode, Ref } from "react";
import { Dropzone as MantineDropzone } from "@mantine/dropzone";
import { useMergedRef } from "@mantine/hooks";
import { Field } from "./field.tsx";
import { dropzoneAcceptFor, emitFileChange } from "./shared.ts";

export type FileFieldProps =
  & Omit<ComponentProps<"input">, "type" | "className">
  & {
    label: ReactNode;
    description?: ReactNode;
    onReject?: (files: File[]) => void;
    inputRef?: Ref<HTMLInputElement>;
    openRef?: Ref<() => void | undefined>;
    className?: string;
  };

export function FileField(
  {
    label,
    description,
    className,
    id,
    ref: publicRef,
    onChange,
    onReject,
    inputRef,
    openRef,
    accept,
    capture,
    multiple,
    disabled,
    ...props
  }: FileFieldProps,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const dropzoneAccept = dropzoneAcceptFor(accept);
  const nativeInputRef = useMergedRef(inputRef, publicRef);
  const [hasRejection, setHasRejection] = useState(false);
  return (
    <Field
      label={label}
      description={description}
      error={hasRejection
        ? <span role="alert">That file type is not accepted.</span>
        : undefined}
      controlId={controlId}
      className={className}
    >
      <MantineDropzone
        openRef={openRef}
        accept={dropzoneAccept}
        multiple={multiple}
        disabled={disabled}
        onDrop={(files) => {
          setHasRejection(false);
          emitFileChange(onChange, files);
        }}
        onReject={(rejections) => {
          setHasRejection(true);
          onReject?.(rejections.map(({ file }) => file as File));
        }}
        className="ds-file-dropzone"
        inputProps={{
          ...props,
          ref: nativeInputRef,
          id: controlId,
          accept,
          capture,
          multiple,
          disabled,
        } as ComponentProps<"input">}
      >
        <MantineDropzone.Accept>
          <span className="ds-dropzone__prompt">
            Release to choose this file
          </span>
        </MantineDropzone.Accept>
        <MantineDropzone.Reject>
          <span className="ds-dropzone__prompt">
            That file type is not accepted
          </span>
        </MantineDropzone.Reject>
        <MantineDropzone.Idle>
          <span className="ds-dropzone__prompt">
            Choose a file or drop it here
          </span>
        </MantineDropzone.Idle>
      </MantineDropzone>
    </Field>
  );
}

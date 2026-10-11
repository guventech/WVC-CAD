/** Minimal File System Access API typings used by web FileStorage. */

interface FilePickerAcceptType {
  readonly description?: string;
  readonly accept: Record<string, readonly string[]>;
}

interface OpenFilePickerOptions {
  readonly multiple?: boolean;
  readonly types?: readonly FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  readonly suggestedName?: string;
  readonly types?: readonly FilePickerAcceptType[];
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  close(): Promise<void>;
}

type FileSystemWriteChunkType = BufferSource | Blob | string;

interface FileSystemCreateWritableOptions {
  readonly keepExistingData?: boolean;
}

interface FileSystemFileHandle {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(
    options?: FileSystemCreateWritableOptions,
  ): Promise<FileSystemWritableFileStream>;
}

interface Window {
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
}

declare const FileSystemFileHandle: {
  prototype: FileSystemFileHandle;
  new (): FileSystemFileHandle;
};

type WorkerMessageUnion<T extends Record<string, object>> = {
  [K in keyof T]: { type: K } & T[K];
}[keyof T];

type WasmGixMessagePayload = {
  LOAD_REPOSITORY: { identifier: string, localFileHandle: FileSystemDirectoryHandle };
  START_INDEXING: { identifier: string };
};

export type WasmGixMessageType = keyof WasmGixMessagePayload;
export type WasmGixWorkerMessage = WorkerMessageUnion<WasmGixMessagePayload>;

type WasmGixWorkerOutboundPayload = {
  INDEXING_COMPLETED: { identifier: string, buffer: Uint8Array };
};

export type WasmGixWorkerOutboundMessage = WorkerMessageUnion<WasmGixWorkerOutboundPayload>;

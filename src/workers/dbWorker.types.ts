type WorkerMessageUnion<T extends Record<string, object>> = {
  [K in keyof T]: { type: K } & T[K];
}[keyof T];

export type DatabaseAccessMode = "READ_ONLY" | "READ_WRITE";

export type DatabaseWorkerInboundPayload = {
  INIT: { repositoryIdentifier: string; accessMode: DatabaseAccessMode };
  QUERY: { sql: string; returnResult?: boolean; requestId?: string };
  TERMINATE: {};
  INDEXER_RESULT: { identifier: string; buffer: Uint8Array };
};

export type DatabaseWorkerOutboundPayload = {
  ERROR: { error: string; requestId?: string };
  RESULT: { result: unknown; requestId: string };
  DISCONNECTED: {};
};

export type DatabaseWorkerInboundMessage =
  WorkerMessageUnion<DatabaseWorkerInboundPayload>;
export type DatabaseWorkerOutboundMessage =
  WorkerMessageUnion<DatabaseWorkerOutboundPayload>;

export type DatabaseWorkerMessage =
  | DatabaseWorkerInboundMessage
  | DatabaseWorkerOutboundMessage;

export type DatabaseWorkerInboundType = keyof DatabaseWorkerInboundPayload;
export type DatabaseWorkerOutboundType = keyof DatabaseWorkerOutboundPayload;

export type DatabaseWorkerMessage =
  | DatabaseQueryMessage
  | DatabaseErrorMessage
  | DatabaseTerminateMessage
  | DatabaseDisconnectedMessage
  | DatabaseResultMessage
  | DatabaseIndexerResultMessage;

export interface DatabaseQueryMessage {
  type: DatabaseMessageType.QUERY;
  sql: string;
  returnResult?: boolean;
  requestId?: string;
}
export interface DatabaseErrorMessage {
  type: DatabaseMessageType.ERROR;
  error: string;
  requestId?: string;
}

export interface DatabaseTerminateMessage {
  type: DatabaseMessageType.TERMINATE;
}

export interface DatabaseResultMessage {
  type: DatabaseMessageType.RESULT;
  result: unknown;
  requestId: string;
}

export interface DatabaseDisconnectedMessage {
  type: DatabaseMessageType.DISCONNECTED;
}

export interface DatabaseIndexerResultMessage {
  type: DatabaseMessageType.INDEXER_RESULT;
  identifier: string;
  buffer: Uint8Array;
}

export enum DatabaseMessageType {
  QUERY,
  TERMINATE,
  ERROR,
  RESULT,
  DISCONNECTED,
  INDEXER_RESULT
}

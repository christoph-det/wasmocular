export type DatabaseWorkerMessage =
  | DatabaseQueryMessage
  | DatabaseErrorMessage
  | DatabaseTerminateMessage
  | DatabaseDisconnectedMessage
  | DatabaseResultMessage;

export interface DatabaseQueryMessage {
  type: DatabaseMessageType.QUERY;
  sql: string;
  returnResult?: boolean;
}
export interface DatabaseErrorMessage {
  type: DatabaseMessageType.ERROR;
  error: string;
}

export interface DatabaseTerminateMessage {
  type: DatabaseMessageType.TERMINATE;
}

export interface DatabaseResultMessage {
  type: DatabaseMessageType.RESULT;
  result: unknown;
}

export interface DatabaseDisconnectedMessage {
  type: DatabaseMessageType.DISCONNECTED;
}

export enum DatabaseMessageType {
  QUERY,
  TERMINATE,
  ERROR,
  RESULT,
  DISCONNECTED
}

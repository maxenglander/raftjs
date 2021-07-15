import {
  IBaseRpcArguments,
  IBaseRpcRequest,
  IBaseRpcResponse,
  IBaseRpcResults
} from '../base';

export interface ILogEntry {
  readonly command: Uint8Array;
  readonly index: number;
  readonly term: number;
}

export interface IAppendEntriesRpcArguments extends IBaseRpcArguments {
  readonly entries: ReadonlyArray<ILogEntry>;
  readonly leaderCommit: number;
  readonly leaderId: string;
  readonly prevLogIndex: number;
  readonly prevLogTerm: number;
}

export type IAppendEntriesRpcExchange =
  | IAppendEntriesRpcRequest
  | IAppendEntriesRpcResponse;

export type IAppendEntriesRpcRequest = IBaseRpcRequest<
  'append-entries',
  IAppendEntriesRpcArguments
>;

export type IAppendEntriesRpcResponse = IBaseRpcResponse<
  'append-entries',
  IAppendEntriesRpcResults
>;

export interface IAppendEntriesRpcResults extends IBaseRpcResults {
  readonly followerCommit: number;
  readonly success: boolean;
}

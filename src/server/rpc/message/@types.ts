import {
  IAppendEntriesRpcRequest,
  IAppendEntriesRpcResponse
} from './append-entries';
import {
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse
} from './request-vote';

export type RpcCallTypeMap = {
  [C in IRpcMessage['callType']]: C;
};

export type IRpcMessage = IRpcRequest | IRpcResponse;

export type IRpcMessageTypeFilter<
  P extends IRpcMessage['procedureType'],
  C extends IRpcMessage['callType']
> = C extends 'request'
  ? IRpcRequestTypeFilter<P>
  : C extends 'response'
  ? IRpcResponseTypeFilter<P>
  : never;

export type RpcProcedureTypeMap = {
  [P in IRpcMessage['procedureType']]: P;
};

export type IRpcRequest = IAppendEntriesRpcRequest | IRequestVoteRpcRequest;

export type IRpcRequestTypeFilter<
  P extends IRpcMessage['procedureType']
> = P extends 'append-entries'
  ? IAppendEntriesRpcRequest
  : P extends 'request-vote'
  ? IRequestVoteRpcRequest
  : never;

export type IRpcResponse = IAppendEntriesRpcResponse | IRequestVoteRpcResponse;

export type IRpcResponseTypeFilter<
  P extends IRpcMessage['procedureType']
> = P extends 'append-entries'
  ? IAppendEntriesRpcResponse
  : P extends 'request-vote'
  ? IRequestVoteRpcResponse
  : never;

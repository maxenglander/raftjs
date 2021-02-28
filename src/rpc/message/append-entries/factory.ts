import {
  IAppendEntriesRpcArguments,
  IAppendEntriesRpcRequest,
  IAppendEntriesRpcResponse,
  IAppendEntriesRpcResults
} from './types';

// Create an AppendEntries RPC request with the provided arguments.
export function createAppendEntriesRpcRequest(
  args: IAppendEntriesRpcArguments
): IAppendEntriesRpcRequest {
  return {
    callType: 'request',
    procedureType: 'append-entries',
    arguments: args
  };
}

// Create an AppendEntries RPC response with the provided results.
export function createAppendEntriesRpcResponse(
  results: IAppendEntriesRpcResults
): IAppendEntriesRpcResponse {
  return {
    callType: 'response',
    procedureType: 'append-entries',
    results
  };
}

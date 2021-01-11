import {
  IRequestVoteRpcArguments,
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse,
  IRequestVoteRpcResults
} from './@types';

// Create a RequestVote RPC request with the provided arguments.
export function createRequestVoteRpcRequest(
  args: IRequestVoteRpcArguments
): IRequestVoteRpcRequest {
  return {
    callType: 'request',
    procedureType: 'request-vote',
    arguments: args
  };
}

// Create a RequestVote RPC response with the provided results.
export function createRequestVoteRpcResponse(
  results: IRequestVoteRpcResults
): IRequestVoteRpcResponse {
  return {
    callType: 'response',
    procedureType: 'request-vote',
    results
  };
}

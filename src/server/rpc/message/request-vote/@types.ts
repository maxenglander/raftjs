import {
  IBaseRpcArguments,
  IBaseRpcRequest,
  IBaseRpcResponse,
  IBaseRpcResults
} from '../base';

export interface IRequestVoteRpcArguments extends IBaseRpcArguments {
  readonly candidateId: string;
  readonly lastLogIndex: number;
  readonly lastLogTerm: number;
}

export type IRequestVoteRpcExchange =
  | IRequestVoteRpcRequest
  | IRequestVoteRpcResponse;

export type IRequestVoteRpcRequest = IBaseRpcRequest<
  'request-vote',
  IRequestVoteRpcArguments
>;

export type IRequestVoteRpcResponse = IBaseRpcResponse<
  'request-vote',
  IRequestVoteRpcResults
>;

export interface IRequestVoteRpcResults extends IBaseRpcResults {
  readonly voteGranted: boolean;
}

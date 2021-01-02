import * as Base from './base';

export interface IRpcArguments extends Base.IRpcArguments {
    readonly candidateId: string;
    readonly lastLogIndex: number;
    readonly lastLogTerm: number;
}

export type IRpcExchange = IRpcRequest | IRpcResponse;

export type IRpcRequest  = Base.IRpcRequest<'request-vote', IRpcArguments>;

export type IRpcResponse = Base.IRpcResponse<'request-vote', IRpcResults>;

export interface IRpcResults extends Base.IRpcResults {
    readonly voteGranted: boolean;
}

// Create a RequestVote RPC request with the provided arguments.
export function createRpcRequest(args: IRpcArguments): IRpcRequest {
    return {
        callType: 'request',
        procedureType: 'request-vote',
        arguments: args 
    };
}

// Create a RequestVote RPC response with the provided results.
export function createRpcResponse(results: IRpcResults): IRpcResponse {
    return {
        callType: 'response',
        procedureType: 'request-vote',
        results
    };
}

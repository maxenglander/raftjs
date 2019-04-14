import * as Base from './base';

export interface IArguments extends Base.IArguments {
    readonly candidateId: string;
    readonly lastLogIndex: number;
    readonly lastLogTerm: number;
}

export type IExchange = IRequest | IResponse;

export type IRequest  = Base.IRequest<'request-vote', IArguments>;

export type IResponse = Base.IResponse<'request-vote', IResults>;

export interface IResults extends Base.IResults {
    readonly voteGranted: boolean;
}

// Create a RequestVote RPC request with the provided arguments.
export function createRequest(args: IArguments): IRequest {
    return {
        callType: 'request',
        procedureType: 'request-vote',
        arguments: args 
    };
}

// Create a RequestVote RPC response with the provided results.
export function createResponse(results: IResults): IResponse {
    return {
        callType: 'response',
        procedureType: 'request-vote',
        results
    };
}

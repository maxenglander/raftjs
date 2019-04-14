import * as Base from './base';

export interface IArguments extends Base.IArguments {
    readonly entries: ReadonlyArray<string>;
}

export type IExchange = IRequest | IResponse;

export type IRequest = Base.IRequest<'append-entries', IArguments>;

export type IResponse = Base.IResponse<'append-entries', IResults>;

export interface IResults extends Base.IResults{
    readonly success: boolean;
}

// Create an AppendEntries RPC request with the provided arguments.
export function createRequest(args: IArguments): IRequest {
    return {
        callType: 'request',
        procedureType: 'append-entries',
        arguments: args 
    };
}

// Create an AppendEntries RPC response with the provided results.
export function createResponse(results: IResults): IResponse {
    return {
        callType: 'response',
        procedureType: 'append-entries',
        results
    };
}

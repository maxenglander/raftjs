import * as Base from './base';

export interface ILogEntry {
    readonly command: Uint8Array;
    readonly index: number;
    readonly term: number;
}

export interface IRpcArguments extends Base.IRpcArguments {
    readonly entries: ReadonlyArray<ILogEntry>;
    readonly leaderCommit: number;
    readonly leaderId: string;
    readonly prevLogIndex: number;
    readonly prevLogTerm: number;
    readonly term: number;
}

export type IRpcExchange = IRpcRequest | IRpcResponse;

export type IRpcRequest = Base.IRpcRequest<'append-entries', IRpcArguments>;

export type IRpcResponse = Base.IRpcResponse<'append-entries', IRpcResults>;

export interface IRpcResults extends Base.IRpcResults{
    readonly success: boolean;
}

// Create an AppendEntries RPC request with the provided arguments.
export function createRpcRequest(args: IRpcArguments): IRpcRequest {
    return {
        callType: 'request',
        procedureType: 'append-entries',
        arguments: args 
    };
}

// Create an AppendEntries RPC response with the provided results.
export function createRpcResponse(results: IRpcResults): IRpcResponse {
    return {
        callType: 'response',
        procedureType: 'append-entries',
        results
    };
}

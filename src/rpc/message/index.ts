import * as AppendEntries_ from './append-entries';
import * as RequestVote_ from './request-vote';

export { AppendEntries_ as AppendEntries };
export { RequestVote_ as RequestVote };

export type RpcCallTypeMap = { 
    [C in IRpcMessage['callType']]: C
}

export type IRpcMessage = IRpcRequest | IRpcResponse;

export type IRpcMessageTypeFilter<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']> =
    C extends 'request' ? IRpcRequestTypeFilter<P> :
    C extends 'response' ? IRpcResponseTypeFilter<P> :
    never;

export type RpcProcedureTypeMap = {
    [P in IRpcMessage['procedureType']]: P
}

export type IRpcRequest = AppendEntries_.IRpcRequest | RequestVote_.IRpcRequest;

export type IRpcRequestTypeFilter<P extends IRpcMessage['procedureType']> =
    P extends 'append-entries' ? AppendEntries_.IRpcRequest :
    P extends 'request-vote' ? RequestVote_.IRpcRequest :
    never;

export type IRpcResponse = AppendEntries_.IRpcResponse | RequestVote_.IRpcResponse;

export type IRpcResponseTypeFilter<P extends IRpcMessage['procedureType']> =
    P extends 'append-entries' ? AppendEntries_.IRpcResponse :
    P extends 'request-vote' ? RequestVote_.IRpcResponse :
    never;

// Verify that the value is an RPC message. This utility
// is mainly used by TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isRpcMessage(message: any): message is IRpcMessage {
    return !!message
        && message.callType
        && typeof message.callType == 'string'
        && message.procedureType
        && typeof message.procedureType == 'string';
}

// Verify that the value is an RPC request. This utility
// is mainly used by TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isRpcRequest<P extends IRpcMessage['procedureType']>(
    message: IRpcMessageTypeFilter<RpcProcedureTypeMap[P], any>
): message is IRpcRequestTypeFilter<RpcProcedureTypeMap[P]> {
    return isRpcMessage(message) && message.callType === 'request';
}

// Verify that the value is an RPC response. This utility
// is mainly used by TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isRpcResponse<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
    message: IRpcMessageTypeFilter<RpcProcedureTypeMap[P], any>
): message is IRpcResponseTypeFilter<RpcProcedureTypeMap[P]> {
    return isRpcMessage(message) && message.callType === 'response';
}

import { IRpcMessage, IRpcMessageTypeFilter, IRpcRequestTypeFilter, IRpcResponseTypeFilter, RpcProcedureTypeMap } from './@types';

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

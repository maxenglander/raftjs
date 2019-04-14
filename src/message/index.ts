import * as AppendEntries_ from './append-entries';
import * as RequestVote_ from './request-vote';

export { AppendEntries_ as AppendEntries };
export { RequestVote_ as RequestVote };

export type CallTypeMap = { 
    [C in IMessage['callType']]: C
}

export type IMessage = IRequest | IResponse;

export type IMessageTypeFilter<P extends IMessage['procedureType'], C extends IMessage['callType']> =
    C extends 'request' ? IRequestTypeFilter<P> :
    C extends 'response' ? IResponseTypeFilter<P> :
    never;

export type ProcedureTypeMap = {
    [P in IMessage['procedureType']]: P
}

export type IRequest = AppendEntries_.IRequest | RequestVote_.IRequest;

export type IRequestTypeFilter<P extends IMessage['procedureType']> =
    P extends 'append-entries' ? AppendEntries_.IRequest :
    P extends 'request-vote' ? RequestVote_.IRequest :
    never;

export type IResponse = AppendEntries_.IResponse | RequestVote_.IResponse;

export type IResponseTypeFilter<P extends IMessage['procedureType']> =
    P extends 'append-entries' ? AppendEntries_.IResponse :
    P extends 'request-vote' ? RequestVote_.IResponse :
    never;

// Verify that the value is an RPC message. This utility
// is mainly used by TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isMessage(message: any): message is IMessage {
    return !!message
        && message.callType
        && typeof message.callType == 'string'
        && message.procedureType
        && typeof message.procedureType == 'string';
}

// Verify that the value is an RPC request. This utility
// is mainly used by TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isRequest<P extends IMessage['procedureType']>(
    message: IMessageTypeFilter<ProcedureTypeMap[P], any>
): message is IRequestTypeFilter<ProcedureTypeMap[P]> {
    return isMessage(message) && message.callType === 'request';
}

// Verify that the value is an RPC response. This utility
// is mainly used by TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isResponse<P extends IMessage['procedureType'], C extends IMessage['callType']>(
    message: IMessageTypeFilter<ProcedureTypeMap[P], any>
): message is IResponseTypeFilter<ProcedureTypeMap[P]> {
    return isMessage(message) && message.callType === 'response';
}

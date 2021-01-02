export interface IRpcArguments {
    readonly term: number;
}

export type IRpcExchange<P, A extends IRpcArguments, R extends IRpcResults> = IRpcRequest<P, A> | IRpcResponse<P, R>;

interface IRpcMessage<P, C, A extends IRpcArguments, R extends IRpcResults> {
    readonly arguments?: A;
    readonly callType: C;
    readonly procedureType: P;
    readonly results?: R;
}

export type IRpcRequest<P, A extends IRpcResults> = IRpcMessage<P, 'request', A, null>;

export type IRpcResponse<P, R extends IRpcResults> = IRpcMessage<P, 'response', null, R>;

export interface IRpcResults {
    readonly term: number;
}

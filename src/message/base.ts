export interface IArguments {
    readonly term: number;
}

export type IExchange<P, A extends IArguments, R extends IResults> = IRequest<P, A> | IResponse<P, R>;

interface IMessage<P, C, A extends IArguments, R extends IResults> {
    readonly arguments?: A;
    readonly callType: C;
    readonly procedureType: P;
    readonly results?: R;
}

export type IRequest<P, A extends IResults> = IMessage<P, 'request', A, null>;

export type IResponse<P, R extends IResults> = IMessage<P, 'response', null, R>;

export interface IResults {
    readonly term: number;
}

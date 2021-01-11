export interface IBaseRpcArguments {
  readonly term: number;
}

export type IBaseRpcExchange<
  P,
  A extends IBaseRpcArguments,
  R extends IBaseRpcResults
> = IBaseRpcRequest<P, A> | IBaseRpcResponse<P, R>;

interface IBaseRpcMessage<
  P,
  C,
  A extends IBaseRpcArguments,
  R extends IBaseRpcResults
> {
  readonly arguments?: A;
  readonly callType: C;
  readonly procedureType: P;
  readonly results?: R;
}

export type IBaseRpcRequest<P, A extends IBaseRpcResults> = IBaseRpcMessage<
  P,
  'request',
  A,
  null
>;

export type IBaseRpcResponse<P, R extends IBaseRpcResults> = IBaseRpcMessage<
  P,
  'response',
  null,
  R
>;

export interface IBaseRpcResults {
  readonly term: number;
}

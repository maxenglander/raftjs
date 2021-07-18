import { IDetacher } from '../util/types';
import { ICodec } from './codec';
import { IEndpoint } from '../net/endpoint';
import { IRpcMessage } from './message';
import { ITransport } from '../transport';

export interface IRpcServiceOptions {
  readonly codec?: ICodec;
  readonly transport?: ITransport;
}

export type RpcBeforeSendHook = (endpoint: IEndpoint, message: IRpcMessage) => Promise<void>;

export type RpcReceiver = (endpoint: IEndpoint, message: IRpcMessage) => any;

export interface IRpcService {
  close(): Promise<void>;
  listen(endpoint: IEndpoint): Promise<void>;
  onReceive(receiver: RpcReceiver): IDetacher;
  send(
    endpoint: IEndpoint,
    message: IRpcMessage
  ): Promise<void>;
}

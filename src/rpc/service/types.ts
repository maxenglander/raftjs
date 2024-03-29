import { IDetacher } from '../../util/types';
import { ICodec } from '../codec';
import { IEndpoint, ITransport } from '../../net';
import { IRpcMessage } from '../message';

export interface IRpcServiceOptions {
  readonly codec?: ICodec;
  readonly transport?: ITransport;
}

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

import { IDetacher } from '../util/@types';
import { ICodec } from './codec';
import { IEndpoint } from '../net/endpoint';
import { IRpcMessage } from './message';
import { ITransport } from '../transport';

export interface IRpcServiceOptions {
  readonly codec?: ICodec;
  readonly transport?: ITransport;
}

export interface IRpcEventListener {
  detach(): void;
}

export type RpcReceiver = (endpoint: IEndpoint, message: IRpcMessage) => void;

export interface IRpcService {
  close(): Promise<void>;
  listen(endpoint: IEndpoint): Promise<void>;
  onReceive(receiver: RpcReceiver): IDetacher;
  send(
    endpoints: ReadonlyArray<IEndpoint>,
    message: IRpcMessage
  ): Promise<void>[];
}

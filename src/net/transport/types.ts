import { IEndpoint } from '../endpoint';

export type IReceiver = (endpoint: IEndpoint, data: Uint8Array) => void;

export interface ITransport {
  close: () => Promise<void>;
  listen: (endpoint: IEndpoint) => Promise<void>;
  onReceive: (receiver: IReceiver) => void;
  send: (endpoint: IEndpoint, data: Uint8Array) => Promise<void>;
}

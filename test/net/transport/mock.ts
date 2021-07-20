import { IEndpoint } from '../endpoint';
import { IReceiver, ITransport } from './';

export function createMockTransport(options: {
  close?: () => Promise<void>;
  listen?: (endpoint: IEndpoint) => Promise<void>;
  onReceive?: (receiver: IReceiver) => void;
  send?: (endpoint: IEndpoint, data: Uint8Array) => Promise<void>;
}): ITransport {
  const close: () => Promise<void> = options.close
      ? options.close
      : function(): Promise<void> {
          throw new Error('Not implemented');
        },
    listen = options.listen
      ? options.listen
      : function(): Promise<void> {
          throw new Error('Not implemented');
        },
    onReceive = options.onReceive
      ? options.onReceive
      : function(): void {
          throw new Error('Not implemented');
        },
    send = options.send
      ? options.send
      : function(): Promise<void> {
          throw new Error('Not implemented');
        };

  return {
    close,
    listen,
    onReceive,
    send
  };
}

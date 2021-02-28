import { ICodec } from './codec';
import { IDetacher } from '../util/types';
import { IEndpoint } from '../net/endpoint';
import { IRpcMessage } from './message';
import {
  IRpcService,
  IRpcServiceOptions,
  RpcBeforeSendHook,
  RpcReceiver
} from './types';
import { ITransport } from '../transport';

// Encodes, sends, decodes and receives RPC messages.
export class RpcService implements IRpcService {
  private beforeSendHooks: Set<RpcBeforeSendHook>;
  private codec: ICodec;
  private receivers: Set<RpcReceiver>;
  private transport: ITransport;

  constructor(options: IRpcServiceOptions = {}) {
    this.beforeSendHooks = new Set<RpcBeforeSendHook>();
    this.codec = options.codec;
    this.receivers = new Set<RpcReceiver>();
    this.transport = options.transport;

    // When data is received from the underlying transport,
    // decode the data to an RPC message and notify any
    // receivers of the message.
    this.transport.onReceive((endpoint: IEndpoint, data: Uint8Array) => {
      this.notifyReceivers(endpoint, this.codec.decode(data));
    });
  }

  public close(): Promise<void> {
    return this.transport.close();
  }

  public listen(endpoint: IEndpoint): Promise<void> {
    return this.transport.listen(endpoint);
  }

  private notifyReceivers(
    endpoint: IEndpoint,
    message: IRpcMessage
  ): void {
    for (const receiver of this.receivers) {
      receiver(endpoint, message);
    }
  }

  // Register a hook to be invoked before a message is sent.
  public onBeforeSend(hook: RpcBeforeSendHook): IDetacher {
    this.beforeSendHooks.add(hook);
    return {
      detach: (): void => {
        this.beforeSendHooks.delete(hook);
      }
    };
  }

  // Register a receiver for messages of any procedure and call type.
  public onReceive(receiver: RpcReceiver): IDetacher {
    this.receivers.add(receiver);
    return {
      detach: (): void => {
        this.receivers.delete(receiver);
      }
    };
  }

  // Send a message to an endpoint.
  public async send(
    endpoint: IEndpoint,
    message: IRpcMessage
  ): Promise<void> {
    for (const hook of this.beforeSendHooks) {
      await hook(endpoint, message);
    }
    const encoded = this.codec.encode(message);
    return await this.transport.send(endpoint, encoded);
  }
}

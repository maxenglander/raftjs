import {
  RpcCallTypeMap,
  IRpcMessage,
  IRpcMessageTypeFilter,
  RpcProcedureTypeMap
} from './message';
import { ICodec } from './codec';
import { IEndpoint } from '../../net/endpoint';
import {
  IRpcReceiverRegistry,
  createRpcReceiverRegistry
} from './receiver-registry';
import {
  IRpcEventListener,
  IRpcReceiver,
  IRpcService,
  IRpcServiceOptions
} from './@types';
import { ITransport } from '../../transport';

// Encodes, sends, decodes and receives RPC messages.
export class RpcService implements IRpcService {
  private codec: ICodec;
  private receivers: IRpcReceiverRegistry;
  private transport: ITransport;

  constructor(options: IRpcServiceOptions = {}) {
    this.codec = options.codec;
    this.receivers = createRpcReceiverRegistry();
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

  private notifyReceivers<
    P extends IRpcMessage['procedureType'],
    C extends IRpcMessage['callType']
  >(
    endpoint: IEndpoint,
    message: IRpcMessageTypeFilter<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
  ): void {
    for (const receiver of this.receivers.getAll(
      message.procedureType,
      message.callType
    )) {
      receiver.notify(endpoint, message);
    }
  }

  // Register to receiver messages of a particular procedure and call type,
  // e.g. `onReceive('append-entries', 'request', {...})`.
  public onReceive<
    P extends IRpcMessage['procedureType'],
    C extends IRpcMessage['callType']
  >(
    receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
  ): IRpcEventListener {
    this.receivers.add(receiver);
    return {
      detach: (): void => {
        this.receivers.remove(receiver);
      }
    };
  }

  // Send a message to all endpoints in parallel.
  public send(
    endpoints: ReadonlyArray<IEndpoint>,
    message: IRpcMessage
  ): Promise<void>[] {
    const encoded = this.codec.encode(message);
    return endpoints.map((endpoint: IEndpoint) => {
      return new Promise(resolve => {
        this.transport.send(endpoint, encoded).then(
          () => resolve(),
          () => resolve()
        );
      });
    });
  }
}

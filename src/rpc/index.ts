import {
    RpcCallTypeMap,
    IRpcMessage,
    IRpcMessageTypeFilter,
    RpcProcedureTypeMap,
    IRpcRequest,
    IRpcRequestTypeFilter,
    IRpcResponseTypeFilter,
    isRpcRequest,
    isRpcResponse
} from './message';
import { ICodec } from './message/codec';
import { IEndpoint } from '../net';
import { IFailure, ITransport } from '../transport';
import { IRpcReceiverRegistry, createRpcReceiverRegistry } from './receiver-registry';
import { createDefaultCodec, createDefaultTransport } from './defaults';

export interface IRpcServiceOptions {
    readonly codec?: ICodec;
    readonly transport?: ITransport;
}

export interface IRpcEventListener {
    detach(): void;
}

export interface IRpcReceiver<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']> {
    procedureType: RpcProcedureTypeMap[P];
    callType: RpcCallTypeMap[C];
    notify(
        endpoint: IEndpoint,
        message: IRpcMessageTypeFilter<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
    ): void;
}

export interface IRpcService {
    close(): Promise<void>;
    listen(endpoint: IEndpoint): Promise<void>;
    onReceive<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
    ): IRpcEventListener;
    send(endpoints: ReadonlyArray<IEndpoint>, message: IRpcMessage): Promise<void>[];
}

// Encodes, sends, decodes and receives RPC messages.
class RpcService implements IRpcService {
    private codec: ICodec;
    private receivers: IRpcReceiverRegistry;
    private transport: ITransport;

    constructor(options: IRpcServiceOptions = {}) {
        this.codec = options.codec
            ? options.codec
            : createDefaultCodec();
        this.receivers = createRpcReceiverRegistry();
        this.transport = options.transport
            ? options.transport
            : createDefaultTransport();

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

    private notifyReceivers<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        endpoint: IEndpoint,
        message: IRpcMessageTypeFilter<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
    ): void {
        for(let receiver of this.receivers.getAll(message.procedureType, message.callType)) {
            receiver.notify(endpoint, message);
        }
    }

    // Register to receiver messages of a particular procedure and call type,
    // e.g. `onReceive('append-entries', 'request', {...})`.
    public onReceive<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        receiver: IRpcReceiver<RpcProcedureTypeMap[P], RpcCallTypeMap[C]>
    ): IRpcEventListener {
        this.receivers.add(receiver);
        return {
            detach: (): void => {
                this.receivers.remove(receiver);
            } };
    }

    // Send a message to all endpoints in parallel.
    public send(endpoints: ReadonlyArray<IEndpoint>, message: IRpcMessage): Promise<void>[] {
        const encoded = this.codec.encode(message);
        return endpoints.map((endpoint: IEndpoint) => {
            return new Promise((resolve: any) => {
                this.transport.send(endpoint, encoded).then(() => resolve(), () => resolve());
            });
        });
    }
}

export function createRpcService(options: IRpcServiceOptions = {}): IRpcService {
    return new RpcService(options);
}

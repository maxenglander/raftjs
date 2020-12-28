import {
    CallTypeMap,
    IMessage,
    IMessageTypeFilter,
    ProcedureTypeMap,
    IRequest,
    IRequestTypeFilter,
    IResponseTypeFilter,
    isRequest,
    isResponse
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

export interface IRpcReceiver<P extends IMessage['procedureType'], C extends IMessage['callType']> {
    procedureType: ProcedureTypeMap[P];
    callType: CallTypeMap[C];
    notify(
        endpoint: IEndpoint,
        message: IMessageTypeFilter<ProcedureTypeMap[P], CallTypeMap[C]>
    ): void;
}

export interface IRpcService {
    close(): Promise<void>;
    listen(endpoint: IEndpoint): Promise<void>;
    onReceive<P extends IMessage['procedureType'], C extends IMessage['callType']>(
        receiver: IRpcReceiver<ProcedureTypeMap[P], CallTypeMap[C]>
    ): IRpcEventListener;
    send(endpoints: ReadonlyArray<IEndpoint>, message: IMessage): Promise<void[]>;
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
        this.transport.receive({
            data: (function(endpoint: IEndpoint, data: Uint8Array) {
                this.notifyReceivers(endpoint, this.codec.decode(data));
            }).bind(this),
            failure(failure: IFailure): void {}
        });
    }

    public close(): Promise<void> {
        return this.transport.close();
    }

    public listen(endpoint: IEndpoint): Promise<void> {
        return this.transport.listen(endpoint);
    }

    private notifyReceivers<P extends IMessage['procedureType'], C extends IMessage['callType']>(
        endpoint: IEndpoint,
        message: IMessageTypeFilter<ProcedureTypeMap[P], CallTypeMap[C]>
    ): void {
        for(let receiver of this.receivers.getAll(message.procedureType, message.callType)) {
            receiver.notify(endpoint, message);
        }
    }

    // Register to receiver messages of a particular procedure and call type,
    // e.g. `onReceive('append-entries', 'request', {...})`.
    public onReceive<P extends IMessage['procedureType'], C extends IMessage['callType']>(
        receiver: IRpcReceiver<ProcedureTypeMap[P], CallTypeMap[C]>
    ): IRpcEventListener {
        this.receivers.add(receiver);
        return {
            detach: (function(): void {
                this.receivers.remove(receiver);
            }).bind(this)
        };
    }

    // Send a message to all endpoints in parallel.
    public send(endpoints: ReadonlyArray<IEndpoint>, message: IMessage): Promise<void[]> {
        const encoded = this.codec.encode(message);
        return Promise.all(endpoints.map((function(endpoint: IEndpoint) {
            return new Promise((function(resolve: any) {
                this.transport.send(endpoint, encoded).then(() => resolve(), () => resolve());
            }).bind(this));
        }).bind(this)));
    }
}

export function createRpcService(options: IRpcServiceOptions = {}): IRpcService {
    return new RpcService(options);
}

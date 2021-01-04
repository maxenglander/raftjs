import {
    RpcCallTypeMap,
    IRpcMessage,
    IRpcMessageTypeFilter,
    RpcProcedureTypeMap
} from './message';
import { ICodec } from './codec';
import { IEndpoint } from '../../net/endpoint';
import { ITransport } from '../../transport';

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

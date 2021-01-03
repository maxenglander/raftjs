import { IRpcReceiverRegistry, RpcReceiverRegistry } from './receiver-registry';

export function createRpcReceiverRegistry(): IRpcReceiverRegistry {
    return new RpcReceiverRegistry();
}

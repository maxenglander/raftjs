import { IRpcReceiverRegistry } from './@types';
import { RpcReceiverRegistry } from './receiver-registry';

export function createRpcReceiverRegistry(): IRpcReceiverRegistry {
  return new RpcReceiverRegistry();
}

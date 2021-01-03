import { IRpcService, IRpcServiceOptions, RpcService } from './service';

export function createRpcService(options: IRpcServiceOptions = {}): IRpcService {
    return new RpcService(options);
}

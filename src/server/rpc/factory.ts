import { IRpcService, IRpcServiceOptions, RpcService } from './service';
import { createFlatbuffersCodec } from './message/codec';
import { createTcpTransport } from '../../transport';

export function createRpcService(options: IRpcServiceOptions = {}): IRpcService {
    const codec = options.codec ? options.codec : createFlatbuffersCodec();
    const transport = options.transport ? options.transport : createTcpTransport();
    return new RpcService(Object.assign({}, options, { codec, transport }));
}

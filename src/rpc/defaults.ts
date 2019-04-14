import { ICodec, createFlatbuffersCodec } from '../codec';
import { ITransport, createTcpTransport } from '../transport';

// By default, `RpcService` uses
// [FlatBuffers](https://google.github.io/flatbuffers/)
// to encode and decode RPC messages to and from
// binary data.
export function createDefaultCodec(): ICodec {
    return createFlatbuffersCodec();
}

// By default, `RpcService` uses TCP as its
// underlying data transport.
export function createDefaultTransport(): ITransport {
    return createTcpTransport();
}

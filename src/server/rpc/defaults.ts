import { ITransport, createTcpTransport } from '../../transport';
import { ICodec, createFlatbuffersCodec } from './message/codec';

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

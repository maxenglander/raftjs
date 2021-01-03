export { createFlatbuffersCodec } from './flatbuffers';

import { IRpcMessage } from '../message';

export interface ICodec {
    decode(data: Uint8Array): IRpcMessage;
    encode(message: IRpcMessage): Uint8Array;
}

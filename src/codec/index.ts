export { createFlatbuffersCodec } from './flatbuffers';

import { IMessage } from '../message';

export interface ICodec {
    decode(data: Uint8Array): IMessage;
    encode(message: IMessage): Uint8Array;
}

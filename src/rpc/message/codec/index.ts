export { createFlatbuffersCodec } from './flatbuffers';

import { IMessage } from '../';

export interface ICodec {
    decode(data: Uint8Array): IMessage;
    encode(message: IMessage): Uint8Array;
}

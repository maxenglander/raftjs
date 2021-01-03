import { ICodec } from '../';
import { decode, encode } from './flatbuffers';

export function createFlatbuffersCodec(): ICodec {
    return { decode, encode };
}

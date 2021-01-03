import { IDurableValue } from './@types';
import { DurableInteger, DurableString } from './storage';

export function createDurableInteger(path: string): IDurableValue<number> {
    return new DurableInteger(path);
}

export function createDurableString(path: string): IDurableValue<string> {
    return new DurableString(path);
}

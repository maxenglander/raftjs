import { IConnectionRegistry } from './@types';
import { ConnectionRegistry } from './connection-registry';

export function createConnectionRegistry<T>(): IConnectionRegistry<T> {
  return new ConnectionRegistry();
}

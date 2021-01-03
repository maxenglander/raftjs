import { ConnectionRegistry, IConnectionRegistry } from './connection-registry';

export function createConnectionRegistry<T>(): IConnectionRegistry<T> {
    return new ConnectionRegistry();
}

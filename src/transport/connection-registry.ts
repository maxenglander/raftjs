import { IEndpoint, createEndpoint, parseEndpoint } from '../net/endpoint';
import { Callback, NoArgsCallback } from '../util/callback';

export interface IConnectionRegistry<T> {
    count(): number;
    forEach(onEach: (endpoint: IEndpoint, connection: T) => void, onDone?: NoArgsCallback): void;
    get(endpoint: IEndpoint): T;
    getAll(): T[];
    has(endpoint: IEndpoint): boolean;
    remove(endpoint: IEndpoint): void;
    removeEach(onRemove: Callback<T>, onDone?: NoArgsCallback): void;
    save(endpoint: IEndpoint, connection: T): boolean;
}

// A map of endpoint to connections, with methods
// to iterate over or remove all endpoints at once.
export default class ConnectionRegistry<T> implements IConnectionRegistry<T> {
    private connections: { [key: string]: T };
    private numConnections: number;

    constructor() {
        this.connections = {};
        this.numConnections = 0;
    }
    
    public count(): number {
        return this.numConnections;
    }

    public get(endpoint: IEndpoint): T {
        const connectionId = endpoint.toString();
        return this.connections[connectionId];
    }

    // Iterate over each connection, invoking an optional
    // callback when all connectinos have been processed.
    public forEach(onEach: (endpoint: IEndpoint, connection: T) => void, onDone: NoArgsCallback = null): void {
        for(let connectionId in this.connections) {
            const endpoint = parseEndpoint(connectionId),
                connection = this.connections[connectionId];
            onEach(endpoint, connection);
        }

        if(onDone) onDone();
    }

    // Get all registered connections.
    public getAll(): T[] {
        const values = [];
        for(var key in this.connections) {
            values.push(this.connections[key]);
        }
        return values;
    }

    public has(endpoint: IEndpoint): boolean {
        const connectionId = endpoint.toString();
        return connectionId in this.connections;
    }

    public remove(endpoint: IEndpoint) {
        const connectionId = endpoint.toString();
        delete this.connections[connectionId];
    }

    // Remove all connections, invoking an optional callback after
    // all connections have been removed.
    public removeEach(onRemove: Callback<T>, onDone: NoArgsCallback = null): void {
        this.forEach((endpoint: IEndpoint, connection: T) => {
            this.remove(endpoint);
            onRemove(connection);
        }, () => {
            if(onDone) onDone()
        });
    }

    public save(endpoint: IEndpoint, connection: T) {
        if(this.has(endpoint)) return false;
        const connectionId = endpoint.toString();
        this.connections[connectionId] = connection;
        this.numConnections++;
        return true;
    }
}

export function createConnectionRegistry<T>(): IConnectionRegistry<T> {
    return new ConnectionRegistry();
}

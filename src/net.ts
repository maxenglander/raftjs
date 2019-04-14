export interface IEndpoint {
    equals: (endpoint: IEndpoint) => boolean;
    host: string;
    port: number;
    toString: () => string;
}

// A simple wrapper around a `{ host, port }` object,
// with helpful methods for equality comparisons and
// exporting to a string.
class Endpoint implements IEndpoint {
    public host: string;
    public port: number;

    constructor({ host, port }: { host: string, port: number }) {
        this.host = host;
        this.port = port;
    }

    equals(endpoint: IEndpoint) {
        return endpoint.port === this.port && endpoint.host === this.host;
    }

    toString() {
        return `${this.host}:${this.port}`;
    }
}

// Create an `Endpoint` from a `{ host, port }` object.
export function createEndpoint(options: { host: string, port: number }): IEndpoint {
    return new Endpoint(options);
}

// Verify that the provided object is an `Endpoint`. Used by
// TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isEndpoint(endpoint: any): endpoint is IEndpoint {
    return !!endpoint
        && typeof endpoint.host === 'string'
        && typeof endpoint.port === 'number'
        && typeof endpoint.equals === 'function';
}

// Parse the provided string and return an `Endpoint`,
// if valid.
export function parseEndpoint(value: string): IEndpoint {
    const parts: ReadonlyArray<string> = value.split(':');

    if(parts.length != 2)
        throw new Error('Invalid format; requires <host>:<port>');

    const host = parts[0],
        port = parseInt(parts[1]);

    if(isNaN(port) || !Number.isInteger(port))
        throw new Error('Invalid port; must be an integer');

    return createEndpoint({ host, port });
}

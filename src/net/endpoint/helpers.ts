import { IEndpoint } from './endpoint';
import { createEndpoint } from './factory';

// Verify that the provided object is an `Endpoint`. Used by
// TypeScript as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards).
export function isEndpoint(endpoint: any): endpoint is IEndpoint {
    return !!endpoint
        && typeof endpoint.host === 'string'
        && typeof endpoint.port === 'number'
        && typeof endpoint.equals === 'function'
        && typeof endpoint.toString === 'function';
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

import { IEndpoint } from './@types';

// A simple wrapper around a `{ host, port }` object,
// with helpful methods for equality comparisons and
// exporting to a string.
export class Endpoint implements IEndpoint {
    public host: string;
    public port: number;

    constructor({ host, port }: { host: string, port: number }) {
        this.host = host;
        this.port = port;
    }

    equals(endpoint: IEndpoint): boolean {
        return endpoint.port === this.port && endpoint.host === this.host;
    }

    toString(): string {
        return `${this.host}:${this.port}`;
    }
}

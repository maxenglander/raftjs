import { IEndpoint } from '../net';

export interface Redirect {
    server: {
        endpoint: IEndpoint
    }
}

export interface Request {
    command: Uint8Array;
}

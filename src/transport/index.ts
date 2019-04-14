export { createTcpTransport } from './tcp';

import { IEndpoint } from '../net';

export interface IFailure {
    cause: any;
    reason: any;
}

export interface IReceiver {
    data: (endpoint: IEndpoint, data: Uint8Array) => void;
    failure: (failure: IFailure) => void;
}

export interface ITransport {
    close: () => Promise<void>;
    listen: (endpoint: IEndpoint) => Promise<void>;
    receive: (receiver: IReceiver) => void;
    send: (endpoint: IEndpoint, data: Uint8Array) => Promise<void>;
}

import { ITransport } from './';

export function createMockTransport(options): ITransport {
    const close = options.close ? options.close: function(x: never): Promise<void> {
            throw new Error('Not implemented');
        },
        listen = options.listen ? options.listen: function(x: never): Promise<void> {
            throw new Error('Not implemented');
        },
        receive = options.receive ? options.receive: function(x: never): void {
            throw new Error('Not implemented');
        },
        send = options.send ? options.send: function(x: never, y: never): Promise<void> {
            throw new Error('Not implemented');
        };

    return {
        close,
        listen,
        receive,
        send
    };
}

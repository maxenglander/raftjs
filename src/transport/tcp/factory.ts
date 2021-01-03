import { ITransport } from '../';
import { ITcpTransportOptions, TcpTransport } from './tcp';

export function createTcpTransport(options: ITcpTransportOptions = {}): ITransport {
    return new TcpTransport(options);
}

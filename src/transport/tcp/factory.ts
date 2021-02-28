import { ITransport } from '../';
import { ITcpTransportOptions } from './types';
import { TcpTransport } from './tcp';

export function createTcpTransport(
  options: ITcpTransportOptions = {}
): ITransport {
  return new TcpTransport(options);
}

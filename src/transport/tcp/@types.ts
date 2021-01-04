import * as net from 'net';

import { IConnectionRegistry } from '../connection-registry';

export interface ITcpTransportOptions {
  sockets?: IConnectionRegistry<net.Socket>;
}

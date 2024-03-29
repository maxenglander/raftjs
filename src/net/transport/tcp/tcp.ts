import * as net from 'net';

import { IEndpoint, createEndpoint } from '../../endpoint';
import { IReceiver, ITransport } from '../';
import {
  IConnectionRegistry,
  createConnectionRegistry
} from '../connection-registry';
import { ITcpTransportOptions } from './types';

// A TCP transport that can accept and create
// TCP sockets, and tries to re-use sockets
// when possible.
export class TcpTransport implements ITransport {
  private endpoint: IEndpoint = null;
  private receivers: Array<IReceiver>;
  private server: net.Server;
  private sockets: IConnectionRegistry<net.Socket>;

  constructor(options: ITcpTransportOptions) {
    this.endpoint = null;
    this.receivers = [];
    this.server = net.createServer(this.accept.bind(this));
    this.sockets = options.sockets || createConnectionRegistry<net.Socket>();
  }

  // Store a socket that was produced as the
  // result of an incoming or outgoing connection.
  private accept(socket: net.Socket): boolean {
    const endpoint: IEndpoint = createEndpoint({
      host: socket.remoteAddress,
      port: socket.remotePort
    });

    // If the socket has already been accepted,
    // do nothing.
    if (this.sockets.has(endpoint)) return true;

    // Try to store the socket, and set up 'end'
    // and 'data' handlers.
    if (this.sockets.save(endpoint, socket)) {
      socket.on('end', () => {
        socket.destroy();
        this.sockets.remove(endpoint);
      });

      socket.on('data', (data: Uint8Array) => {
        for (const receiver of this.receivers) {
          receiver(endpoint, data);
        }
      });

      return true;
    }

    return false;
  }

  // When closing a transport, close all client connections
  // and stop listening for connections on the transport endpoint.
  public close(): Promise<void> {
    const promise: Promise<void> = new Promise(resolve => {
      const wrappedResolve = () => {
        if (_clientsClosed && _serverClosed) {
          this.endpoint = null;
          resolve();
        }
      };

      let _clientsClosed = false,
        _serverClosed = false;

      this.server.close(function() {
        _serverClosed = true;
        wrappedResolve();
      });

      this.sockets.removeEach(
        function(socket: net.Socket) {
          socket.destroy();
        },
        function() {
          _clientsClosed = true;
          wrappedResolve();
        }
      );
    });

    return promise;
  }

  // Make an outgoing TCP connection to the provided endpoint.
  private connect(endpoint: IEndpoint): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      if (this.sockets.has(endpoint)) {
        resolve(this.sockets.get(endpoint));
      } else {
        const socket = net.createConnection(
          endpoint.port,
          endpoint.host,
          () => {
            if (this.accept(socket)) {
              resolve(socket);
            } else {
              socket.end();
              reject('failed to save socket');
            }
          }
        );

        // Set up a socket error handler to capture
        // errors such as 'connection refused'.
        socket.on('error', function(err) {
          reject(err);
        });
      }
    });
  }

  // Listen for incoming TCP connections on the provided endpoint.
  public listen(endpoint: IEndpoint): Promise<void> {
    if (this.endpoint != null)
      return Promise.reject(
        `TCP transport is already listening on ${endpoint.toString()}`
      );

    this.endpoint = endpoint;

    return new Promise((resolve, reject) => {
      this.server.listen(
        this.endpoint.port,
        this.endpoint.host,
        (err: unknown) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Register a receiver.
  public onReceive(receiver: IReceiver): void {
    this.receivers.push(receiver);
  }

  // Send data to the provided endpoint.
  public async send(endpoint: IEndpoint, data: Uint8Array): Promise<void> {
    const socket = await this.connect(endpoint);
    socket.write(data, null, (err: string) => {
      if (err) {
        throw err;
      }
    });
  }
}

import { EventEmitter } from 'events';
import { TextEncoder } from 'util';
import * as net from 'net';

import { expect } from 'chai';

import { createEndpoint } from '../net/endpoint';
import {
  IConnectionRegistry,
  createConnectionRegistry
} from './connection-registry';
import { createTcpTransport } from './tcp';
import { noop } from '../util';

const encoder = new TextEncoder(),
  data = {
    hello: encoder.encode('hello'),
    goodbye: encoder.encode('goodbye')
  },
  host = '0.0.0.0',
  endpoint0 = createEndpoint({ host, port: 4849 }),
  endpoint1 = createEndpoint({ host, port: 4949 }),
  text = {
    hello: 'hello',
    goodbye: 'goodbye'
  };

describe('tcp transport', function() {
  describe('.createTcpTransport', function() {
    it('creates a tcp transport', function() {
      const transport = createTcpTransport();
      expect(transport).is.not.null;
    });
  });

  describe('a tcp transport', function() {
    describe('#send', function() {
      context(
        'when there is not a server listening at the send destination',
        function() {
          const transport = createTcpTransport();

          describe('the transport', function() {
            it('gets an ECONNREFUSED', function(done) {
              transport.send(endpoint0, data.hello).then(
                function() {
                  done(
                    'expected an ECONNREFUSED but instead sent data was received'
                  );
                },
                function(err) {
                  expect(err.code).to.equal('ECONNREFUSED');
                  done();
                }
              );
            });
          });
        }
      );

      context(
        'when there is a server listening at the send destination',
        function() {
          const transport = createTcpTransport(),
            connections: IConnectionRegistry<net.Socket> = createConnectionRegistry<
              net.Socket
            >(),
            emitter = new EventEmitter(),
            server = net.createServer(function(socket) {
              const endpoint = createEndpoint({
                host: socket.remoteAddress,
                port: socket.remotePort
              });

              connections.save(endpoint, socket);

              socket.on('data', function(data) {
                emitter.emit('data', data);
              });
            });

          after(function(done) {
            this.timeout(10000);

            connections.removeEach(function(socket) {
              socket.end();
            }, noop);

            server.close();
            transport.close().then(done);
          });

          before(function(done) {
            server.listen(endpoint0, done);
          });

          describe('the message', function() {
            it('reaches the remote destination', function(done) {
              emitter.once('data', function(data) {
                expect(data.toString()).to.equal(text.hello);
                done();
              });

              transport.send(endpoint0, data.hello).then(noop, done);
            });
          });
        }
      );

      context(
        'when there is a server listening at two destinations',
        function() {
          const transport = createTcpTransport(),
            connections0 = createConnectionRegistry<net.Socket>(),
            emitter0 = new EventEmitter(),
            server0 = net.createServer(function(socket) {
              const endpoint = createEndpoint({
                host: socket.remoteAddress,
                port: socket.remotePort
              });

              connections0.save(endpoint, socket);

              socket.on('data', function(data) {
                emitter0.emit('data', data);
              });
            }),
            connections1: IConnectionRegistry<net.Socket> = createConnectionRegistry<
              net.Socket
            >(),
            emitter1 = new EventEmitter(),
            server1 = net.createServer(function(socket) {
              const endpoint = createEndpoint({
                host: socket.remoteAddress,
                port: socket.remotePort
              });

              connections1.save(endpoint, socket);

              socket.on('data', function(data) {
                emitter1.emit('data', data);
              });
            });

          after(function(done) {
            this.timeout(10000);

            for (const connections of [connections0, connections1]) {
              connections.removeEach(function(socket) {
                socket.end();
              }, noop);
            }

            for (const server of [server0, server1]) {
              server.close(noop);
            }

            transport.close().then(done);
          });

          before(function(done) {
            const servers = [server0, server1];

            let leftToListen = servers.length;

            function wrappedDone() {
              leftToListen--;
              if (leftToListen == 0) {
                done();
              }
            }

            server0.listen(endpoint0, wrappedDone);
            server1.listen(endpoint1, wrappedDone);
          });

          context('when sent to the first server', function() {
            describe('the message', function() {
              it('reaches the remote destination', function(done) {
                emitter0.once('data', function(data) {
                  expect(data.toString()).to.equal(text.hello);
                  done();
                });

                transport.send(endpoint0, data.hello).then(noop, done);
              });
            });
          });

          context('when sent to the second server', function() {
            describe('the message', function() {
              it('reaches the remote destination', function(done) {
                emitter1.once('data', function(data) {
                  expect(data.toString()).to.equal(text.goodbye);
                  done();
                });

                transport.send(endpoint1, data.goodbye).then(noop, done);
              });
            });
          });
        }
      );
    });

    describe('#listen', function() {
      const transport = createTcpTransport();

      after(function(done) {
        transport.close().then(done);
      });

      before(function(done) {
        transport.listen(endpoint0).then(done);
      });

      it('binds the server instance to the provided host and port', function(done) {
        const anotherServer = net.createServer();

        anotherServer.on('error', function() {
          done();
        });

        anotherServer.listen(endpoint0.port, endpoint0.host, function() {
          done(
            `expected server to be bound to ${endpoint0.host}:${endpoint0.port}`
          );
        });
      });
    });

    describe('#receive', function() {
      context('when two separate sockets have each sent a message', function() {
        const transport = createTcpTransport(),
          sockets = [new net.Socket(), new net.Socket()];

        after(function(done) {
          transport.close();

          let leftToEnd = sockets.length;

          function wrappedDone() {
            leftToEnd--;
            if (leftToEnd == 0) done();
          }

          for (const socket of sockets) socket.end(wrappedDone);
        });

        before(function(done) {
          transport.listen(endpoint0);

          let leftToConnect = sockets.length;

          function wrappedDone() {
            leftToConnect--;
            if (leftToConnect == 0) done();
          }

          for (const socket of sockets)
            socket.connect(endpoint0.port, endpoint0.host, wrappedDone);
        });

        beforeEach(function(done) {
          let leftToWrite = sockets.length;

          function wrappedDone() {
            leftToWrite--;
            if (leftToWrite == 0) done();
          }

          sockets[0].write('hello', wrappedDone);
          sockets[1].write('world', wrappedDone);
        });

        it('returns the messages, in order', function(done) {
          const expectedMessages = ['hello', 'world'];

          let leftToReceive = 2;

          function wrappedDone() {
            leftToReceive--;
            if (leftToReceive == 0) done();
          }

          transport.onReceive((address, data) => {
            expect(data.toString()).to.equal(
              expectedMessages[2 - leftToReceive]
            );
            wrappedDone();
          });
        });
      });
    });
  });
});

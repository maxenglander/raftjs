import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';

import { FollowerState } from './follower';
import {
  IElectionTimer,
  createElectionTimer,
  createElectionTimeoutChooser
} from '../election-timer';
import { createEndpoint } from '../net/endpoint';
import { IServer, createServer } from '../';
import { IState } from './';
import { createAppendEntriesRpcRequest } from '../rpc/message';
import { createRpcService } from '../rpc';

describe('server follower state', function() {
  const MIN_TIMEOUT = 100,
    MAX_TIMEOUT = 500,
    peerEndpoint = createEndpoint({
      host: '0.0.0.0',
      port: 13231
    });

  let electionTimer: IElectionTimer, follower: IState, server: IServer;

  afterEach(function() {
    return server.stop();
  });

  beforeEach(function() {
    electionTimer = createElectionTimer({
      timeoutChooser: createElectionTimeoutChooser({
        interval: [MIN_TIMEOUT, MAX_TIMEOUT]
      })
    });

    server = createServer({
      cluster: {
        servers: {
          server0: createEndpoint({
            host: '0.0.0.0',
            port: 18910
          }),
          server1: peerEndpoint
        }
      },
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
      electionTimer,
      id: 'server0'
    });

    follower = new FollowerState(server);

    return server.start();
  });

  context('after it is entered', function() {
    afterEach(function() {
      server.getState().exit();
    });

    beforeEach(function() {
      server.transitionTo(follower);
    });

    context(
      'if it does not receive any append-entries requests before the election timeout',
      function() {
        it('times out and transitions to a candidate', function(done) {
          this.timeout(electionTimer.getTimeout() + /*buffer*/ 100);

          electionTimer.on('timeout', function() {
            expect(server.getState().type).to.equal('candidate');
            done();
          });
        });
      }
    );

    context(
      'if it receives an append-entries request before the election timeout',
      function() {
        const rpcService = createRpcService();

        let term: number, timeRemaining: number;

        afterEach(function() {
          return rpcService.close();
        });

        beforeEach(function() {
          return rpcService.listen(peerEndpoint);
        });

        context('and the request is valid', function() {
          beforeEach(function(done) {
            const waitABit = Math.random() * MIN_TIMEOUT;
            timeRemaining = electionTimer.getTimeout() - waitABit;
            term = server.getCurrentTerm() + Math.round(Math.random() * 5);

            this.timeout(waitABit + /*buffer*/ 10);

            // Wait a little bit to simulate a partial elapse
            // of the election timer.
            setTimeout(function() {
              rpcService.send(
                [server.endpoint],
                createAppendEntriesRpcRequest({
                  entries: [],
                  leaderCommit: 0,
                  leaderId: 'leader-id',
                  prevLogIndex: 0,
                  prevLogTerm: 0,
                  term
                })
              );
              done();
            }, waitABit);
          });

          it('the election timeout is extended; it does not change state', function(done) {
            this.timeout(electionTimer.getTimeout() + /*buffer*/ 10);

            setTimeout(function() {
              expect(server.getState().type).to.equal('follower');
              done();
            }, timeRemaining);
          });
        });

        context(
          'but the request term is less than the server term',
          function() {
            beforeEach(function(done) {
              const waitABit = Math.random() * MIN_TIMEOUT;
              timeRemaining = electionTimer.getTimeout() - waitABit;
              term =
                server.getCurrentTerm() +
                Math.min(-1, Math.round(Math.random() * -5));

              this.timeout(waitABit + /*buffer*/ 50);

              // Wait a little bit
              setTimeout(function() {
                rpcService.send(
                  [server.endpoint],
                  createAppendEntriesRpcRequest({
                    entries: [],
                    leaderCommit: 0,
                    leaderId: 'leader-id',
                    prevLogIndex: 0,
                    prevLogTerm: 0,
                    term
                  })
                );
                done();
              }, waitABit);
            });

            it('transitions to a candidate', function(done) {
              this.timeout(electionTimer.getTimeout() + /*buffer*/ 100);

              electionTimer.on('timeout', function() {
                expect(server.getState().type).to.equal('candidate');
                done();
              });
            });
          }
        );
      }
    );
  });
});

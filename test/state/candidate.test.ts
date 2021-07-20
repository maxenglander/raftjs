import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';

import {
  IRequestVoteRpcRequest,
  createAppendEntriesRpcRequest,
  createRequestVoteRpcResponse,
  isRequestVoteRpcRequest
} from '../rpc/message';
import { CandidateState } from './candidate';
import {
  IElectionTimer,
  createElectionTimer,
  createElectionTimeoutChooser
} from '../election-timer';
import { IDetacher } from '../util/types';
import { IEndpoint, createEndpoint } from '../net/endpoint';
import { IRpcService, createRpcService } from '../rpc';
import { ServerId } from '../';
import { internalCreateServer } from '../factory';
import { Server } from '../server';
import { IState } from './';

describe('server candidate state', function() {
  const MIN_TIMEOUT = 100,
    MAX_TIMEOUT = 500,
    serverEndpoint: IEndpoint = createEndpoint({
      host: '0.0.0.0',
      port: 31391
    }),
    selfEndpoint: IEndpoint = createEndpoint({
      host: '0.0.0.0',
      port: 18910
    });

  let candidate: IState,
    electionTimer: IElectionTimer,
    rpcService: IRpcService,
    server: Server;

  afterEach(function() {
    return Promise.all([rpcService.close(), server.stop()]);
  });

  beforeEach(function() {
    electionTimer = createElectionTimer({
      timeoutChooser: createElectionTimeoutChooser({
        interval: [MIN_TIMEOUT, MAX_TIMEOUT]
      })
    });

    server = internalCreateServer({
      cluster: {
        servers: {
          server0: selfEndpoint,
          server1: serverEndpoint
        }
      },
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
      electionTimer,
      id: 'server0'
    });

    candidate = new CandidateState(server);

    rpcService = createRpcService();

    return Promise.all([
      // Set server term to greater than 10 so request
      // terms can be less than 10 but greater than zero.
      server.start().then(() => server.setCurrentTerm(10)),
      rpcService.listen(serverEndpoint)
    ]);
  });

  describe('#execute', function() {
    it('always returns an "interregnum" error', function(done) {
      server.execute({
        command: new Uint8Array(0)
      }).then(response => {
        expect(response).to.have.property('error');
        if('error' in response) {
          expect(response.error).to.equal('interregnum');
	}
        done();
      });
    });
  });

  context('after it is entered', function() {
    function waitForRequestVoteRequest(callback) {
      requestVoteRequestCallback = callback;
      if (requestVoteRequest != null)
        requestVoteRequestCallback(requestVoteRequest);
    }

    let initialTerm: number,
      initialVote: ServerId,
      requestVoteRequest,
      requestVoteRequestCallback;

    afterEach(function() {
      server.getState().exit();
    });

    beforeEach(function() {
      rpcService.onReceive((endpoint, message) => {
        if(isRequestVoteRpcRequest(message)) {
          requestVoteRequest = message;
          if (requestVoteRequestCallback)
            requestVoteRequestCallback(requestVoteRequest);
        }
      });

      initialTerm = server.getCurrentTerm();
      initialVote = server.getVotedFor();

      server.transitionTo(candidate);
    });

    it('increments the term', function() {
      /* Wait for new term to persist to disk*/
      setTimeout(function() {
        expect(server.getCurrentTerm()).to.equal(initialTerm + 1);
      }, 50);
    });

    it('requests votes from its servers', function(done) {
      let calledDone = false;

      function doneOnce() {
        if (calledDone == true) return;
        calledDone = true;
        done();
      }

      waitForRequestVoteRequest(function() {
        doneOnce();
      });
    });

    it('votes for itself', function(done) {
      // Wait for vote to be stored to disk
      setTimeout(function() {
        expect(server.getVotedFor()).not.to.equal(initialVote);
        expect(server.getVotedFor()).to.equal(server.id);
        done();
      }, /*buffer*/ 10);
    });

    context('if it receives an append-entries request', function() {
      let randomWait: number;

      beforeEach(function(done) {
        randomWait = Math.random() * 5000;

        this.timeout(randomWait + /*buffer*/ 100);

        setTimeout(function() {
          rpcService.send(
            server.endpoint,
            createAppendEntriesRpcRequest({
              entries: [],
              leaderCommit: 0,
              leaderId: 'leader-id',
              prevLogIndex: 0,
              prevLogTerm: 0,
              term: server.getCurrentTerm()
            })
          ).then(() => done());
        }, randomWait);
      });

      it('transitions to a follower', function(done) {
        setTimeout(function() {
          expect(server.getState().getType()).to.equal('follower');
          done();
        }, /*allow time for candidate to process request*/ 10);
      });
    });

    context(
      'if it receives request-vote responses before the election timeout',
      function() {
        let requestVoteListenerDetacher: IDetacher;

        afterEach(function() {
          requestVoteListenerDetacher.detach();
        });

        context(
          'with a majority of the cluster granting the request',
          function() {
            beforeEach(function(done) {
              let calledDone = false;

              function doneOnce() {
                if (calledDone) return;
                calledDone = true;
                done();
              }

              requestVoteListenerDetacher = rpcService.onReceive((endpoint, message) => {
                if(isRequestVoteRpcRequest(message)) { 
                  const term =
                    message.arguments.term +
                    Math.min(0, Math.round(Math.random() * -5));
                  rpcService.send(
                    endpoint,
                    createRequestVoteRpcResponse({ voteGranted: true, term })
                  ).then(() => doneOnce());
                }
              });
            });

            it('transitions to a leader', function(done) {
              setTimeout(function() {
                expect(server.getState().getType()).to.equal('leader');
                done();
              }, /*allow candidate processing time*/ 20);
            });
          }
        );

        context(
          'without a majority of the cluster granting the request',
          function() {
            beforeEach(function(done) {
              let calledDone = false;

              function doneOnce() {
                if (calledDone) return;
                calledDone = true;
                done();
              }

              requestVoteListenerDetacher = rpcService.onReceive((endpoint, message) => {
                if(isRequestVoteRpcRequest(message)) {
                  const term =
                    message.arguments.term +
                    Math.min(0, Math.round(Math.random() * -5));
                  rpcService.send(
                    endpoint,
                    createRequestVoteRpcResponse({ voteGranted: false, term })
                  );
                  doneOnce();
                }
              });
            });

            it('restarts the election timer and does not transition state', function(done) {
              electionTimer.on('reset', function() {
                expect(server.getState().getType()).to.equal('candidate');
                done();
              });
            });
          }
        );
      }
    );
  });
});

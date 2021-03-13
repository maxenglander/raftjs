import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';
import sinon from 'sinon';

import {
  IAppendEntriesRpcResponse,
  createAppendEntriesRpcRequest,
  createAppendEntriesRpcResponse,
  createRequestVoteRpcRequest,
  createRequestVoteRpcResponse,
  getRpcMessageTerm
} from './rpc/message';
import { IElectionTimer, createElectionTimer } from './election-timer';
import { IEndpoint, createEndpoint } from './net/endpoint';
import { IRpcMessage, createRpcService } from './rpc';
import { IServer, createServer } from './'
import { StateType } from './state'
import { compilerError } from './util/compiler-error';

describe('server', function() {
  function copyMessageWithTerm(message: IRpcMessage, term: number): IRpcMessage {
    const callType = message.callType;
    switch(callType) {
      case 'request':
        return Object.assign({}, message, {
          arguments: Object.assign({}, message.arguments, {
            term
          })
        });
      case 'response':
        return Object.assign({}, message, {
          results: Object.assign({}, message.arguments, {
            term
          })
        });
      default:
        compilerError(callType);
    }
  }

  const INITIAL_TERM = 20,
    MIN_TIMEOUT = 100,
    MAX_TIMEOUT = 500;

  const serverEndpoint: IEndpoint = createEndpoint({
    host: '0.0.0.0',
    port: 13231
  });

  let server: IServer;

  afterEach(function() {
    return server.stop();
  });

  beforeEach(function() {
    server = createServer({
      cluster: {
        servers: {
          server1: createEndpoint({
            host: '0.0.0.0',
            port: 18910
          }),
          server2: serverEndpoint
        }
      },
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
      electionTimer: {
        getTimeout: sinon.stub(),
        off: sinon.stub(),
        on: sinon.stub(),
        reset: sinon.stub(),
        start: sinon.stub(),
        stop: sinon.stub()
      },
      id: 'server1'
    });

    return server.start().then(() => server.setCurrentTerm(INITIAL_TERM));
  });

  const messages: IRpcMessage[] = [
    createAppendEntriesRpcRequest({
      entries: [],
      leaderCommit: 0,
      leaderId: 'leader-id',
      prevLogIndex: 0,
      prevLogTerm: 0,
      term: INITIAL_TERM
    }),
    createAppendEntriesRpcResponse({
      success: true,
      term: INITIAL_TERM
    }),
    createRequestVoteRpcRequest({
      candidateId: 'server4',
      lastLogIndex: 0,
      lastLogTerm: 0,
      term: INITIAL_TERM
    }),
    createRequestVoteRpcResponse({
      term: INITIAL_TERM,
      voteGranted: false
    })
  ];

  const stateTypes: StateType[] = ['candidate', 'leader'];

  for(const message of messages) {
    for(const stateType of stateTypes) {
      context(`if the server is a ${stateType}`, function() {
        beforeEach(function() {
          server.transitionTo(stateType);
        });

        context(`and it receives a ${message.procedureType} ${message.callType} message with a term greater than its own`, function() {
          const rpcService = createRpcService();
  
          afterEach(function() {
            return rpcService.close();
          });
  
          beforeEach(function() {
            return rpcService.listen(serverEndpoint).then(() => {
              return rpcService.send(
                server.endpoint,
                copyMessageWithTerm(message, server.getCurrentTerm() + Math.max(1, Math.random() * 10))
              );
            });
          });

          it('transitions to a follower', function(done) {
            setTimeout(function() {
              expect(server.getState().getType()).to.equal('follower');
              done();
            }, 100/*wait a bit*/);
          });
        });

        context(`and it receives a ${message.procedureType} ${message.callType} message with a term less than or equal to its own`, function() {
          const rpcService = createRpcService();
  
          afterEach(function() {
            return rpcService.close();
          });
  
          beforeEach(function() {
            return rpcService.listen(serverEndpoint).then(() => {
              return rpcService.send(
                server.endpoint,
                copyMessageWithTerm(message, server.getCurrentTerm() - (Math.random() * 10))
              );
            });
          });

          it(`remains in ${stateType} state`, function(done) {
            setTimeout(function() {
              expect(server.getState().getType()).to.equal(stateType);
              done();
            }, 100/*wait a bit*/);
          });
        });
      });
    }
  }
});

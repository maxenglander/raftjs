import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';
import sinon from 'sinon';
import * as tsSinon from 'ts-sinon';
import tmp from 'tmp';

import {
  IAppendEntriesRpcResponse,
  createAppendEntriesRpcRequest,
  createAppendEntriesRpcResponse,
  createRequestVoteRpcRequest,
  createRequestVoteRpcResponse,
  getRpcMessageTerm
} from './rpc/message';
import { IDurableValue, createDurableInteger, createDurableString } from './storage';
import { IElectionTimer } from './election-timer';
import { IEndpoint, ITransport, createEndpoint, createTcpTransport } from './net';
import { ILog, createLog } from './log';
import { IRpcMessage, IRpcService, createRpcService, isRpcRequest, isRpcResponse } from './rpc';
import { internalCreateServer } from './factory';
import { Server } from './server';
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
          results: Object.assign({}, message.results, {
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

  const peerEndpoint: IEndpoint = createEndpoint({
    host: '0.0.0.0',
    port: 13231
  });

  let currentTerm: IDurableValue<number>;
  let log: ILog;
  let peerRpcService: IRpcService;
  let server: Server;
  let transport: ITransport;
  let votedFor: IDurableValue<string>;

  afterEach(function() {
    return Promise.all([
      peerRpcService.close(),
      server.stop()
    ]);
  });

  beforeEach(function() {
    currentTerm = createDurableInteger(tmp.fileSync().name);
    log = createLog({ path: tmp.fileSync().name });
    peerRpcService = createRpcService();
    transport = createTcpTransport();
    votedFor = createDurableString(tmp.fileSync().name);

    server = internalCreateServer({
      cluster: {
        servers: {
          server1: createEndpoint({
            host: '0.0.0.0',
            port: 18910
          }),
          server2: peerEndpoint
        }
      },
      currentTerm,
      electionTimer: tsSinon.stubInterface<IElectionTimer>(),
      id: 'server1',
      log,
      rpcService: createRpcService({ transport }),
      votedFor: votedFor
    }) as Server;

    return Promise.all([
       peerRpcService.listen(peerEndpoint),
       server.start().then(() => server.setCurrentTerm(INITIAL_TERM))
    ]);
  });

  const messages: IRpcMessage[] = [
    createAppendEntriesRpcRequest({
      entries: [],
      leaderCommit: 0,
      leaderId: 'server1',
      prevLogIndex: 0,
      prevLogTerm: 0,
      term: INITIAL_TERM
    }),
    createAppendEntriesRpcResponse({
      followerCommit: 0,
      followerId: 'server2',
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

  for(const message of messages) {
    context(`when a ${message.procedureType} ${message.callType} message is sent through its RPC service`, function() {
      let spyCurrentTermWrite;
      let spyLogWrite;
      let spyTransportSend;
      let spyVotedForWrite;

      afterEach(function() {
        spyCurrentTermWrite.restore();
        spyLogWrite.restore();
        spyTransportSend.restore();
        spyVotedForWrite.restore();
      });

      beforeEach(function() {
        spyCurrentTermWrite = sinon.spy(currentTerm, "write");
        spyLogWrite = sinon.spy(log, "write");
        spyTransportSend = sinon.spy(transport, "send");
        spyVotedForWrite = sinon.spy(votedFor, "write");
        return server.sendRpcMessage(peerEndpoint, message);
      });

      if (isRpcRequest(message)) {
        it('does not persist current term', function() {
          expect(spyCurrentTermWrite.calledOnce).to.be.false;
        });

        it('does not persist log entries', function() {
          expect(spyLogWrite.calledOnce).to.be.false;
        });

        it('does not persist vote', function() {
          expect(spyVotedForWrite.calledOnce).to.be.false;
        });
      }

      if (isRpcResponse(message)) {
        it('persists current term before transporting the message', function() {
          expect(spyCurrentTermWrite.calledOnce).to.be.true;
          expect(spyCurrentTermWrite.calledBefore(spyTransportSend)).to.be.true;
        });

        it('persists log entries before transporting the message', function() {
          expect(spyLogWrite.calledOnce).to.be.true;
          expect(spyLogWrite.calledBefore(spyTransportSend)).to.be.true;
        });

        it('persists vote before transporting the message', function() {
          expect(spyVotedForWrite.calledOnce).to.be.true;
          expect(spyVotedForWrite.calledBefore(spyTransportSend)).to.be.true;
        });
      }
    });

    for(const stateType of ['candidate', 'leader'] as StateType[]) {
      context(`if the server is a ${stateType}`, function() {
        beforeEach(function() {
          server.transitionTo(stateType);
        });

        context(`and it receives a ${message.procedureType} ${message.callType} message with a term greater than its own`, function() {
          beforeEach(function() {
            return peerRpcService.send(
              server.endpoint,
              copyMessageWithTerm(message, server.getCurrentTerm() + 1 + (Math.random() * 10))
            );
          });

          it('transitions to a follower', function(done) {
            setTimeout(function() {
              expect(server.getState().getType()).to.equal('follower');
              done();
            }, 100/*wait a bit*/);
          });
        });

        context(`and it receives a ${message.procedureType} ${message.callType} message with a term less than or equal to its own`, function() {
          beforeEach(function() {
            return peerRpcService.send(
              server.endpoint,
              copyMessageWithTerm(message, server.getCurrentTerm() - (Math.random() * 10))
            );
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

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TextDecoder, TextEncoder } from 'util';

import { expect } from 'chai';
import sinon from 'sinon';

import {
  IElectionTimer,
  createElectionTimer,
  createElectionTimeoutChooser
} from '../election-timer';
import { IEndpoint, createEndpoint } from '../net/endpoint';
import { ILog, createLog } from '../log';
import { IRpcService, createRpcService, createAppendEntriesRpcResponse, isAppendEntriesRpcRequest } from '../rpc';
import { Server } from '../server';
import { IStateMachine } from '../state-machine';
import { internalCreateServer } from '../factory';
import { IState } from './';
import { LeaderState } from './leader';

describe('server leader state', function() {
  const MIN_TIMEOUT = 100,
    MAX_TIMEOUT = 500,
    peer1Endpoint: IEndpoint = createEndpoint({
      host: '0.0.0.0',
      port: 31391
    }),
    selfEndpoint: IEndpoint = createEndpoint({
      host: '0.0.0.0',
      port: 18910
    }),
    textDecoder = new TextDecoder('utf8'),
    textEncoder = new TextEncoder(),
    result = textEncoder.encode('ok');

  let dataDir: string, 
    electionTimer: IElectionTimer,
    leader: IState,
    log: ILog,
    peer1RpcService: IRpcService,
    server: Server,
    stateMachine: IStateMachine;

  afterEach(function() {
    return Promise.all([peer1RpcService.close(), server.stop()]);
  });

  beforeEach(function() {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'data'));

    electionTimer = createElectionTimer({
      timeoutChooser: createElectionTimeoutChooser({
        interval: [MIN_TIMEOUT, MAX_TIMEOUT]
      })
    });

    log = createLog({ path: dataDir });

    stateMachine = {
      execute: sinon.fake.returns(Promise.resolve(result))
    };

    server = internalCreateServer({
      cluster: {
        servers: {
          self: selfEndpoint,
          peer1: peer1Endpoint
        }
      },
      dataDir,
      electionTimer,
      id: 'self',
      log,
      stateMachine
    });

    leader = new LeaderState(server);

    peer1RpcService = createRpcService();

    return Promise.all([
      server.start(),
      peer1RpcService.listen(peer1Endpoint)
    ]);
  });

  context('after it is entered', function() {
    afterEach(function() {
      server.getState().exit();
    });

    beforeEach(function() {
      server.transitionTo(leader);
    });

    context('when it receives a client request', function() {
      const request = {
        command: new Uint8Array(0)
      };

      let appendEntriesRequest = null,
        appendEntriesRequestCallback = null,
	response = null;

      function waitForAppendEntriesRequest(callback) {
        appendEntriesRequestCallback = callback;
        if (appendEntriesRequest != null)
          appendEntriesRequestCallback(appendEntriesRequest);
      }

      beforeEach(function() {
        peer1RpcService.onReceive(function(endpoint, message) {
          if(isAppendEntriesRpcRequest(message)) {
            appendEntriesRequest = message;
            if (appendEntriesRequestCallback)
              appendEntriesRequestCallback(appendEntriesRequest);
          }
        });

        response = server.execute(request);
      });

      it('appends the request command to the log', function() {
        const lastEntry = log.getLastEntry();
	expect(lastEntry.command).to.equal(request.command);
      });

      it('sends append-entries requests with the request command to servers', function(done) {
        let isDone = false;

        function doneOnce() {
          if(!isDone) {
	    isDone = true;
            done();
	  }
	}

        waitForAppendEntriesRequest(function(message) {
          message.arguments.entries.forEach(function(entry) {
            if(textDecoder.decode(entry.command) === textDecoder.decode(request.command)) {
              doneOnce();
	    }
	  });
	});
      });
    });

    it('periodically sends heartbeats to servers', function(done) {
      this.timeout(1000);

      let heartbeatCount = 0,
        heartbeatListenerDetacher = null;

      function wrappedDone() {
        heartbeatCount++;
        if (heartbeatCount == 10) {
          heartbeatListenerDetacher.detach();
          done();
        }
      }

      heartbeatListenerDetacher = peer1RpcService.onReceive((endpoint, message) => { 
        if(isAppendEntriesRpcRequest(message)) {
          peer1RpcService.send(
            endpoint,
            createAppendEntriesRpcResponse({
              followerCommit: 0,
	      followerId: 'peer1',
              success: true,
              term: server.getCurrentTerm()
            })
          );
          wrappedDone();
        }
      });
    });
  });
});

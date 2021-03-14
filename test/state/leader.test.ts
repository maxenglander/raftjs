import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import 'chai';

import { createAppendEntriesRpcResponse, isAppendEntriesRpcRequest } from '../rpc/message';
import {
  IElectionTimer,
  createElectionTimer,
  createElectionTimeoutChooser
} from '../election-timer';
import { IEndpoint, createEndpoint } from '../net/endpoint';
import { IRpcService, createRpcService } from '../rpc';
import { IServer, createServer } from '../';
import { IState } from './';
import { LeaderState } from './leader';

describe('server leader state', function() {
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

  let leader: IState,
    electionTimer: IElectionTimer,
    rpcService: IRpcService,
    server: IServer;

  afterEach(function() {
    return Promise.all([rpcService.close(), server.stop()]);
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
          server0: selfEndpoint,
          server1: serverEndpoint
        }
      },
      dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
      electionTimer,
      id: 'server0'
    });

    leader = new LeaderState(server);

    rpcService = createRpcService();

    return Promise.all([
      server.start(),
      rpcService.listen(serverEndpoint)
    ]);
  });

  context('after #enter is called', function() {
    afterEach(function() {
      leader.exit();
      server.getState().exit();
    });

    beforeEach(function() {
      leader.enter();
    });

    it('periodically sends heartbeats to servers', function(done) {
      this.timeout(1000);

      let heartbeatCount = 0;
      const heartbeatListenerDetacher = rpcService.onReceive((endpoint, message) => { 
        if(isAppendEntriesRpcRequest(message)) {
          rpcService.send(
            endpoint,
            createAppendEntriesRpcResponse({
              followerCommit: 0,
              success: true,
              term: server.getCurrentTerm()
            })
          );
          wrappedDone();
        }
      });
      function wrappedDone() {
        heartbeatCount++;
        if (heartbeatCount == 10) {
          heartbeatListenerDetacher.detach();
          done();
        }
      }
    });
  });
});

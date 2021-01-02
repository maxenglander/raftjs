import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';
import sinon from 'sinon';

import * as AppendEntries from '../../rpc/message/append-entries';
import { IEndpoint, createEndpoint } from '../../net';
import { IRpcEventListener, IRpcService, createRpcService } from '../../rpc';
import { IServer, ServerId, createServer } from '../';
import { ITimer, createTimer, createTimeoutChooser } from '../timer';
import { IState, StateTransition, StateType } from './';
import { createLeaderState } from './leader';

describe('server leader state', function() {
    const MIN_TIMEOUT: number = 100,
        MAX_TIMEOUT: number = 500,
        peerEndpoint: IEndpoint = createEndpoint({
            host: '0.0.0.0',
            port: 31391
        }),
        selfEndpoint: IEndpoint = createEndpoint({
            host: '0.0.0.0',
            port: 18910
        });

    let leader: IState,
        electionTimer: ITimer,
        peerApi: IRpcService,
        server: IServer;

    afterEach(function() {
        return Promise.all([
            peerApi.close(),
            server.peerApi.close()
        ]);
    });

    beforeEach(function() {
        electionTimer = createTimer({
            timeoutChooser: createTimeoutChooser({
                interval: [MIN_TIMEOUT, MAX_TIMEOUT]
            })
        });

        server = createServer({
            cluster: {
                servers: {
                    'server0': selfEndpoint,
                    'server1': peerEndpoint
                }
            },
            dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
            electionTimer,
            id: 'server0'
        });

        leader = createLeaderState(server);

        peerApi = createRpcService();

        return Promise.all([
            server.peerApi.listen(server.endpoint),
            peerApi.listen(peerEndpoint)
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

        it('periodically sends heartbeats to peers', function(done) {
            this.timeout(1000);

            let heartbeatListener: IRpcEventListener,
                heartbeatCount = 0;

            function wrappedDone() {
                heartbeatCount++;
                if(heartbeatCount == 10) {
                    heartbeatListener.detach();
                    done();
                }
            }

            heartbeatListener = peerApi.onReceive({
                callType: 'request',
                procedureType: 'append-entries',
                notify(endpoint: IEndpoint, message: AppendEntries.IRpcRequest) {
                    peerApi.send([endpoint], AppendEntries.createRpcResponse({
                        success: true,
                        term: server.getCurrentTerm()
                    }));
                    wrappedDone();
                }
            });
        });
    });
});

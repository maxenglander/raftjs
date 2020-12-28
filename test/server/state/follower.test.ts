import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';
import sinon from 'sinon';

import { createRequest as createAppendEntriesRequest } from '../../rpc/message/append-entries';
import { IEndpoint, createEndpoint } from '../../net';
import { createRpcService } from '../../rpc';
import { IServer, createServer } from '../';
import { ITimer, createTimer, createTimeoutChooser } from '../timer';
import { IState, StateTransition, StateType } from './';
import { createFollowerState } from './follower';

describe('server follower state', function() {
    const MIN_TIMEOUT: number = 100,
        MAX_TIMEOUT: number = 500,
        peerEndpoint = createEndpoint({
            host: '0.0.0.0',
            port: 13231
        });

    let electionTimer: ITimer,
        follower: IState,
        initialState: StateType,
        server: IServer;

    afterEach(function() {
        return server.stop();
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
                    'server0': createEndpoint({
                        host: '0.0.0.0',
                        port: 18910
                    }),
                    'server1': peerEndpoint 
                }
            },
            dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
            electionTimer,
            id: 'server0'
        });

        follower = createFollowerState(server);

        return server.start();
    });

    context('after it is entered', function() {
        afterEach(function() {
            server.getState().exit();
        });

        beforeEach(function() {
            server.transitionTo(follower);
        });

        context('if it does not receive any append-entries requests before the election timeout', function() {
            it('times out and transitions to a candidate', function(done) {
                this.timeout(electionTimer.timeout + /*buffer*/100);

                electionTimer.on('timeout', function() {
                    expect(server.getState().type).to.equal('candidate');
                    done();
                });
            });
        });

        context('if it receives an append-entries request before the election timeout', function() {
            const rpcService = createRpcService();

            let term: number,
                timeRemaining: number;

            afterEach(function() {
                return rpcService.close();
            });

            beforeEach(function() {
                return rpcService.listen(peerEndpoint);
            });

            context('and the request is valid', function() {
                beforeEach(function(done) {
                    const waitABit = Math.random() * MIN_TIMEOUT;
                    timeRemaining = electionTimer.timeout - waitABit;
                    term = server.getCurrentTerm() + Math.round(Math.random() * 5)

                    this.timeout(waitABit + /*buffer*/10);

                    // Wait a little bit to simulate a partial elapse
                    // of the election timer.
                    setTimeout(function() {
                        rpcService.send([server.endpoint],
                            createAppendEntriesRequest({ entries: [], term }));
                        done();
                    }, waitABit);
                });

                it('the election timeout is extended; it does not change state', function(done) {
                    this.timeout(electionTimer.timeout + /*buffer*/10);

                    setTimeout(function() {
                        expect(server.getState().type).to.equal('follower');
                        done();
                    }, timeRemaining);
                });
            });

            context('but the request term is less than the server term', function() {
                beforeEach(function(done) {
                    const waitABit = Math.random() * MIN_TIMEOUT;
                    timeRemaining = electionTimer.timeout - waitABit;
                    term = server.getCurrentTerm() + Math.min(-1, Math.round(Math.random() * -5));

                    this.timeout(waitABit + /*buffer*/50);

                    // Wait a little bit
                    setTimeout(function() {
                        rpcService.send([server.endpoint],
                            createAppendEntriesRequest({ entries: [], term }));
                        done();
                    }, waitABit);
                });

                it('transitions to a candidate', function(done) {
                    this.timeout(electionTimer.timeout + /*buffer*/100);

                    electionTimer.on('timeout', function() {
                        expect(server.getState().type).to.equal('candidate');
                        done();
                    });
                });
            });
        });
    });
});

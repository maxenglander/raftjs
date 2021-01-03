import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';
import sinon from 'sinon';

import * as AppendEntries from '../rpc/message/append-entries';
import { IEndpoint, createEndpoint } from '../../net/endpoint';
import { IRpcEventListener, createRpcService } from '../rpc';
import { IServer, createServer } from '../';
import { ITimer, createTimer, createTimeoutChooser } from '../timer';
import { IState, StateTransition } from './';
import { createBaseState } from './base';

describe('server base state', function() {
    const MIN_TIMEOUT: number = 100,
        MAX_TIMEOUT: number = 500;

    let electionTimer: ITimer,
        base: IState,
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
                    'server1': createEndpoint({
                        host: '0.0.0.0',
                        port: 18910
                    })
                }
            },
            dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'data')),
            electionTimer,
            id: 'server1'
        });

        base = createBaseState(server, null);

        // Set the server term to 10 so that request terms can be
        // less than 10 but greater than zero.
        return server.start().then(() => server.setCurrentTerm(10));
    });

    context('after it is entered', function() {
        afterEach(function() {
            server.getState().exit();
        });

        beforeEach(function() {
            server.transitionTo(base);
        });

        context('if it receives an append-entries request', function() {
            function waitForAppendEntriesResponse(callback) {
                appendEntriesResponseCallback = callback;
                if(appendEntriesResponse != null)
                    appendEntriesResponseCallback(appendEntriesResponse);
            }

            const endpoint: IEndpoint = createEndpoint({
                    host: '0.0.0.0',
                    port: 13231
                }),
                rpcService = createRpcService();

            let appendEntriesResponse: AppendEntries.IRpcResponse,
                appendEntriesResponseCallback,
                appendEntriesListener: IRpcEventListener,
                term: number;

            afterEach(function() {
                appendEntriesResponse = null;
                appendEntriesResponseCallback = null;
                appendEntriesListener.detach();
                return rpcService.close();
            });

            beforeEach(function() {
                appendEntriesListener
                    = rpcService.onReceive({
                        callType: 'response',
                        procedureType: 'append-entries',
                        notify(endpoint: IEndpoint, response: AppendEntries.IRpcResponse) {
                            appendEntriesResponse = response;
                            if(appendEntriesResponseCallback != null)
                                appendEntriesResponseCallback(response);
                        }
                    });

                return rpcService.listen(endpoint);
            });

            context('and the request is valid', function() {
                beforeEach(function(done) {
                    const waitABit = Math.random() * MIN_TIMEOUT;
                    term = server.getCurrentTerm() + Math.round(Math.random() * 5)

                    this.timeout(waitABit + /*buffer*/10);

                    // Wait a little bit to simulate a partial
                    // elapse of the election timer.
                    setTimeout(function() {
                        rpcService.send([server.endpoint],
                            AppendEntries.createRpcRequest({
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

                it('replies positively', function(done) {
                    waitForAppendEntriesResponse(function() {
                        expect(appendEntriesResponse.results.success).to.be.true;
                        done();
                    });
                });
            });

            context('but the request term is less than the server term', function() {
                beforeEach(function(done) {
                    const waitABit = Math.random() * MIN_TIMEOUT;
                    term = server.getCurrentTerm() + Math.min(-1, Math.round(Math.random() * -5));

                    this.timeout(waitABit + /*buffer*/10);

                    // Wait a little bit to simulate a partial
                    // elapse of the election timer.
                    setTimeout(function() {
                        rpcService.send([server.endpoint],
                            AppendEntries.createRpcRequest({
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

                it('replies negatively', function(done) {
                    waitForAppendEntriesResponse(function() {
                        expect(appendEntriesResponse.results.success).to.be.false;
                        done();
                    });
                });
            });
        });
    });
});

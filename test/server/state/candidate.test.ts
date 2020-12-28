import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { expect } from 'chai';
import sinon from 'sinon';

import * as AppendEntries from '../../rpc/message/append-entries';
import * as RequestVote from '../../rpc/message/request-vote';
import { IEndpoint, createEndpoint } from '../../net';
import { IRpcEventListener, IRpcService, createRpcService } from '../../rpc';
import { IServer, ServerId, createServer } from '../';
import { ITimer, createTimer, createTimeoutChooser } from '../timer';
import { IState, StateTransition, StateType } from './';
import { createCandidateState } from './candidate';

describe('server candidate state', function() {
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

    let candidate: IState,
        electionTimer: ITimer,
        rpcService: IRpcService,
        server: IServer;

    afterEach(function() {
        return Promise.all([
            rpcService.close(),
            server.stop()
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

        candidate = createCandidateState(server);

        rpcService = createRpcService();

        return Promise.all([
            // Set server term to greater than 10 so request
            // terms can be less than 10 but greater than zero.
            server.start().then(() => server.setCurrentTerm(10)),
            rpcService.listen(peerEndpoint)
        ]);
    });

    context('after it is entered', function() {
        function waitForRequestVoteRequest(callback) {
            requestVoteRequestCallback = callback;
            if(requestVoteRequest != null)
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
            rpcService.onReceive({
                callType: 'request',
                procedureType: 'request-vote',
                notify(endpoint: IEndpoint, request: RequestVote.IRequest) {
                    requestVoteRequest = request;
                    if(requestVoteRequestCallback)
                        requestVoteRequestCallback(requestVoteRequest);
                }
            });

            initialTerm = server.getCurrentTerm();
            initialVote = server.getVote();

            server.transitionTo(candidate);
        });

        it('increments the term', function() {
            /* Wait for new term to persist to disk*/
            setTimeout(function() {
                expect(server.getCurrentTerm()).to.equal(initialTerm + 1);
            }, 50);
        });

        it('requests votes from its peers', function(done) {
            let calledDone = false;

            function doneOnce() {
                if(calledDone == true) return;
                calledDone = true;
                done();
            }

            waitForRequestVoteRequest(function(request: RequestVote.IRequest) {
                doneOnce();
            });
        });

        it('votes for itself', function(done) {
            // Wait for vote to be stored to disk
            setTimeout(function() {
                expect(server.getVote()).not.to.equal(initialVote);
                expect(server.getVote()).to.equal(server.id);
                done();
            }, /*buffer*/10);
        });

        context('if it receives an append-entries request', function() {
            let randomWait: number;

            beforeEach(function(done) {
                randomWait = Math.random() * 5000;

                this.timeout(randomWait + /*buffer*/100);

                setTimeout(function() {
                    rpcService.send([server.endpoint],
                        AppendEntries.createRequest({
                            entries: [],
                            term: server.getCurrentTerm()
                        })
                    ).then(() => done());
                }, randomWait);
            });

            it('transitions to a follower', function(done) {
                setTimeout(function() {
                    expect(server.getState().type).to.equal('follower');
                    done()
                }, /*allow time for candidate to process request*/10);
            });
        });

        context('if it receives request-vote responses before the election timeout', function() {
            let requestVoteListener: IRpcEventListener;

            afterEach(function() {
                requestVoteListener.detach();
            });

            context('with a majority of the cluster granting the request', function() {
                beforeEach(function(done) {
                    let calledDone: boolean = false;

                    function doneOnce() {
                        if(calledDone) return;
                        calledDone = true;
                        done();
                    }

                    requestVoteListener = rpcService.onReceive({
                        callType: 'request',
                        procedureType: 'request-vote',
                        notify(endpoint: IEndpoint, request: RequestVote.IRequest) {
                            const term = request.arguments.term + Math.min(0, Math.round(Math.random() * -5));
                            rpcService.send([endpoint], RequestVote.createResponse({ voteGranted: true, term }))
                                .then(() => doneOnce());
                        }
                    });
                });

                it('transitions to a leader', function(done) {
                    setTimeout(function() {
                        expect(server.getState().type).to.equal('leader');
                        done();
                    }, /*allow candidate processing time*/20);
                });
            });

            context('without a majority of the cluster granting the request', function() {
                beforeEach(function(done) {
                    let calledDone: boolean = false;

                    function doneOnce() {
                        if(calledDone) return;
                        calledDone = true;
                        done();
                    }

                    requestVoteListener = rpcService.onReceive({
                        callType: 'request',
                        procedureType: 'request-vote',
                        notify(endpoint: IEndpoint, request: RequestVote.IRequest) {
                            const term = request.arguments.term + Math.min(0, Math.round(Math.random() * -5));
                            rpcService.send([endpoint], RequestVote.createResponse({ voteGranted: false, term }));
                            doneOnce();
                        }
                    });
                });

                it('restarts the election timer and does not transition state', function(done) {
                    electionTimer.on('reset', function() {
                        expect(server.getState().type).to.equal('candidate');
                        done();
                    });
                });
            });
        });
    });
});

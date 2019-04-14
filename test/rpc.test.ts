import { expect } from 'chai';

import { IRpcService } from './rpc';
import * as AppendEntries from './message/append-entries';
import { IEndpoint, createEndpoint } from './net';
import { createRpcService } from './rpc';

describe('rpc service', function() {
    const endpointA = createEndpoint({
            host: '0.0.0.0',
            port: 8389
        }),
        endpointB = createEndpoint({
            host: '0.0.0.0',
            port: 9131
        }),
        endpointC = createEndpoint({
            host: '0.0.0.0',
            port: 10313
        });
        
    let rpcServiceA: IRpcService,
        rpcServiceB: IRpcService,
        rpcServiceC: IRpcService;

    afterEach(function() {
        this.timeout(5000);
        return Promise.all([
            rpcServiceA.close(),
            rpcServiceB.close(),
            rpcServiceC.close(),
        ]);
    });

    beforeEach(function() {
        rpcServiceA = createRpcService();
        rpcServiceB = createRpcService();
        rpcServiceC = createRpcService();
    });

    context('when #listen is called', function() {
        beforeEach(function() {
            return Promise.all([
                rpcServiceA.listen(endpointA),
                rpcServiceB.listen(endpointB),
                rpcServiceC.listen(endpointC),
            ]);
        });

        context('and a message is sent to it', function() {
            it('accepts the message', function(done) {
                let receiveCount = 0;

                function wrappedDone() {
                    receiveCount++;
                    if(receiveCount >= 2)
                        done();
                }

                rpcServiceA.receive({
                    callType: 'request',
                    procedureType: 'append-entries',
                    notify(endpoint: IEndpoint, message: AppendEntries.IRequest) {
                        expect(message.arguments.term).to.equal(1);
                        wrappedDone();
                    }
                });

                rpcServiceB.receive({
                    callType: 'request',
                    procedureType: 'append-entries',
                    notify(endpoint: IEndpoint, message: AppendEntries.IRequest) {
                        expect(message.arguments.term).to.equal(1);
                        wrappedDone();
                    }
                });

                rpcServiceC.send([endpointA, endpointB], AppendEntries.createRequest({
                    entries: [],
                    term: 1
                }));
            });
        });
    });
});

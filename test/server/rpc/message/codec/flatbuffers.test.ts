import { TextDecoder, TextEncoder } from 'util';
import { expect } from 'chai';

import { AppendEntries, IRpcMessage, RequestVote } from '../';
import { createRpcRequest as createRequestVoteRequest } from '../request-vote';
import { IEndpoint, createEndpoint } from '../../../../net/endpoint';

import { ICodec, createFlatbuffersCodec } from './';

describe('The Flatbuffers codec', function() {
    const codec: ICodec = createFlatbuffersCodec(),
        endpoint: IEndpoint = createEndpoint({
            host: 'sender-1',
            port: 8080
        }),
        textDecoder = new TextDecoder,
        textEncoder = new TextEncoder();

    let data: Uint8Array = null, originalMessage: IRpcMessage = null;

    describe('.decode', function() {
        context('when given binary data representing a "request-vote" request', function() {
            beforeEach(function() {
                originalMessage = createRequestVoteRequest({
                    candidateId: 'server-0',
                    lastLogIndex: 3,
                    lastLogTerm: 5,
                    term: 7
                });
                data = codec.encode(originalMessage);
            });

            it('decodes a "request-vote" request from binary data', function() {
                const message: IRpcMessage = codec.decode(data);
                expect(message.callType).to.equal("request");
                expect(message.procedureType).to.equal("request-vote");
            });

            describe('the decoded message', function() {
                let decodedMessage: RequestVote.IRpcRequest;

                beforeEach(function() {
                    decodedMessage = codec.decode(data) as RequestVote.IRpcRequest;
                });

                it('has the same term as the original message', function() {
                    expect(decodedMessage.arguments.term)
                        .to.equal((originalMessage as RequestVote.IRpcRequest).arguments.term);
                });
            });
        });
    });

    describe('.encode', function() {
        context('when passed a "request-vote" request', function() {
            beforeEach(function() {
                originalMessage = createRequestVoteRequest({
                    candidateId: 'server-10',
                    lastLogIndex: 9,
                    lastLogTerm: 3,
                    term: 8
                });
            });

            it('produces binary data from a "request-vote" request', function() {
                const data = codec.encode(originalMessage);
                expect(data).to.be.a('Uint8Array');
            });
        });
    });
});

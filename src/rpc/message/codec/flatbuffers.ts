// Encodes messages to data, decodes data to messages,
// using [FlatBuffers](https://google.github.io/flatbuffers/).  

//
import { flatbuffers } from 'flatbuffers';

import { AppendEntries, IRpcMessage, RequestVote } from '../';
import { compilerError } from '../../../util/compiler-error';

import { ICodec } from './';

// `flatbuffers_generated.ts` is generated from
// `flatbuffers.fbs` during the build process.
// Neither file is included in the annotated source.
import * as Schema from './flatbuffers_generated';

//
export function createFlatbuffersCodec(): ICodec {
    return { decode, encode };
}

// Decode data to a message.
function decode(data: Uint8Array): IRpcMessage {
    const buffer = new flatbuffers.ByteBuffer(data),
        schema = Schema.Message.getRootAsMessage(buffer),
        procedureType = schema.procedureType();

    switch(procedureType) {
        case Schema.ProcedureType.AppendEntries:
            return decodeAppendEntries(schema);
        case Schema.ProcedureType.RequestVote:
            return decodeRequestVote(schema);
        default:
            // Used by TypeScript for [exhaustiveness
            // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
            return compilerError(procedureType);
    }
}

// Decode data to an AppendEntries message.
function decodeAppendEntries(schema: Schema.Message): AppendEntries.IRpcExchange {
    const callType = schema.callType();

    switch(callType) {
        case Schema.CallType.Request:
            return decodeAppendEntriesRequest(schema);
        case Schema.CallType.Response:
            return decodeAppendEntriesResponse(schema);
        default:
            // Used by TypeScript for [exhaustiveness
            // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
            return compilerError(callType);
    }
}

// Decode data to an AppendEntries request.
function decodeAppendEntriesRequest(schema: Schema.Message): AppendEntries.IRpcRequest {
    const args: Schema.AppendEntriesArguments = schema.arguments(new Schema.AppendEntriesArguments());
    const entries = Array.from({ length: args.entriesLength() }, (_, i) => i).map(i => {
        const entry = args.entries(i);
        return {
            command: entry.commandArray(),
            index: entry.index(),
            term: entry.term()
        };
    });

    return {
        callType: 'request',
        procedureType: 'append-entries',
        arguments: {
            entries: entries,
            leaderCommit: args.leaderCommit(),
            leaderId: args.leaderId(),
            prevLogIndex: args.prevLogIndex(),
            prevLogTerm: args.prevLogTerm(),
            term: args.term()
        },
    };
}

// Decode data to an AppendEntries response.
function decodeAppendEntriesResponse(schema: Schema.Message): AppendEntries.IRpcResponse {
    const results: Schema.AppendEntriesResults = schema.results(new Schema.AppendEntriesResults());

    return {
        callType: 'response',
        procedureType: 'append-entries',
        results: {
            success: results.success(),
            term: results.term()
        }
    };
}

// Decode data to a RequestVote message.
function decodeRequestVote(schema: Schema.Message): RequestVote.IRpcExchange {
    const callType = schema.callType();

    switch(callType) {
        case Schema.CallType.Request:
            return decodeRequestVoteRequest(schema);
        case Schema.CallType.Response:
            return decodeRequestVoteResponse(schema);
        default:
            // Used by TypeScript for [exhaustiveness
            // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
            return compilerError(callType);
    }
}

// Decode data to a RequestVote request.
function decodeRequestVoteRequest(schema: Schema.Message): RequestVote.IRpcRequest {
    const args: Schema.RequestVoteArguments = schema.arguments(new Schema.RequestVoteArguments());

    return {
        callType: 'request',
        procedureType: 'request-vote',
        arguments: {
            candidateId: args.candidateId(),
            lastLogIndex: args.lastLogIndex(),
            lastLogTerm: args.lastLogTerm(),
            term: args.term()
        }
    };
}

// Decode data to a RequestVote response.
function decodeRequestVoteResponse(schema: Schema.Message): RequestVote.IRpcResponse {
    const results: Schema.RequestVoteResults = schema.results(new Schema.RequestVoteResults());

    return {
        callType: 'response',
        procedureType: 'request-vote',
        results: {
            term: results.term(),
            voteGranted: results.voteGranted()
        }
    };
}

// Encode a message to data.
function encode(message: IRpcMessage): Uint8Array {
    const builder = new flatbuffers.Builder();

    let args: flatbuffers.Offset = null,
        results: flatbuffers.Offset = null,
        callType: Schema.CallType,
        procedureType: Schema.ProcedureType;

    switch(message.procedureType) {
        case 'append-entries':
            procedureType = Schema.ProcedureType.AppendEntries;
            switch(message.callType) {
                case 'request':
                    args = encodeAppendEntriesArguments(builder, (message as AppendEntries.IRpcRequest).arguments);
                    callType = Schema.CallType.Request;
                    break;
                case 'response':
                    callType = Schema.CallType.Response;
                    results = encodeAppendEntriesResults(builder, (message as AppendEntries.IRpcResponse).results);
                    break;
                default:
                    // Used by TypeScript for [exhaustiveness
                    // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
                    compilerError(message);
            }
            break;
        case 'request-vote':
            procedureType = Schema.ProcedureType.RequestVote;
            switch(message.callType) {
                case 'request':
                    args = encodeRequestVoteArguments(builder, (message as RequestVote.IRpcRequest).arguments);
                    callType = Schema.CallType.Request;
                    break;
                case 'response':
                    callType = Schema.CallType.Response;
                    results = encodeRequestVoteResults(builder, (message as RequestVote.IRpcResponse).results);
                    break;
                default:
                    // Used by TypeScript for [exhaustiveness
                    // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
                    compilerError(message);
            }
            break;
        default:
            // Used by TypeScript for [exhaustiveness
            // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
            compilerError(message);
    }

    Schema.Message.startMessage(builder);
    Schema.Message.addArguments(builder, args);
    Schema.Message.addCallType(builder, callType);
    Schema.Message.addProcedureType(builder, procedureType);
    Schema.Message.addResults(builder, results);
    const offset = Schema.Message.endMessage(builder);

    builder.finish(offset);
    return builder.asUint8Array();
}

// Encode AppendEntries arguments to a flatbuffers offset.
function encodeAppendEntriesArguments(builder: flatbuffers.Builder, args: AppendEntries.IRpcArguments): flatbuffers.Offset {
    const leaderId = builder.createString(args.leaderId);
    const entries = Schema.AppendEntriesArguments.createEntriesVector(builder, args.entries.map((entry) => {
        const command = Schema.LogEntry.createCommandVector(builder, entry.command);
        Schema.LogEntry.startLogEntry(builder);
        Schema.LogEntry.addCommand(builder, command);
        Schema.LogEntry.addIndex(builder, entry.index);
        Schema.LogEntry.addTerm(builder, entry.term);
        return Schema.LogEntry.endLogEntry(builder);
    }));
    Schema.AppendEntriesArguments.startAppendEntriesArguments(builder);
    Schema.AppendEntriesArguments.addEntries(builder, entries);
    Schema.AppendEntriesArguments.addLeaderId(builder, leaderId);
    Schema.AppendEntriesArguments.addLeaderCommit(builder, args.leaderCommit);
    Schema.AppendEntriesArguments.addPrevLogIndex(builder, args.prevLogIndex);
    Schema.AppendEntriesArguments.addPrevLogTerm(builder, args.prevLogTerm);
    Schema.AppendEntriesArguments.addTerm(builder, args.term);
    return Schema.AppendEntriesArguments.endAppendEntriesArguments(builder);
}

// Encode AppendEntries results to a flatbuffers offset.
function encodeAppendEntriesResults(builder: flatbuffers.Builder, results: AppendEntries.IRpcResults): flatbuffers.Offset {
    Schema.AppendEntriesResults.startAppendEntriesResults(builder);
    Schema.AppendEntriesResults.addSuccess(builder, results.success);
    Schema.AppendEntriesResults.addTerm(builder, results.term);
    return Schema.AppendEntriesResults.endAppendEntriesResults(builder);
}

// Encode RequestVote arguments to a flatbuffers offset.
function encodeRequestVoteArguments(builder: flatbuffers.Builder, args: RequestVote.IRpcArguments): flatbuffers.Offset {
    Schema.RequestVoteArguments.startRequestVoteArguments(builder);
    Schema.RequestVoteArguments.addTerm(builder, args.term);
    return Schema.RequestVoteArguments.endRequestVoteArguments(builder);
}

// Encode RequestVote results to a flatbuffers offset.
function encodeRequestVoteResults(builder: flatbuffers.Builder, results: RequestVote.IRpcResults): flatbuffers.Offset {
    Schema.RequestVoteResults.startRequestVoteResults(builder);
    Schema.RequestVoteResults.addTerm(builder, results.term);
    Schema.RequestVoteResults.addVoteGranted(builder, results.voteGranted);
    return Schema.RequestVoteResults.endRequestVoteResults(builder);
}

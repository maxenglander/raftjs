// The central component of the `raftjs` project,
// `Server`, listens on a socket for RPC commands
// from other `Server` instances and transitions
// between follower, candidate and leader states.

import * as path from 'path';

import { ICluster } from '../cluster';
import { IDurableValue, createDurableInteger, createDurableString } from '../storage';
import { ILog, createLog } from '../log';
import { ILogger, createLogger } from '../logger';
import { IRpcService, createRpcService } from './rpc';
import { IServer, Server, ServerId } from './server';
import { ITimer, createTimer } from './timer';

interface IBaseCreateServerOptions {
    readonly cluster: ICluster;
    readonly electionTimer?: ITimer;
    readonly id: ServerId;
    readonly log?: ILog;
    readonly logger?: ILogger;
    readonly peerApi?: IRpcService;
}

export type ICreateServerOptions =
    IBaseCreateServerOptions & ICurrentTermOrDataDir & IVotedForOrDataDir;

interface IDataDir {
    dataDir: string;
}

interface ICurrentTerm {
    currentTerm: IDurableValue<number>;
}

type ICurrentTermOrDataDir = ICurrentTerm | IDataDir;

interface IVotedFor {
    votedFor: IDurableValue<string>;
}

type IVotedForOrDataDir = IVotedFor | IDataDir;

// The `createServer` method produces a `Server` configured
// by the provided `options`.
export function createServer(options: ICreateServerOptions): IServer {
    let currentTerm: IDurableValue<number>;
    if('currentTerm' in options) {
        currentTerm = options.currentTerm;
    } else if('dataDir' in options) {
        currentTerm = createDurableInteger(path.join(options.dataDir, 'currentTerm'));
    } else {
        throw new Error('Must supply either currentTerm or dataDir');
    }

    let votedFor: IDurableValue<string>;
    if('votedFor' in options) {
        votedFor = options.votedFor;
    } else if('dataDir' in options) {
        votedFor = createDurableString(path.join(options.dataDir, 'votedFor'));
    } else {
        throw new Error('Must supply either votedFor or dataDir');
    }

    return new Server({
        cluster: options.cluster,
        currentTerm,
        electionTimer: options.electionTimer || createTimer(),
        id: options.id,
        log: options.log || createLog(),
        logger: options.logger || createLogger(),
        peerApi: options.peerApi || createRpcService(),
        votedFor
    });
}

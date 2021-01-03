// The central component of the `raftjs` project,
// `Server`, listens on a socket for RPC commands
// from other `Server` instances and transitions
// between follower, candidate and leader states.

import * as path from 'path';

import { ICluster } from '../cluster';
import { ICreateServerOptions, IServer, ServerId } from './@types';
import { IDurableValue, createDurableInteger, createDurableString } from '../storage';
import { IElectionTimer, createElectionTimer } from './election-timer';
import { ILog, createLog } from '../log';
import { ILogger, createLogger } from '../logger';
import { IRpcService, createRpcService } from './rpc';
import { Server } from './server';

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
        electionTimer: options.electionTimer || createElectionTimer(),
        id: options.id,
        log: options.log || createLog(),
        logger: options.logger || createLogger(),
        peerApi: options.peerApi || createRpcService(),
        votedFor
    });
}

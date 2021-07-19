// The central component of the `raftjs` project,
// `Server`, listens on a socket for RPC commands
// from other `Server` instances and transitions
// between follower, candidate and leader states.

import * as path from 'path';

import { ICreateServerOptions, IServer, IServerContext } from './types';
import {
  IDurableValue,
  createDurableInteger,
  createDurableString
} from './storage';
import { ILog } from './log';
import { IStateMachine, createNoopStateMachine } from './state-machine';
import { createElectionTimer } from './election-timer';
import { createLog } from './log';
import { createLogger } from './logger';
import { createRpcService } from './rpc';
import { Server } from './server';

// The `createServer` method produces a `Server` configured
// by the provided `options`.
export function createServer(options: ICreateServerOptions): IServer {
  return internalCreateServer(options);
}

export function internalCreateServer(options: ICreateServerOptions): Server {
  let currentTerm: IDurableValue<number>;
  if ('currentTerm' in options) {
    currentTerm = options.currentTerm;
  } else if ('dataDir' in options) {
    currentTerm = createDurableInteger(
      path.join(options.dataDir, 'currentTerm')
    );
  } else {
    throw new Error('Must supply either currentTerm or dataDir');
  }

  let log: ILog;
  if ('log' in options) {
    log = options.log;
  } else if ('dataDir' in options) {
    log = createLog({
      path: path.join(options.dataDir, 'log')
    });
  } else {
    throw new Error('Must supply either log or dataDir');
  }

  let votedFor: IDurableValue<string>;
  if ('votedFor' in options) {
    votedFor = options.votedFor;
  } else if ('dataDir' in options) {
    votedFor = createDurableString(path.join(options.dataDir, 'votedFor'));
  } else {
    throw new Error('Must supply either votedFor or dataDir');
  }

  return new Server({
    cluster: options.cluster,
    currentTerm,
    electionTimer: options.electionTimer || createElectionTimer(),
    id: options.id,
    log,
    logger: options.logger || createLogger(),
    rpcService: options.rpcService || createRpcService(),
    stateMachine: options.stateMachine || createNoopStateMachine(),
    votedFor
  });
}



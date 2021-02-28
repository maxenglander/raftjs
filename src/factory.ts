// The central component of the `raftjs` project,
// `Server`, listens on a socket for RPC commands
// from other `Server` instances and transitions
// between follower, candidate and leader states.

import * as path from 'path';

import { ICreateServerOptions, IServer } from './types';
import {
  IDurableValue,
  createDurableInteger,
  createDurableString
} from './storage';
import { createElectionTimer } from './election-timer';
import { createLog } from './log';
import { createLogger } from './logger';
import { createRpcService } from './rpc';
import { Server } from './server';

// The `createServer` method produces a `Server` configured
// by the provided `options`.
export function createServer(options: ICreateServerOptions): IServer {
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
    log: options.log || createLog(),
    logger: options.logger || createLogger(),
    peerRpcService: options.peerRpcService || createRpcService(),
    stateMachine: options.stateMachine || {
      execute: (command: Buffer) => Promise.resolve(Buffer.alloc(0))
    },
    votedFor
  });
}

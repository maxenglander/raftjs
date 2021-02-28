import { ICluster } from './cluster';
import { IDurableValue } from './storage';
import { ILog } from './log';
import { ILogger } from './logger';
import { IEndpoint } from './net/endpoint';
import { IRpcMessage, IRpcService, RpcReceiver } from './rpc';
import { IElectionTimer } from './election-timer';
import { IState, StateType } from './state';

export type ICreateServerOptions = {
  readonly cluster: ICluster;
  readonly electionTimer?: IElectionTimer;
  readonly id: ServerId;
  readonly log?: ILog;
  readonly logger?: ILogger;
  readonly peerRpcService?: IRpcService;
  readonly stateMachine?: IStateMachine;
} & ({ dataDir: string; } | { currentTerm: IDurableValue<number> })
  & ({ dataDir: string; } | { votedFor: IDurableValue<string> });

export interface IRequest {
  command: Buffer;
}

export type IResponse = {
  result: Buffer;
} | {
  error: 'not-leader';
  leader: {
    endpoint: IEndpoint;
  }
}

export interface IServer {
  readonly electionTimer: IElectionTimer;
  readonly endpoint: IEndpoint;
  readonly id: ServerId;
  readonly log: ILog;
  readonly logger: ILogger;
  readonly peerRpcService: IRpcService;
  readonly stateMachine: IStateMachine;
  getCommitIndex(): number;
  getCluster(): ICluster;
  getCurrentTerm(): number;
  getPeerEndpoints(): ReadonlyArray<IEndpoint>;
  getPeerIds(): ReadonlyArray<ServerId>;
  getLastApplied(): number;
  getState(): IState;
  getVotedFor(): ServerId;
  request(request: IRequest): Promise<IResponse>;
  setCurrentTerm(newTerm: number): void;
  setVotedFor(candidateId: ServerId): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  transitionTo(state: StateType | IState, leaderEndpoint?: IEndpoint): void;
}

export interface IServerOptions {
  readonly cluster: ICluster;
  readonly currentTerm: IDurableValue<number>;
  readonly electionTimer: IElectionTimer;
  readonly id: ServerId;
  readonly log: ILog;
  readonly logger: ILogger;
  readonly peerRpcService: IRpcService;
  readonly stateMachine: IStateMachine;
  readonly votedFor: IDurableValue<string>;
}

export type ServerId = string;

export interface IStateMachine {
  execute(command: Buffer): Promise<Buffer>;
}

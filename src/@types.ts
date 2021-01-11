import { ICluster } from './cluster';
import { IDurableValue } from './storage';
import { ILog } from './log';
import { ILogger } from './logger';
import { IEndpoint } from './net/endpoint';
import { IRpcEventListener, IRpcMessage, IRpcReceiver, IRpcService } from './rpc';
import { IElectionTimer } from './election-timer';
import { IState, StateType } from './state';

export type ICreateServerOptions = {
  readonly cluster: ICluster;
  readonly electionTimer?: IElectionTimer;
  readonly id: ServerId;
  readonly log?: ILog;
  readonly logger?: ILogger;
  readonly peerApi?: IRpcService;
} & ({ dataDir: string; } | { currentTerm: IDurableValue<number> })
  & ({ dataDir: string; } | { votedFor: IDurableValue<string> });

export interface IServer {
  readonly electionTimer: IElectionTimer;
  readonly endpoint: IEndpoint;
  readonly id: ServerId;
  readonly log: ILog;
  readonly logger: ILogger;
  readonly peerApi: IRpcService;
  getCommitIndex(): number;
  getCluster(): ICluster;
  getCurrentTerm(): number;
  getLastApplied(): number;
  getState(): IState;
  getVotedFor(): ServerId;
  onReceivePeerRpc<
    P extends IRpcMessage['procedureType'],
    C extends IRpcMessage['callType']
  >(
    receiver: IRpcReceiver<P, C>
  ): IRpcEventListener;
  sendPeerRpc(message: IRpcMessage): Promise<Promise<void>[]>;
  sendPeerRpc(
    endpoint: IEndpoint,
    message: IRpcMessage
  ): Promise<Promise<void>[]>;
  sendPeerRpc(
    endpoints: ReadonlyArray<IEndpoint>,
    message: IRpcMessage
  ): Promise<Promise<void>[]>;
  setCurrentTerm(newTerm: number): void;
  setVotedFor(candidateId: ServerId): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  transitionTo(state: StateType | IState): void;
}

export interface IServerOptions {
  readonly cluster: ICluster;
  readonly currentTerm: IDurableValue<number>;
  readonly electionTimer: IElectionTimer;
  readonly id: ServerId;
  readonly log: ILog;
  readonly logger: ILogger;
  readonly peerApi: IRpcService;
  readonly votedFor: IDurableValue<string>;
}

export type ServerId = string;

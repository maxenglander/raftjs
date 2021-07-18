import { IClientRequest, IClientResponse } from './api/client';
import { ICluster } from './cluster/types';
import { IDurableValue } from './storage';
import { ILog } from './log';
import { ILogger } from './logger';
import { IEndpoint } from './net/endpoint';
import { IRpcMessage, IRpcService, RpcReceiver } from './rpc';
import { IElectionTimer } from './election-timer';
import { IState, StateType } from './state';

export type ExecutionListener = (result: Uint8Array) => void;

export type ICreateServerOptions = {
  readonly cluster: ICluster;
  readonly electionTimer?: IElectionTimer;
  readonly id: ServerId;
  readonly logger?: ILogger;
  readonly rpcService?: IRpcService;
  readonly stateMachine?: IStateMachine;
} & ({ dataDir: string; } | { currentTerm: IDurableValue<number> })
  & ({ dataDir: string; } | { log: ILog })
  & ({ dataDir: string; } | { votedFor: IDurableValue<string> });

export interface IServer {
  readonly electionTimer: IElectionTimer;
  readonly endpoint: IEndpoint;
  readonly id: ServerId;
  readonly log: ILog;
  readonly logger: ILogger;
  readonly stateMachine: IObservableStateMachine;
  getCommitIndex(): number;
  getCluster(): ICluster;
  getCurrentTerm(): number;
  getServerEndpoints(): ReadonlyArray<IEndpoint>;
  getServerIds(): ReadonlyArray<ServerId>;
  getLastApplied(): number;
  getState(): IState;
  getVotedFor(): ServerId;
  handleClientRequest(request: IClientRequest): Promise<IClientResponse>;
  sendRpcMessage(endpoint: IEndpoint, message: IRpcMessage): Promise<void>;
  setCommitIndex(index: number): void;
  setCurrentTerm(newTerm: number): void;
  setVotedFor(candidateId: ServerId): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  transitionTo(state: StateType | IState, leaderId?: string): void;
}

export interface IServerOptions {
  readonly cluster: ICluster;
  readonly currentTerm: IDurableValue<number>;
  readonly electionTimer: IElectionTimer;
  readonly id: ServerId;
  readonly log: ILog;
  readonly logger: ILogger;
  readonly rpcService: IRpcService;
  readonly stateMachine: IStateMachine;
  readonly votedFor: IDurableValue<string>;
}

export type ServerId = string;

export interface IStateMachine {
  execute(command: Uint8Array): Promise<Uint8Array>;
}

export interface IObservableStateMachine extends IStateMachine {
  onceExecuted(command: Uint8Array, listener: ExecutionListener): void;
}

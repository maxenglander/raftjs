// The central component of the `raftjs` project,
// `Server`, listens on a socket for RPC commands
// from other `Server` instances and transitions
// between follower, candidate and leader states.

import { ICluster } from './cluster';
import { IDurableValue } from './storage';
import { ILog } from './log';
import { ILogger } from './logger';
import {
  IAppendEntriesRpcRequest,
  IAppendEntriesRpcResponse,
  IRpcMessage,
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse,
  isRpcMessage,
  isRpcRequest,
  isRpcResponse
} from './rpc/message';
import { IEndpoint, isEndpoint } from './net/endpoint';
import { IRpcEventListener, IRpcReceiver, IRpcService } from './rpc';
import { IElectionTimer } from './election-timer';
import { IRequest, IResponse, IServer, IServerOptions, IStateMachine, ServerId } from './@types';
import { IState, StateType, createState } from './state';

export class Server implements IServer {
  private readonly cluster: ICluster;
  private commitIndex: number;
  private currentTerm: IDurableValue<number>;
  public readonly electionTimer: IElectionTimer;
  public readonly endpoint: IEndpoint;
  public readonly id: ServerId;
  private readonly initialTerm: number;
  private lastApplied: number;
  public readonly log: ILog;
  public readonly logger: ILogger;
  private readonly peerApi: IRpcService;
  private rpcEventListeners: Set<IRpcEventListener>;
  private state: IState;
  public readonly stateMachine: IStateMachine;
  private votedFor: IDurableValue<string>;

  constructor(options: IServerOptions) {
    this.cluster = options.cluster;
    this.currentTerm = options.currentTerm;
    this.electionTimer = options.electionTimer;
    this.endpoint = options.cluster.servers[options.id];
    this.id = options.id;
    this.log = options.log;
    this.logger = options.logger;
    this.peerApi = options.peerApi;
    this.rpcEventListeners = new Set<IRpcEventListener>();
    // `noop` is not a state specified by the Raft protocol.
    // It is used here as a ["null
    // object"](https://en.wikipedia.org/wiki/Null_object_pattern) to
    // ensure that `Server` can always call `enter`
    // and `exit` on `this.state`.
    this.state = createState('noop', null, null);
    this.stateMachine = options.stateMachine;
    this.votedFor = options.votedFor;
  }

  private attachPeerRpcListeners(): void {
    this.rpcEventListeners.add(this.peerApi.onReceive({
      procedureType: 'append-entries',
      callType: 'request',
      notify: (endpoint: IEndpoint, message: IAppendEntriesRpcRequest) => {
        this.state.onAppendEntriesRpcRequest(endpoint, message);
      }
    }));
    this.rpcEventListeners.add(this.peerApi.onReceive({
      procedureType: 'append-entries',
      callType: 'response',
      notify: (endpoint: IEndpoint, message: IAppendEntriesRpcResponse) => {
        this.state.onAppendEntriesRpcResponse(endpoint, message);
      }
    }));
    this.rpcEventListeners.add(this.peerApi.onReceive({
      procedureType: 'request-vote',
      callType: 'request',
      notify: (endpoint: IEndpoint, message: IRequestVoteRpcRequest) => {
        this.state.onRequestVoteRpcRequest(endpoint, message);
      }
    }));
    this.rpcEventListeners.add(this.peerApi.onReceive({
      procedureType: 'request-vote',
      callType: 'response',
      notify: (endpoint: IEndpoint, message: IRequestVoteRpcResponse) => {
        this.state.onRequestVoteRpcResponse(endpoint, message);
      }
    }));
  }

  private detachPeerRpcListeners(): void {
    for (const rpcEventListener of this.rpcEventListeners) {
      this.rpcEventListeners.delete(rpcEventListener);
      rpcEventListener.detach();
    }
  }

  public getCluster(): ICluster {
    return this.cluster;
  }

  public getCommitIndex(): number {
    return this.commitIndex;
  }

  // The `term` is used by a `Server` in a cluster
  // to determine if it is ahead or behind of another
  // `Server` in the same cluster.
  // > *§5. "...latest term server has seen..."*
  // > *§5.1. "...Raft divides time into _terms_..."*
  public getCurrentTerm(): number {
    return this.currentTerm.getValue();
  }

  public getLastApplied(): number {
    return this.lastApplied;
  }

  public getState(): IState {
    return this.state;
  }

  // The `Server` vote is the...
  // *§5. "...candidateId that received vote in current term..."*
  public getVotedFor(): ServerId {
    return this.votedFor.getValue();
  }

  public request(request: IRequest): Promise<IResponse> {
    throw new Error('TODO');
  }

  public sendPeerRpc(message: IRpcMessage): Promise<Promise<void>[]>;
  public sendPeerRpc(
    endpoint: IEndpoint,
    message: IRpcMessage
  ): Promise<Promise<void>[]>;
  public sendPeerRpc(
    endpoints: ReadonlyArray<IEndpoint>,
    message: IRpcMessage
  ): Promise<Promise<void>[]>;
  // RPC requests can be sent to other Raft `Server`
  // instances with the `sendPeerRpc` method.
  public sendPeerRpc(
    arg0: IRpcMessage | IEndpoint | ReadonlyArray<IEndpoint>,
    arg1: IRpcMessage = null
  ): Promise<Promise<void>[]> {
    let message: IRpcMessage;
    let endpoints: ReadonlyArray<IEndpoint>;

    if (isRpcMessage(arg0)) {
      endpoints = Object.keys(this.cluster.servers)
        .filter(serverId => serverId != this.id)
        .map(serverId => this.cluster.servers[serverId]);
      message = arg0;
    } else {
      if (arg0 instanceof Array) {
        endpoints = arg0;
      } else if (isEndpoint(arg0)) {
        endpoints = [arg0];
      }
      message = arg1;
    }

    if (isRpcRequest(message)) {
      return Promise.resolve(this.peerApi.send(endpoints, message));
    } else if (isRpcResponse(message)) {
      // Before responding to an RPC request, the recipient `Server`
      // updates persistent state on stable storage.
      // > *§5. "...(Updated on stable storage before responding)..."*
      // > *§5.6 "...Raft’s RPCs...require the recipient to persist..."*
      return this.updatePersistentState().then(() =>
        this.peerApi.send(endpoints, message)
      );
    }
  }

  // When the term is updated, it is not immediately
  // persisted because, as the Raft paper says, the
  // term is part of persistent state that is:
  // > *§5. "...(Updated on stable storage before responding)..."*
  // to RPC requests.
  public setCurrentTerm(newTerm: number): void {
    this.currentTerm.setValue(newTerm);
    // The `Server` vote is the candidate the `Server`
    // voted for in the current term...
    // > *§5. "...or null if none..."*
    // When a `Server` enters a new election,
    // it has not yet voted for a candidate,
    // so its vote is set here to `null`.
    this.setVotedFor(null);
  }

  // When the vote is updated, it is not immediately
  // persisted because, as the Raft paper says, the
  // vote is part of persistent state that is...
  // > *§5. "...(Updated on stable storage before responding)..."*
  // ...to RPC requests.
  public setVotedFor(candidateId: ServerId): void {
    this.votedFor.setValue(candidateId);
  }

  // After the `Server` loads and initializes its term and vote,
  // and binds to a socket for RPC calls, it transitions to the
  // follower state:
  // > *§5. "...When servers start up, they begin as followers..."*
  public start(): Promise<void> {
    this.logger.info(`Starting Raftjs server ${this.id}`);

    // > *§5. "...Volatile state on all servers...(initialized to 0, increases monotonically)..."
    this.commitIndex = this.lastApplied = 0;

    this.logger.debug('Loading persistent state');
    return Promise.all([
      // The current term is...
      // > *§5. "...initialized to zero on first boot..."*
      this.currentTerm.readIfExistsElseSetAndWrite(0)
    ])
      .then(() => {
        this.logger.debug('Starting RPC service');
        return this.peerApi.listen(this.endpoint);
      })
      .then(() => {
        this.logger.debug('Transitioning to follower');
        this.transitionTo('follower');
      })
      .then(() => {
        this.attachPeerRpcListeners();
      })
      .then(() => this.logger.info(`Started Raftjs server ${this.id}`));
  }

  public stop(): Promise<void> {
    this.logger.info(`Stopping Raftjs server ${this.id}`);
    this.logger.debug('Exiting current state');
    this.state.exit();
    this.logger.debug('Stopping RPC service');
    this.detachPeerRpcListeners();
    return this.peerApi
      .close()
      .then(() => this.logger.info(`Stopped Raftjs server ${this.id}`));
  }

  // A `Server` transitions between multiple states:
  // follower, candidate, and leader. The [state design
  // pattern](https://en.wikipedia.org/wiki/State_pattern)
  // is used here to facilitate separating the rules of
  // these states into separate components while allowing
  // those components access to `Server` data and methods.
  public transitionTo(state: StateType | IState): void {
    const newState =
      typeof state == 'string' ? createState(state, this, this.state) : state;
    if (this.state.getType() == newState.getType()) return;
    this.state.exit();
    this.state = newState;
    this.state.enter();
  }

  // Persistent state is data read from and written
  // to stable storage (i.e. a disk).
  // > *§5. "...Persistent state on all servers..."*
  private updatePersistentState(): Promise<void> {
    return this.log
      .write()
      .then(() => this.currentTerm.write())
      .then(() => this.votedFor.write());
  }
}

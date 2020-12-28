// The central component of the `raftjs` project,
// `Server`, listens on a socket for RPC commands
// from other `Server` instances and transitions
// between follower, candidate and leader states.

import * as fs from 'fs';
import * as path from 'path';

import { ICluster } from '../cluster';
import { IDurableValue, createDurableInteger, createDurableString } from '../storage';
import { ILog, createLog } from '../log';
import { ILogger, createLogger } from '../logger';
import {
    IMessage,
    IRequest,
    IRequestTypeFilter,
    IResponse,
    IResponseTypeFilter,
    isMessage,
    isRequest,
    isResponse
} from '../message';
import { IEndpoint, isEndpoint } from '../net';
import { IRpcEventListener, IRpcReceiver, IRpcService, createRpcService } from '../rpc';
import { ITimer, createTimer } from './timer';
import { IState, StateType, StateTransition, createState } from './state';

interface IBaseCreateServerOptions {
    readonly cluster: ICluster;
    readonly electionTimer?: ITimer;
    readonly id: ServerId;
    readonly log?: ILog;
    readonly logger?: ILogger;
    readonly rpcService?: IRpcService;
}

export type ICreateServerOptions =
    IBaseCreateServerOptions & ITermOrDataDir & IVoteOrDataDir;

interface IDataDir {
    dataDir: string;
}

export interface IServer {
    readonly electionTimer: ITimer;
    readonly endpoint: IEndpoint;
    readonly cluster: ICluster;
    readonly state: IState;
    readonly id: ServerId;
    readonly log: ILog;
    readonly logger: ILogger;
    readonly rpcService: IRpcService;
    onReceiveRpc<P extends IMessage['procedureType'], C extends IMessage['callType']>(
        receiver: IRpcReceiver<P, C>
    ): IRpcEventListener;
    sendRpc(message: IMessage): Promise<void[]>;
    sendRpc(endpoint: IEndpoint, message: IMessage): Promise<void[]>;
    sendRpc(endpoints: ReadonlyArray<IEndpoint>, message: IMessage): Promise<void[]>;
    start(): Promise<void>;
    stop(): Promise<void>;
    readonly transitionTo: StateTransition;
    term: number;
    vote: ServerId;
}

export type ServerId = string;

export interface IServerOptions {
    readonly cluster: ICluster;
    readonly electionTimer: ITimer;
    readonly id: ServerId;
    readonly log: ILog;
    readonly logger: ILogger;
    readonly rpcService: IRpcService;
    readonly term: IDurableValue<number>;
    readonly vote: IDurableValue<string>;
}

interface ITerm {
    term: IDurableValue<number>;
}

type ITermOrDataDir = ITerm | IDataDir;

interface IVote {
    vote: IDurableValue<string>;
}

type IVoteOrDataDir = IVote | IDataDir;

class Server implements IServer {
    private readonly _cluster: ICluster;
    public readonly electionTimer: ITimer;
    public readonly endpoint: IEndpoint;
    public readonly id: ServerId;
    private readonly initialTerm: number;
    public readonly log: ILog;
    public readonly logger: ILogger;
    public readonly rpcService: IRpcService;
    private _state: IState;
    private _term: IDurableValue<number>;
    private _vote: IDurableValue<string>;

    constructor(options: IServerOptions) {
        this._cluster = options.cluster;
        this.electionTimer = options.electionTimer;
        this.endpoint = options.cluster.servers[options.id];
        this.id = options.id;
        this.log = options.log;
        this.logger = options.logger;
        // `noop` is not a state specified by the Raft protocol.
        // It is used here as a ["null
        // object"](https://en.wikipedia.org/wiki/Null_object_pattern) to
        // ensure that `Server` can always call `enter`
        // and `exit` on `this._state`.
        this._state = createState('noop', null);
        this.rpcService = options.rpcService;
        this._term = options.term;
        this._vote = options.vote;
    }

    public get cluster(): ICluster {
        return this._cluster;
    }

    // The `onReceive` method can be used to register a
    // receiver of RPC requests from other Raft `Server`
    // instances.
    public onReceiveRpc<P extends IMessage['procedureType'], C extends IMessage['callType']>(
        receiver: IRpcReceiver<P, C>
    ): IRpcEventListener {
        return this.rpcService.onReceive(receiver);
    }

    public get state(): IState {
        return this._state;
    }

    public sendRpc(message: IMessage): Promise<void[]>;
    public sendRpc(endpoint: IEndpoint, message: IMessage): Promise<void[]>;
    public sendRpc(endpoints: ReadonlyArray<IEndpoint>, message: IMessage): Promise<void[]>;
    // RPC requests can be sent to other Raft `Server`
    // instances with the `send` method.
    public sendRpc(
        arg0: IMessage | IEndpoint | ReadonlyArray<IEndpoint>,
        arg1: IMessage = null
    ): Promise<void[]> {
        let message: IMessage;
        let endpoints: ReadonlyArray<IEndpoint>;

        if(isMessage(arg0)) {
            endpoints = Object.keys(this.cluster.servers)
                .filter(serverId => serverId != this.id)
                .map(serverId => this.cluster.servers[serverId]);
            message = arg0;
        } else {
            if(arg0 instanceof Array) {
                endpoints = arg0;
            } else if(isEndpoint(arg0)) {
                endpoints = [arg0];
            }
            message = arg1;
        }

        if(isRequest(message)) {
            return this.rpcService.send(endpoints, message);
        } else if(isResponse(message)) {
            // Before responding to an RPC request, the recipient `Server`
            // updates persistent state on stable storage.
            // > *§5. "...(Updated on stable storage before responding)..."*  
            // > *§5.6 "...Raft’s RPCs...require the recipient to persist..."*
            return this.updatePersistentState()
                .then(() => this.rpcService.send(endpoints, message));
        }
    }

    // After the `Server` loads and initializes its term and vote,
    // and binds to a socket for RPC calls, it transitions to the
    // follower state:
    // > *§5. "...When servers start up, they begin as followers..."*
    public start(): Promise<void> {
        this.logger.info(`Starting Raftjs server ${this.id}`);

        this.logger.debug('Loading persistent state');
        return Promise.all([
                // The current term is...
                // > *§5. "...initialized to zero on first boot..."*
                this._term.read(null)
                    .then((function(value: number) {
                        if(value == null) {
                            this.logger.debug('Term was not found on persistent storage; setting to zero');
                            this.term = 0;
                        }
                    }).bind(this)),
                this._vote.read()
            ])
            .then(() => {
                this.logger.debug('Starting RPC service');
                return this.rpcService.listen(this.endpoint);
            })
            .then(() => {
                this.logger.debug('Transitioning to follower');
                this.transitionTo('follower');
            })
            .then(() => this.logger.info(`Started Raftjs server ${this.id}`));
    }

    public stop(): Promise<void> {
        this.logger.info(`Stopping Raftjs server ${this.id}`);
        this.logger.debug('Exiting current state');
        this.state.exit();
        this.logger.debug('Stopping RPC service');
        return this.rpcService.close()
        .then(() => this.logger.info(`Stopped Raftjs server ${this.id}`));
    }

    // A `Server` transitions between multiple states:
    // follower, candidate, and leader. The [state design
    // pattern](https://en.wikipedia.org/wiki/State_pattern)
    // is used here to facilitate separating the rules of
    // these states into separate components while allowing
    // those components access to `Server` data and methods.
    public transitionTo(state: StateType | IState): void {
        const newState = typeof state == 'string' ? createState(state, this) : state;
        if(this._state.type == newState.type) return;
        this._state.exit();
        this._state = newState;
        this._state.enter();
    }

    // The `term` is used by a `Server` in a cluster
    // to determine if it is ahead or behind of another
    // `Server` in the same cluster.
    // > *§5. "...latest term server has seen..."*
    // > *§5.1. "...Raft divides time into _terms_..."*
    public get term(): number {
        return this._term.value;
    }

    // When the term is updated, it is not immediately
    // persisted because, as the Raft paper says, the
    // term is part of persistent state that is:
    // > *§5. "...(Updated on stable storage before responding)..."*  
    // to RPC requests.
    public set term(newTerm: number) {
        this._term.value = newTerm;
        // The `Server` vote is the candidate the `Server`
        // voted for in the current term...
        // > *§5. "...or null if none..."*
        // When a `Server` enters a new election,
        // it has not yet voted for a candidate,
        // so its vote is set here to `null`.
        this.vote = null;
    }

    // Persistent state is data read from and written
    // to stable storage (i.e. a disk).
    // > *§5. "...Persistent state on all servers..."*
    private updatePersistentState(): Promise<void> {
        return this.log.write()
            .then(() => this._term.write())
            .then(() => this._vote.write());
    }

    // The `Server` vote is the...
    // *§5. "...candidateId that received vote in current term..."*
    public get vote(): ServerId {
        return this._vote.value;
    }

    // When the vote is updated, it is not immediately
    // persisted because, as the Raft paper says, the
    // vote is part of persistent state that is...
    // > *§5. "...(Updated on stable storage before responding)..."*  
    // ...to RPC requests.
    public set vote(candidateId: ServerId) {
        this._vote.value = candidateId;
    }
}

// The `createServer` method produces a `Server` configured
// by the provided `options`.
export function createServer(options: ICreateServerOptions): IServer {
    let term: IDurableValue<number>;
    if('term' in options) {
        term = options.term;
    } else if('dataDir' in options) {
        term = createDurableInteger(path.join(options.dataDir, 'term'));
    } else {
        throw new Error('Must supply either term or dataDir');
    }

    let vote: IDurableValue<string>;
    if('vote' in options) {
        vote = options.vote;
    } else if('dataDir' in options) {
        vote = createDurableString(path.join(options.dataDir, 'vote'));
    } else {
        throw new Error('Must supply either vote or dataDir');
    }

    return new Server({
        cluster: options.cluster,
        electionTimer: options.electionTimer || createTimer(),
        id: options.id,
        log: options.log || createLog(),
        logger: options.logger || createLogger(),
        rpcService: options.rpcService || createRpcService(),
        term,
        vote
    });
}

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
    IRpcMessage,
    IRpcRequest,
    IRpcResponse,
    isRpcMessage,
    isRpcRequest,
    isRpcResponse
} from './rpc/message';
import { IEndpoint, isEndpoint } from '../net';
import { IRpcEventListener, IRpcReceiver, IRpcService, createRpcService } from './rpc';
import { ITimer, createTimer } from './timer';
import { IState, StateType, StateTransition, createState } from './state';

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

export interface IServer {
    readonly electionTimer: ITimer;
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
    onReceiveRpc<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        receiver: IRpcReceiver<P, C>
    ): IRpcEventListener;
    sendRpc(message: IRpcMessage): Promise<Promise<void>[]>;
    sendRpc(endpoint: IEndpoint, message: IRpcMessage): Promise<Promise<void>[]>;
    sendRpc(endpoints: ReadonlyArray<IEndpoint>, message: IRpcMessage): Promise<Promise<void>[]>;
    setCurrentTerm(newTerm: number): void;
    setVotedFor(candidateId: ServerId): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    transitionTo(state: StateType | IState): void;
}

export type ServerId = string;

export interface IServerOptions {
    readonly cluster: ICluster;
    readonly currentTerm: IDurableValue<number>;
    readonly electionTimer: ITimer;
    readonly id: ServerId;
    readonly log: ILog;
    readonly logger: ILogger;
    readonly peerApi: IRpcService;
    readonly votedFor: IDurableValue<string>;
}

interface ICurrentTerm {
    currentTerm: IDurableValue<number>;
}

type ICurrentTermOrDataDir = ICurrentTerm | IDataDir;

interface IVotedFor {
    votedFor: IDurableValue<string>;
}

type IVotedForOrDataDir = IVotedFor | IDataDir;

class Server implements IServer {
    private readonly cluster: ICluster;
    private commitIndex: number;
    private currentTerm: IDurableValue<number>;
    public readonly electionTimer: ITimer;
    public readonly endpoint: IEndpoint;
    public readonly id: ServerId;
    private readonly initialTerm: number;
    private lastApplied: number;
    public readonly log: ILog;
    public readonly logger: ILogger;
    public readonly peerApi: IRpcService;
    private state: IState;
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
        // `noop` is not a state specified by the Raft protocol.
        // It is used here as a ["null
        // object"](https://en.wikipedia.org/wiki/Null_object_pattern) to
        // ensure that `Server` can always call `enter`
        // and `exit` on `this.state`.
        this.state = createState('noop', null);
        this.votedFor = options.votedFor;
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

    // The `onReceive` method can be used to register a
    // receiver of RPC requests from other Raft `Server`
    // instances.
    public onReceiveRpc<P extends IRpcMessage['procedureType'], C extends IRpcMessage['callType']>(
        receiver: IRpcReceiver<P, C>
    ): IRpcEventListener {
        return this.peerApi.onReceive(receiver);
    }

    // *> *§5.3 "...Once a leader has been elected, it begins servicing client requests...*
    public request(command: Uint8Array): Promise<Uint8Array> {
        /*
        if(this.getState().type !== 'leader') {
            return Promise.reject();
        }
        const commandQueue = this.commandQueue;
        return new Promise((resolve, reject) => {
            const invertedPromise = new InvertedPromise(resolve, reject);
            commandQueue.add(command, invertedPromise);
        });
        */
        // *> *§5.3 "... The leader appends the command to its log as a new entry...*
        this.log.append({
            command,
            index: this.log.getNextIndex(),
            term: this.getCurrentTerm()
        });
        return this.log.write().then(() => {
            // *> *§5.3 "...then issues AppendEntries RPCs in parallel...*
            return Promise.resolve(Buffer.alloc(0))
        })
    }

    public sendRpc(message: IRpcMessage): Promise<Promise<void>[]>;
    public sendRpc(endpoint: IEndpoint, message: IRpcMessage): Promise<Promise<void>[]>;
    public sendRpc(endpoints: ReadonlyArray<IEndpoint>, message: IRpcMessage): Promise<Promise<void>[]>;
    // RPC requests can be sent to other Raft `Server`
    // instances with the `send` method.
    public sendRpc(
        arg0: IRpcMessage | IEndpoint | ReadonlyArray<IEndpoint>,
        arg1: IRpcMessage = null
    ): Promise<Promise<void>[]> {
        let message: IRpcMessage;
        let endpoints: ReadonlyArray<IEndpoint>;

        if(isRpcMessage(arg0)) {
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

        if(isRpcRequest(message)) {
            return Promise.resolve(this.peerApi.send(endpoints, message));
        } else if(isRpcResponse(message)) {
            // Before responding to an RPC request, the recipient `Server`
            // updates persistent state on stable storage.
            // > *§5. "...(Updated on stable storage before responding)..."*  
            // > *§5.6 "...Raft’s RPCs...require the recipient to persist..."*
            return this.updatePersistentState()
                .then(() => this.peerApi.send(endpoints, message));
        }
    }

    // When the term is updated, it is not immediately
    // persisted because, as the Raft paper says, the
    // term is part of persistent state that is:
    // > *§5. "...(Updated on stable storage before responding)..."*  
    // to RPC requests.
    public setCurrentTerm(newTerm: number) {
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
                this.currentTerm.readIfExistsElseSetAndWrite(0),
            ])
            .then(() => {
                this.logger.debug('Starting RPC service');
                return this.peerApi.listen(this.endpoint);
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
        return this.peerApi.close()
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
        if(this.state.type == newState.type) return;
        this.state.exit();
        this.state = newState;
        this.state.enter();
    }

    // Persistent state is data read from and written
    // to stable storage (i.e. a disk).
    // > *§5. "...Persistent state on all servers..."*
    private updatePersistentState(): Promise<void> {
        return this.log.write()
            .then(() => this.currentTerm.write())
            .then(() => this.votedFor.write());
    }
}

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

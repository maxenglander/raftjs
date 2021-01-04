import { IEndpoint } from '../../net/endpoint';
import { IRpcMessage, IAppendEntriesRpcRequest, createAppendEntriesRpcResponse } from '../rpc/message';
import { IRpcEventListener } from '../rpc';
import { IServer } from '../';
import { IState, StateType } from './';
import { compilerError } from '../../util/compiler-error';

// The base server state is not named as such in
// the Raft paper, but is used in the `raftjs`
// project as a way to share functionality
// with the named states (follower, candidate,
// leader).
export class BaseState implements IState {
    public readonly type: StateType;

    protected readonly server: IServer;

    private rpcEventListeners: Set<IRpcEventListener>;

    constructor(server: IServer, stateType: StateType) {
        this.rpcEventListeners = new Set<IRpcEventListener>();
        this.server = server;
        this.onAppendEntriesRequestBase = this.onAppendEntriesRequestBase.bind(this);
        this.onRequestOrResponse = this.onRequestOrResponse.bind(this);
        this.transitionTo = this.transitionTo.bind(this);
        this.type = stateType;
    }

    protected addRpcEventListener(rpcEventListener: IRpcEventListener): void {
        this.rpcEventListeners.add(rpcEventListener);
    }

    public enter(): void {
        this.addRpcEventListener(this.server.onReceivePeerRpc({
            procedureType: 'append-entries',
            callType: 'request',
            notify: this.onAppendEntriesRequestBase
        }));
        this.addRpcEventListener(this.server.onReceivePeerRpc({
            procedureType: 'append-entries',
            callType: 'request',
            notify: this.onRequestOrResponse
        }));
        this.addRpcEventListener(this.server.onReceivePeerRpc({
            procedureType: 'append-entries',
            callType: 'response',
            notify: this.onRequestOrResponse
        }));
        this.addRpcEventListener(this.server.onReceivePeerRpc({
            procedureType: 'request-vote',
            callType: 'request',
            notify: this.onRequestOrResponse
        }));
        this.addRpcEventListener(this.server.onReceivePeerRpc({
            procedureType: 'request-vote',
            callType: 'response',
            notify: this.onRequestOrResponse
        }));
    }

    public exit(): void {
        for(const rpcEventListener of this.rpcEventListeners) {
            this.rpcEventListeners.delete(rpcEventListener);
            rpcEventListener.detach();
        }
    }

    // This method is a stub for a Raft response to an
    // AppendEntries RPC request. At the present time,
    // it only handles responding to heartbeats.
    // > *§5. "...Receiver implementation:..."*  
    private onAppendEntriesRequestBase(
        endpoint: IEndpoint,
        message: IAppendEntriesRpcRequest
    ): void {
        this.server.sendPeerRpc(endpoint, createAppendEntriesRpcResponse({
            // When another `Server` makes an `AppendEntries` RPC
            // request with a `term` less than the `term` on this
            // `Server`, the RPC request is rejected.
            // > *§5. "...false if term < currentTerm..."*  
            success: message.arguments.term >= this.server.getCurrentTerm(),
            term: this.server.getCurrentTerm()
        }));
    }

    private onRequestOrResponse(endpoint: IEndpoint, message: IRpcMessage): void {
        this.server.logger.trace(`Received ${message.procedureType} ${message.callType} from ${endpoint.toString()}`);
        const callType: IRpcMessage['callType'] = message.callType;

        let term: number;

        switch(callType) {
            case 'request':
                term = message.arguments.term;
                break;
            case 'response':
                term = message.results.term;
                break;
            default:
                // Used by TypeScript for [exhaustiveness
                // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
                compilerError(callType);
                break;
        }

        const server = this.server;
        const currentTerm = server.getCurrentTerm();

        // Whenever Raft server's communicate to each other, they
        // exchange their current term, and, if one server's term
        // is less than anothers, it updates it's own term to the
        // other's, and converts to a follower.
        // > *§5. "...If RPC request or response contains..."*  
        // > *§5.1. "...If one server's current term is smaller..."*  
        if(term > currentTerm) {
            this.server.logger.trace(`Received a message with a term (${term}) higher than the server term (${currentTerm}); transitioning to follower`);
            server.setCurrentTerm(term);
            this.transitionTo('follower');
        }
    }

    protected transitionTo(stateType: StateType): void {
        if(stateType != this.type) {
            this.server.transitionTo(stateType);
        }
    }
}

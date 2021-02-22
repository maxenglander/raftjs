import { IEndpoint } from '../net/endpoint';
import {
  IRpcMessage,
  IAppendEntriesRpcRequest,
  IAppendEntriesRpcResponse,
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse,
  createAppendEntriesRpcResponse
} from '../rpc/message';
import { IRpcEventListener } from '../rpc';
import { IServer } from '../';
import { IState, StateType } from './';
import { compilerError } from '../util/compiler-error';

// The base server state is not named as such in
// the Raft paper, but is used in the `raftjs`
// project as a way to share functionality
// with the named states (follower, candidate,
// leader).
export class BaseState implements IState {
  protected readonly server: IServer;

  private leaderEndpoint: IEndpoint;

  constructor(server: IServer, lastState?: IState) {
    if(lastState) {
      this.leaderEndpoint = lastState.getLeaderEndpoint();
    }
    this.server = server;
  }

  public enter(): void {}

  public exit(): void {}

  public getLeaderEndpoint(): IEndpoint {
    return this.leaderEndpoint;
  }

  public getType(): StateType {
    return null;
  }

  public isLeader(): boolean {
    return false;
  }

  // This method is a stub for a Raft response to an
  // AppendEntries RPC request. At the present time,
  // it only handles responding to heartbeats.
  // > *§5. "...Receiver implementation:..."*
  public onAppendEntriesRpcRequest(
    endpoint: IEndpoint,
    message: IAppendEntriesRpcRequest
  ): void {
    const success = message.arguments.term >= this.server.getCurrentTerm();
    if(success) {
      this.leaderEndpoint = endpoint;
    }
    this.server.sendPeerRpc(
      endpoint,
      createAppendEntriesRpcResponse({
        // When another `Server` makes an `AppendEntries` RPC
        // request with a `term` less than the `term` on this
        // `Server`, the RPC request is rejected.
        // > *§5. "...false if term < currentTerm..."*
        success,
        term: this.server.getCurrentTerm()
      })
    ).then(() => {
      this.onRequestOrResponse(endpoint, message);
    });
  }

  public onAppendEntriesRpcResponse(
    endpoint: IEndpoint,
    message: IAppendEntriesRpcResponse
  ): void {
    this.onRequestOrResponse(endpoint, message);
  }

  public onRequestVoteRpcRequest(
    endpoint: IEndpoint,
    message: IRequestVoteRpcRequest
  ): void {
    this.onRequestOrResponse(endpoint, message);
  }

  public onRequestVoteRpcResponse(
    endpoint: IEndpoint,
    message: IRequestVoteRpcResponse
  ): void {
    this.onRequestOrResponse(endpoint, message);
  }

  private onRequestOrResponse(endpoint: IEndpoint, message: IRpcMessage): void {
    this.server.logger.trace(
      `Received ${message.procedureType} ${
        message.callType
      } from ${endpoint.toString()}`
    );
    const callType: IRpcMessage['callType'] = message.callType;

    let term: number;

    switch (callType) {
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

    // Whenever Raft servers communicate to each other, they
    // exchange their current term. If one server's term
    // is less than anothers, it updates it's own term to the
    // other's, and transitions to a follower.
    // > *§5. "...If RPC request or response contains..."*
    // > *§5.1. "...If one server's current term is smaller..."*
    if (term > this.server.getCurrentTerm()) {
      this.server.logger.trace(
        `Received a message with a term (${term}) higher than the server term (${this.server.getCurrentTerm()}); transitioning to follower`
      );
      this.server.setCurrentTerm(term);
      this.server.transitionTo('follower');
    }
  }
}

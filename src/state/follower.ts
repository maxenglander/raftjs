import {
  IAppendEntriesRpcRequest,
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse,
  IRpcMessage,
  createAppendEntriesRpcResponse,
  createRequestVoteRpcResponse,
  isAppendEntriesRpcRequest,
  isRequestVoteRpcRequest
} from '../rpc/message';
import { IEndpoint } from '../net/endpoint';
import { IServer } from '../';
import { IState, StateType } from './@types';

// Followers:
// > *§5. "...Respond to RPC requests from candidates and leaders..."*
//
// Followers remain in that state until either:
// > *§5. "...an election timeout elapses without receiving AppendEntries RPC from
// current leader or granting vote to candidate..."*
export class FollowerState implements IState {
  private readonly server: IServer;
  private leaderEndpoint: IEndpoint;

  constructor(server: IServer, leaderEndpoint: IEndpoint) {
    this.server = server;
    this.leaderEndpoint = leaderEndpoint;
  }

  public enter(): void {
    this.server.electionTimer.on('timeout', this.onTimeout.bind(this));
    this.server.logger.debug(
      `Starting election timer with timeout ${this.server.electionTimer.getTimeout()}ms`
    );
    this.server.electionTimer.start();
  }

  public exit(): void {
    this.server.electionTimer.stop();
    this.server.electionTimer.off('timeout', this.onTimeout.bind(this));
  }

  public getLeaderEndpoint(): IEndpoint {
    return this.leaderEndpoint;
  }

  public getType(): StateType {
    return 'follower';
  }

  // This method is a stub for a Raft response to an
  // AppendEntries RPC request. At the present time,
  // it only handles responding to heartbeats.
  // > *§5. "...Receiver implementation:..."*
  private async handleAppendEntriesRpcRequest(
    endpoint: IEndpoint,
    message: IAppendEntriesRpcRequest
  ): Promise<void> {
    // One of the conditions for a follower resetting
    // its election timer is:
    // > *§5. "...receiving AppendEntries RPC from current leader..."*
    this.server.electionTimer.reset();
    const success = message.arguments.term >= this.server.getCurrentTerm();
    if(success) {
      this.leaderEndpoint = endpoint;
    }
    await this.server.sendPeerRpcMessage(
      endpoint,
      createAppendEntriesRpcResponse({
        // When another `Server` makes an `AppendEntries` RPC
        // request with a `term` less than the `term` on this
        // `Server`, the RPC request is rejected.
        // > *§5. "...false if term < currentTerm..."*
        success,
        term: this.server.getCurrentTerm()
      })
    );
  }

  public async handlePeerRpcMessage(endpoint: IEndpoint, message: IRpcMessage): Promise<void> {
    if(isAppendEntriesRpcRequest(message)) {
      await this.handleAppendEntriesRpcRequest(endpoint, message);
    }
    if(isRequestVoteRpcRequest(message)) {
      await this.handleRequestVoteRpcRequest(endpoint, message);
    }
  }

  //
  private async handleRequestVoteRpcRequest(
    endpoint: IEndpoint,
    message: IRequestVoteRpcRequest
  ): Promise<void> {
    const currentTerm = this.server.getCurrentTerm(),
      vote = this.server.getVotedFor(),
      { electionTimer } = this.server,
      // A receiver of RequestVote RPC will:
      // > *§5. "...reply false if term < currentTerm..."*
      voteGranted =
        message.arguments.term >= currentTerm &&
        (vote == null || vote == message.arguments.candidateId);

    if (voteGranted) {
      this.server.logger.trace(
        `Granting vote request from server ${endpoint.toString()}`
      );
    } else {
      this.server.logger.trace(
        `Denying vote request from server ${endpoint.toString()}`
      );
    }

    await this.server.sendPeerRpcMessage(
      endpoint,
      createRequestVoteRpcResponse({
        term: currentTerm,
        voteGranted
      })
    );

    // One of the conditions for a follower resetting
    // its election timer is:
    // > *§5. "...granting vote to candidate..."*
    if (voteGranted) {
      electionTimer.reset();
    }
  }

  public isLeader(): boolean {
    return false;
  }

  // When the election timeout elapses without the follower
  // receiving either an `AppendEntries` RPC from the leader
  // or granting a vote to a candidate, the follower
  // begins an election by converting to a candidate.
  // > *§5.1 * "If a follower receives no communication, it becomes a candidate and initiates an election."*
  private onTimeout() {
    this.server.logger.debug('Timer elapsed; transitioning to candidate');
    this.server.transitionTo('candidate');
  }
}

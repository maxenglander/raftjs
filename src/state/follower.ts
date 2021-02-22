import {
  IAppendEntriesRpcRequest,
  IRequestVoteRpcRequest,
  IRequestVoteRpcResponse,
  createRequestVoteRpcResponse
} from '../rpc/message';
import { IEndpoint } from '../net/endpoint';
import { IServer } from '../';
import { IState, StateType } from './@types';
import { BaseState } from './base';

// Followers:
// > *§5. "...Respond to RPC requests from candidates and leaders..."*
//
// Followers remain in that state until either:
// > *§5. "...an election timeout elapses without receiving AppendEntries RPC from
// current leader or granting vote to candidate..."*
export class FollowerState extends BaseState {
  constructor(server: IServer, lastState: IState) {
    super(server, lastState);
  }

  public enter(): void {
    super.enter();
    this.server.electionTimer.on('timeout', this.onTimeout.bind(this));
    this.server.logger.debug(
      `Starting election timer with timeout ${this.server.electionTimer.getTimeout()}ms`
    );
    this.server.electionTimer.start();
  }

  public exit(): void {
    this.server.electionTimer.stop();
    this.server.electionTimer.off('timeout', this.onTimeout.bind(this));
    super.exit();
  }

  public getType(): StateType {
    return 'follower';
  }

  // One of the conditions for a follower resetting
  // its election timer is:
  // > *§5. "...receiving AppendEntries RPC from current leader..."*
  public onAppendEntriesRpcRequest(endpoint: IEndpoint, message: IAppendEntriesRpcRequest): void {
    super.onAppendEntriesRpcRequest(endpoint, message);
    this.server.electionTimer.reset();
  }

  //
  public onRequestVoteRpcRequest(
    endpoint: IEndpoint,
    message: IRequestVoteRpcRequest
  ): void {
    super.onRequestVoteRpcRequest(endpoint, message);

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

    this.server
      .sendPeerRpc(
        endpoint,
        createRequestVoteRpcResponse({
          term: currentTerm,
          voteGranted
        })
      )
      .then(function() {
        // One of the conditions for a follower resetting
        // its election timer is:
        // > *§5. "...granting vote to candidate..."*
        if (voteGranted) {
          electionTimer.reset();
        }
      });
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

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
import { IRequest, IResponse } from '../api';
import { IEndpoint } from '../net/endpoint';
import { IServerContext } from '../';
import { IState, StateType } from './types';

// Followers:
// > *§5. "...Respond to RPC requests from candidates and leaders..."*
//
// Followers remain in that state until either:
// > *§5. "...an election timeout elapses without receiving AppendEntries RPC from
// current leader or granting vote to candidate..."*
export class FollowerState implements IState {
  private readonly serverContext: IServerContext;
  private leaderId: string;

  constructor(serverContext: IServerContext, leaderId: string) {
    this.handleAppendEntriesRpcRequest = this.handleAppendEntriesRpcRequest.bind(this);
    this.leaderId = leaderId;
    this.serverContext = serverContext;
  }

  public enter(): void {
    this.serverContext.electionTimer.on('timeout', this.onTimeout.bind(this));
    this.serverContext.logger.debug(
      `Starting election timer with timeout ${this.serverContext.electionTimer.getTimeout()}ms`
    );
    this.serverContext.electionTimer.start();
  }

  public async execute(request: IRequest): Promise<IResponse> {
    if (this.leaderId == null) {
      return {
        error: 'interregnum'
      };
    } else {
      return {
        error: 'not-leader',
        redirectTo: {
          leaderId: this.leaderId
        }
      };
    }
  }

  public exit(): void {
    this.serverContext.electionTimer.stop();
    this.serverContext.electionTimer.off('timeout', this.onTimeout.bind(this));
  }

  public getLeaderId(): string {
    return this.leaderId;
  }

  public getType(): StateType {
    return 'follower';
  }

  // > *§5. "...Receiver implementation:..."*
  private async handleAppendEntriesRpcRequest(
    endpoint: IEndpoint,
    message: IAppendEntriesRpcRequest
  ): Promise<void> {
    this.leaderId = message.arguments.leaderId;

    // One of the conditions for a follower resetting
    // its election timer is:
    // > *§5. "...receiving AppendEntries RPC from current leader..."*
    this.serverContext.electionTimer.reset();

    // > *§5. "Reply false if term < currentTerm..."*
    if (message.arguments.term < this.serverContext.getCurrentTerm()) {
      return await this.serverContext.sendRpcMessage(
        endpoint,
        createAppendEntriesRpcResponse({
          // The followerCommit and followerId fields is not part of the Raft spec.
	  // They are details of this implementation which allow the server to
	  // easily update nextIndex and matchIndex upon receiving append entries
	  // responses.
          followerCommit: this.serverContext.getCommitIndex(), 
	  followerId: this.serverContext.id,
          // When another `Server` makes an `AppendEntries` RPC
          // request with a `term` less than the `term` on this
          // `Server`, the RPC request is rejected.
          // > *§5. "...false if term < currentTerm..."*
          success: false,
          term: this.serverContext.getCurrentTerm()
        })
      );
    }

    // > *§5. "Reply false if log doesn’t contain an entry at prevLogIndex whose term matches prevLogTerm..."*
    if (!(
         this.serverContext.log.hasEntry(message.arguments.prevLogIndex)
      && this.serverContext.log.getEntry(message.arguments.prevLogIndex).term == message.arguments.prevLogTerm
    )) {
      return await this.serverContext.sendRpcMessage(
        endpoint,
        createAppendEntriesRpcResponse({
          // The followerCommit and followerId fields is not part of the Raft spec.
	  // They are details of this implementation which allow the server to
	  // easily update nextIndex and matchIndex upon receiving append entries
	  // responses.
          followerCommit: this.serverContext.getCommitIndex(), 
	  followerId: this.serverContext.id,
          // When another `Server` makes an `AppendEntries` RPC
          // request with a `term` less than the `term` on this
          // `Server`, the RPC request is rejected.
          // > *§5. "...false if term < currentTerm..."*
          success: false,
          term: this.serverContext.getCurrentTerm()
        })
      );
    }

    for (const entry of message.arguments.entries) {
      // > *§5. "If an existing entry conflicts with a new one..."*
      if (this.serverContext.log.hasEntry(entry.index)) {
        // > *§5. "...same index but different terms..."*
        if (entry.term !== this.serverContext.log.getLastTerm()) {
          // > *§5. "...delete the existing entry and all that follow it"*
          this.serverContext.log.truncateAt(entry.index);
        }
      } else {
        // > *§5. "Append any new entries not already in the log"*
        if (entry.index == this.serverContext.log.getNextIndex()) {
          this.serverContext.log.append(entry);
        }
      }
    }

    // > *§5. "...If leaderCommit > commitIndex..."*
    if (message.arguments.leaderCommit > this.serverContext.getCommitIndex()) {
      const indexOfLastNewEntry = message.arguments.entries.length > 0
        ? message.arguments.entries[message.arguments.entries.length - 1].index
	: Number.MAX_SAFE_INTEGER;
      // > *§5. "...set commitIndex = min(leaderCommit, index of last new entry)..."*
      this.serverContext.setCommitIndexAndExecuteUnapplied(Math.min(message.arguments.leaderCommit, indexOfLastNewEntry));
    }

    await this.serverContext.sendRpcMessage(
      endpoint,
      createAppendEntriesRpcResponse({
        // The followerCommit and followerId fields is not part of the Raft spec.
	// They are details of this implementation which allow the server to
	// easily update nextIndex and matchIndex upon receiving append entries
	// responses.
        followerCommit: this.serverContext.getCommitIndex(), 
	followerId: this.serverContext.id,
        success: true,
        term: this.serverContext.getCurrentTerm()
      })
    );
  }

  public async handleRpcMessage(endpoint: IEndpoint, message: IRpcMessage): Promise<void> {
    if (isAppendEntriesRpcRequest(message)) {
      await this.handleAppendEntriesRpcRequest(endpoint, message);
    } else if (isRequestVoteRpcRequest(message)) {
      await this.handleRequestVoteRpcRequest(endpoint, message);
    }
  }

  //
  private async handleRequestVoteRpcRequest(
    endpoint: IEndpoint,
    message: IRequestVoteRpcRequest
  ): Promise<void> {
    const currentTerm = this.serverContext.getCurrentTerm(),
      vote = this.serverContext.getVotedFor(),
      { electionTimer } = this.serverContext,
      // A receiver of RequestVote RPC will:
      // > *§5. "...reply false if term < currentTerm..."*
      voteGranted =
        message.arguments.term >= currentTerm &&
        (vote == null || vote == message.arguments.candidateId);

    if (voteGranted) {
      this.serverContext.logger.trace(
        `Granting vote request from server ${endpoint.toString()}`
      );
    } else {
      this.serverContext.logger.trace(
        `Denying vote request from server ${endpoint.toString()}`
      );
    }

    await this.serverContext.sendRpcMessage(
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
    this.serverContext.logger.debug('Timer elapsed; transitioning to candidate');
    this.serverContext.transitionTo('candidate');
  }
}

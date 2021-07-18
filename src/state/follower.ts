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
import { IClientRequest, IClientResponse } from '../api/client';
import { IEndpoint } from '../net/endpoint';
import { IServer } from '../';
import { IState, StateType } from './types';

// Followers:
// > *§5. "...Respond to RPC requests from candidates and leaders..."*
//
// Followers remain in that state until either:
// > *§5. "...an election timeout elapses without receiving AppendEntries RPC from
// current leader or granting vote to candidate..."*
export class FollowerState implements IState {
  private readonly server: IServer;
  private leaderId: string;

  constructor(server: IServer, leaderId: string) {
    this.handleAppendEntriesRpcRequest = this.handleAppendEntriesRpcRequest.bind(this);
    this.leaderId = leaderId;
    this.server = server;
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

  public getLeaderId(): string {
    return this.leaderId;
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
    this.leaderId = message.arguments.leaderId;

    // One of the conditions for a follower resetting
    // its election timer is:
    // > *§5. "...receiving AppendEntries RPC from current leader..."*
    this.server.electionTimer.reset();

    // > *§5. "Reply false if term < currentTerm..."*
    if (message.arguments.term < this.server.getCurrentTerm()) {
      return await this.server.sendRpcMessage(
        endpoint,
        createAppendEntriesRpcResponse({
          // The followerCommit and followerId fields is not part of the Raft spec.
	  // They are details of this implementation which allow the server to
	  // easily update nextIndex and matchIndex upon receiving append entries
	  // responses.
          followerCommit: this.server.getCommitIndex(), 
	  followerId: this.server.id,
          // When another `Server` makes an `AppendEntries` RPC
          // request with a `term` less than the `term` on this
          // `Server`, the RPC request is rejected.
          // > *§5. "...false if term < currentTerm..."*
          success: false,
          term: this.server.getCurrentTerm()
        })
      );
    }

    // > *§5. "Reply false if log doesn’t contain an entry at prevLogIndex whose term matches prevLogTerm..."*
    if (!(
         this.server.log.hasEntry(message.arguments.prevLogIndex)
      && this.server.log.getEntry(message.arguments.prevLogIndex).term == message.arguments.prevLogTerm
    )) {
      return await this.server.sendRpcMessage(
        endpoint,
        createAppendEntriesRpcResponse({
          // The followerCommit and followerId fields is not part of the Raft spec.
	  // They are details of this implementation which allow the server to
	  // easily update nextIndex and matchIndex upon receiving append entries
	  // responses.
          followerCommit: this.server.getCommitIndex(), 
	  followerId: this.server.id,
          // When another `Server` makes an `AppendEntries` RPC
          // request with a `term` less than the `term` on this
          // `Server`, the RPC request is rejected.
          // > *§5. "...false if term < currentTerm..."*
          success: false,
          term: this.server.getCurrentTerm()
        })
      );
    }

    for (const entry of message.arguments.entries) {
      // > *§5. "If an existing entry conflicts with a new one..."*
      if (this.server.log.hasEntry(entry.index)) {
        // > *§5. "...same index but different terms..."*
        if (entry.term !== this.server.log.getLastTerm()) {
          // > *§5. "...delete the existing entry and all that follow it"*
          this.server.log.truncateAt(entry.index);
        }
      } else {
        // > *§5. "Append any new entries not already in the log"*
        if (entry.index == this.server.log.getNextIndex()) {
          this.server.log.append(entry);
        }
      }
    }

    // > *§5. "...If leaderCommit > commitIndex..."*
    if (message.arguments.leaderCommit > this.server.getCommitIndex()) {
      const indexOfLastNewEntry = message.arguments.entries.length > 0
        ? message.arguments.entries[message.arguments.entries.length - 1].index
	: Number.MAX_SAFE_INTEGER;
      // > *§5. "...set commitIndex = min(leaderCommit, index of last new entry)..."*
      this.server.setCommitIndex(Math.min(message.arguments.leaderCommit, indexOfLastNewEntry));
    }

    await this.server.sendRpcMessage(
      endpoint,
      createAppendEntriesRpcResponse({
        // The followerCommit and followerId fields is not part of the Raft spec.
	// They are details of this implementation which allow the server to
	// easily update nextIndex and matchIndex upon receiving append entries
	// responses.
        followerCommit: this.server.getCommitIndex(), 
	followerId: this.server.id,
        success: true,
        term: this.server.getCurrentTerm()
      })
    );
  }

  public async handleClientRequest(request: IClientRequest): Promise<IClientResponse> {
    if (this.leaderId == null) {
      return {
        error: 'no-leader'
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

    await this.server.sendRpcMessage(
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

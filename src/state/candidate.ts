import {
  IAppendEntriesRpcRequest,
  IRequestVoteRpcResponse,
  IRpcMessage,
  createRequestVoteRpcRequest,
  isAppendEntriesRpcRequest,
  isRequestVoteRpcResponse
} from '../rpc/message';
import { IRequest, IResponse } from '../api';
import { IEndpoint } from '../net/endpoint';
import { IServerContext } from '../';
import { IState, StateType } from './types';

// A candidate:
// > *§5.1 "...votes for itself and issues RequestVote RPCs in parallel..."*
//
// A candidate continues in this state until either:
// > *§5.1 "...(a) it wins the election..."*
// > *§5.1 "...(b) another server establishes itself as leader..."*
// > *§5.1 "...(c) a period of time goes by with no winner..."*
export class CandidateState implements IState {
  private readonly serverContext: IServerContext;
  private serverVotes: Set<string>;

  constructor(serverContext: IServerContext) {
    this.serverContext = serverContext;
  }

  // Upon transitioning from a follower to a candidate,
  // a candidate immediately starts an election.
  // > *§5. "...On conversion to candidate, start election..."*
  public enter(): void {
    this.serverContext.electionTimer.on('timeout', this.onTimeout.bind(this));
    this.startElection();
  }

  public async execute(request: IRequest): Promise<IResponse> {
    return {
      error: 'interregnum'
    };
  }

  public exit(): void {
    this.serverContext.electionTimer.stop();
    this.serverContext.electionTimer.off('timeout', this.onTimeout);
  }

  public getLeaderId(): string {
    return null;
  }

  public getType(): StateType {
    return 'candidate';
  }

  private async handleAppendEntriesRpcRequest(endpoint: IEndpoint, message: IAppendEntriesRpcRequest): Promise<void> {
    // When a candidate receives an AppendEntries RPC
    // request from a leader with a term greater or equal
    // to its own, it converts to a follower.
    // > *§5. "...If AppendEntries RPC received from new leader..."*
    // > *§5.2. "...While waiting for votes, a candidate may..."*
    if(message.arguments.term >= this.serverContext.getCurrentTerm()) {
      this.serverContext.logger.trace(
        `Received append-entries request from ${endpoint}; transitioning to follower.`
      );
      this.serverContext.transitionTo('follower', message.arguments.leaderId);
    }
  }

  private async handleRequestVoteRpcResponse(endpoint: IEndpoint, message: IRequestVoteRpcResponse): Promise<void> {
    if (message.results.voteGranted) {
      this.tallyVote(endpoint);
    }
  }

  public async handleRpcMessage(endpoint: IEndpoint, message: IRpcMessage): Promise<void> { 
    if(isAppendEntriesRpcRequest(message)) {
      await this.handleAppendEntriesRpcRequest(endpoint, message);
    } else if(isRequestVoteRpcResponse(message)) {
      this.handleRequestVoteRpcResponse(endpoint, message);
    }
  }

  private incrementTerm(): void {
    const nextTerm = this.serverContext.getCurrentTerm() + 1;
    this.serverContext.logger.trace(`Incrementing term to ${nextTerm}`);
    this.serverContext.setCurrentTerm(nextTerm);
  }

  public isLeader(): boolean {
    return false;
  }

  // A candidate obtains a majority when it receives
  // `(# servers / 2) + 1` votes.
  private isMajorityObtained(): boolean {
    const numServers = Object.keys(this.serverContext.getCluster().servers).length;
    const majority = Math.floor(numServers / 2) + 1;
    return this.serverVotes.size >= majority;
  }

  // When the election timeout elapses, a candidate
  // starts a new election. This occurs when a candidate
  // neither obtains a majority of votes from followers
  // nor receives an AppendEntries RPC from the leader.
  // > *§5. "...If election timeout elapses..."*
  // > *§5.2. "...third possible outcome..."*
  private onTimeout() {
    this.serverContext.logger.trace('Timer elapsed; restarting election');
    this.startElection();
  }

  //
  private requestVotes() {
    this.serverContext.logger.trace('Requesting votes from other servers');

    const lastLogIndex = this.serverContext.log.getLastIndex();

    for (const serverEndpoint of this.serverContext.getServerEndpoints()) {
      this.serverContext.sendRpcMessage(
        serverEndpoint,
        createRequestVoteRpcRequest({
          candidateId: this.serverContext.id,
          lastLogIndex,
          lastLogTerm: this.serverContext.log.getEntry(lastLogIndex).term,
          term: this.serverContext.getCurrentTerm()
        })
      ).then(() => {}, (err) => {
        this.serverContext.logger.warn(`Failed to send request-vote request to ${serverEndpoint}: ${err}`);
      });
    }
  }

  // After transitioning to a candidate, the server increments
  // its current term, votes for itself, resets the election timer,
  // and requests votes from all other servers.
  // *§5.2. "...To begin an election..."*
  private startElection() {
    this.serverContext.logger.trace('Starting election');

    this.serverVotes = new Set<string>();

    // > *§5.2. "...increments its term..."*
    this.incrementTerm();

    // > *§5.2. "...votes for itself..."*
    this.voteForSelf();

    // > *§5. "...reset election timer..."*
    this.serverContext.logger.trace(
      `Resetting election timer with timeout ${this.serverContext.electionTimer.getTimeout()}ms`
    );
    this.serverContext.electionTimer.reset();

    // > *§5.2 "...issues RequestVote RPCs..."*
    this.requestVotes();
  }

  // When a candidate has received votes from the
  // majority of servers, it becomes the leader.
  // > *§5. "...votes received from majority..."*
  // > *§5.2. "...a candidate wins an election if..."*
  private tallyVote(endpoint: IEndpoint) {
    this.serverContext.logger.trace(
      `Tallying vote received from ${endpoint.toString()}`
    );

    this.serverVotes.add(endpoint.toString());
    if (this.isMajorityObtained()) {
      this.serverContext.logger.debug(
        'Votes obtained from cluster majority; transitioning to leader'
      );
      this.serverContext.transitionTo('leader');
    }
  }

  //
  private voteForSelf(): void {
    this.serverContext.setVotedFor(this.serverContext.id);
    this.tallyVote(this.serverContext.endpoint);
  }
}

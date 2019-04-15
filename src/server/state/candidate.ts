import * as AppendEntries from '../../message/append-entries';
import * as RequestVote from '../../message/request-vote';
import { IEndpoint } from '../../net';
import { IRpcEventListener } from '../../rpc';
import { IServer } from '../';
import { IState, StateType } from './';
import { BaseState, createBaseState } from './base';

// A candidate:
// > *§5.1 "...votes for itself and issues RequestVote RPCs in parallel..."*  
//
// A candidate continues in this state until either:  
// > *§5.1 "...(a) it wins the election..."*  
// > *§5.1 "...(b) another server establishes itself as leader..."*  
// > *§5.1 "...(c) a period of time goes by with no winner..."*  
class CandidateState extends BaseState {
    private serverVotes: Set<string>;

    constructor(server: IServer) {
        super(server, 'candidate');
        this.onTimeout = this.onTimeout.bind(this);
    }

    // Upon transitioning from a follower to a candidate,
    // a candidate immediately starts an election.
    // > *§5. "...On conversion to candidate, start election..."*  
    public enter() {
        super.enter();
        super.addRpcEventListener(this.server.rpcService
            .receive({
                procedureType: 'append-entries',
                callType: 'request',
                notify: this.onAppendEntriesRequest1.bind(this)
            }));
        super.addRpcEventListener(this.server.rpcService
            .receive({
                procedureType: 'request-vote',
                callType: 'response',
                notify: this.onRequestVoteResponse.bind(this)
            }));
        this.server.electionTimer.on('timeout', this.onTimeout);

        this.startElection();
    }

    public exit() {
        this.server.electionTimer.stop();
        this.server.electionTimer.off('timeout', this.onTimeout);
        super.exit();
    }

    private incrementTerm(): void {
        const nextTerm = this.server.term + 1;
        this.server.logger.trace(`Incrementing term to ${nextTerm}`);
        this.server.term = nextTerm; 
    }

    // A candidate obtains a majority when it receives
    // `(# servers / 2) + 1` votes.
    private isMajorityObtained(): boolean {
        const numServers = Object.keys(this.server.cluster.servers).length;
        const majority = Math.floor(numServers / 2) + 1;
        return this.serverVotes.size >= majority;
    }

    // When a candidate receives an AppendEntries RPC
    // request from a leader with a term greater or equal
    // to its own, it converts to a follower.
    // > *§5. "...If AppendEntries RPC received..."*  
    // > *§5.2. "...While waiting for votes..."*  
    private onAppendEntriesRequest1(endpoint: IEndpoint, message: AppendEntries.IRequest): void {
        if(message.arguments.term >= this.server.term) {
            this.server.logger.trace(`Received append-entries request from ${endpoint.toString}; transitioning to follower`);
            this.transitionTo('follower');
        }
    }

    //
    private onRequestVoteResponse(endpoint: IEndpoint, message: RequestVote.IResponse): void {
        if(!message.results.voteGranted) return;
        this.tallyVote(endpoint);
    }

    // When the election timeout elapses, a candidate
    // starts a new election. This occurs when a candidate
    // neither obtains a majority of votes from followers
    // nor receives an AppendEntries RPC from the leader.
    // > *§5. "...If election timeout elapses..."*  
    // > *§5.2. "...third possible outcome..."*  
    private onTimeout() {
        this.server.logger.trace('Timer elapsed; restarting election');
        this.startElection();
    }

    //
    private requestVotes() {
        this.server.logger.trace('Requesting votes from other servers');

        const lastLogIndex = this.server.log.getLastIndex();

        this.server.send(RequestVote.createRequest({
            candidateId: this.server.id,
            lastLogIndex,
            lastLogTerm: this.server.log.getEntry(lastLogIndex).term,
            term: this.server.term
        }));
    }

    // After transitioning to a candidate, the server increments
    // its current term, votes for itself, resets the election timer,
    // and requests votes from all other servers.
    // *§5.2. "...To begin an election..."*
    private startElection() {
        this.server.logger.trace('Starting election');

        this.serverVotes = new Set<string>();

        // > *§5.2. "...increments its term..."*
        this.incrementTerm();

        // > *§5.2. "...votes for itself..."*
        this.voteForSelf()

        // > *§5. "...reset election timer..."*
        this.server.logger.trace(`Resetting election timer with timeout ${this.server.electionTimer.timeout}ms`); 
        this.server.electionTimer.reset();

        // > *§5.2 "...issues RequestVote RPCs..."*
        this.requestVotes();
    }

    // When a candidate has received votes from the
    // majority of servers, it becomes the leader.
    // > *§5. "...votes received from majority..."*  
    // > *§5.2. "...a candidate wins an election if..."*  
    private tallyVote(endpoint: IEndpoint) {
        this.server.logger.trace(`Tallying vote received from ${endpoint.toString()}`);

        this.serverVotes.add(endpoint.toString());
        if(this.isMajorityObtained()) {
            this.server.logger.debug('Votes obtained from cluster majority; transitioning to leader');
            this.transitionTo('leader');
        }
    }

    //
    private voteForSelf(): void {
        this.server.vote = this.server.id;
        this.tallyVote(this.server.endpoint);
    }
}

export function createCandidateState(server: IServer): IState {
    return new CandidateState(server);
}
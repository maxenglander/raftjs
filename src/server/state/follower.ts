import * as AppendEntries from '../../message/append-entries';
import * as RequestVote from '../../message/request-vote';
import { IEndpoint } from '../../net';
import { IRpcEventListener } from '../../rpc';
import { IServer } from '../';
import { IState, StateType } from './';
import { BaseState, createBaseState } from './base';

// Followers:
// > *§5. "...Respond to RPC requests from candidates and leaders..."*  
//
// Followers remain in that state until either:  
// > *§5. "...an election timeout elapses without receiving AppendEntries RPC from
// curren leader or granting vote to candidate..."*  
class FollowerState extends BaseState {
    constructor(server: IServer) {
        super(server, 'follower');

        this.onAppendEntriesRequest1 = this.onAppendEntriesRequest1.bind(this);
        this.onRequestVoteRequest1 = this.onRequestVoteRequest1.bind(this);
        this.onTimeout = this.onTimeout.bind(this);
    }

    public enter() {
        super.enter();
        super.addRpcEventListener(this.server.rpcService
            .receive({
                procedureType: 'append-entries',
                callType: 'request',
                notify: this.onAppendEntriesRequest1
            }));
        super.addRpcEventListener(this.server.rpcService
            .receive({
                procedureType: 'request-vote',
                callType: 'request',
                notify: this.onRequestVoteRequest1
            }));
        this.server.electionTimer.on('timeout', this.onTimeout);
        this.server.logger.debug(`Starting election timer with timeout ${this.server.electionTimer.timeout}ms`);
        this.server.electionTimer.start();
    }

    public exit() {
        this.server.electionTimer.stop();
        this.server.electionTimer.off('timeout', this.onTimeout);
        super.exit();
    }

    // One of the conditions for a follower resetting
    // its election timer is:
    // > *§5. "...receiving AppendEntries RPC from current leader..."*  
    private onAppendEntriesRequest1(endpoint: IEndpoint, message: AppendEntries.IRequest): void {
        this.server.electionTimer.reset();
    }

    //
    private onRequestVoteRequest1(
        endpoint: IEndpoint,
        message: RequestVote.IRequest
    ): void {
        const { term: currentTerm,
            vote: currentVote,
            electionTimer } = this.server,
            // A receiver of RequestVote RPC will:
            // > *§5. "...reply false if term < currentTerm..."*
            voteGranted = message.arguments.term >= currentTerm
                       && (currentVote == null || currentVote == message.arguments.candidateId);

        if(voteGranted) {
            this.server.logger.trace(`Granting vote request from server ${endpoint.toString()}`);
        } else {
            this.server.logger.trace(`Denying vote request from server ${endpoint.toString()}`);
        }

        this.server.send(endpoint, RequestVote.createResponse({
            term: currentTerm,
            voteGranted
        })).then(function() {
            // One of the conditions for a follower resetting
            // its election timer is:
            // > *§5. "...granting vote to candidate..."*  
            if(voteGranted) {
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
        this.transitionTo('candidate');
    }
}

//
export function createFollowerState(server: IServer): IState {
    return new FollowerState(server);
}
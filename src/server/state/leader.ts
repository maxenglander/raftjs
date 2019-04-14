import { createRequest as createAppendEntriesRequest } from '../../message/append-entries';
import { IServer } from '../';
import { BaseState, createBaseState } from './base';
import { IState, StateType } from './';

// Leaders:
// > *§5.2 "...send periodic heartbeats...to all followers...to maintain their authority"*  
//
// Leaders are also responsible for accepting request from clients
// and replicating log entries to followers. At the present time, this
// implementation does not implement those requirements.
class LeaderState extends BaseState {
    private intervalId: any;

    constructor(server: IServer) {
        super(server, 'leader');

        this.sendHeartbeats = this.sendHeartbeats.bind(this);
    }


    // Upon election:
    public enter() {
        super.enter();
        // > *§5 "...send initial empty AppendEntries RPCs (heartbeat) to each server..."*  
        this.sendHeartbeats();
        // > *§5 "...repeat during idle periods to prevent election timeouts..."*  
        this.intervalId = setInterval(this.sendHeartbeats, 50);
    }

    public exit() {
        clearInterval(this.intervalId);
        super.exit();
    }

    private sendHeartbeats() {
        this.server.send(createAppendEntriesRequest({
            entries: [],
            term: this.server.term
        }));
    }
}

export function createLeaderState(server: IServer): IState {
    return new LeaderState(server);
}

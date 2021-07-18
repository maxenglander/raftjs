import { IClientRequest, IClientResponse } from '../api/client';
import { IEndpoint } from '../net/endpoint';
import { IServer } from '../types';
import { IState, StateType } from './types';
import {
  IAppendEntriesRpcResponse,
  ILogEntry,
  IRpcMessage,
  createAppendEntriesRpcRequest,
  isAppendEntriesRpcResponse
} from '../rpc/message';

// Leaders:
// > *§5.2 "...send periodic heartbeats...to all followers...to maintain their authority"*
//
// Leaders are also responsible for accepting request from clients
// and replicating log entries to followers. At the present time, this
// implementation does not implement those requirements.
export class LeaderState implements IState {
  private matchIndex: { [id: string]: number };
  private nextIndex: { [id: string]: number };
  private sendAppendEntriesIntervalId: any; // eslint-disable-line typescript-eslint/no-explicit-any
  private readonly server: IServer;

  constructor(server: IServer) {
    this.server = server;
    this.sendAppendEntries = this.sendAppendEntries.bind(this);
  }

  // Upon election:
  public enter(): void {
    // > *§5 "...for each server, index of highest log entry known to be replicated on server..."
    // > *§5 "...(Reinitialized after election)..."
    this.matchIndex = {};

    // > *§5 "...for each server, index of the next log entry to send to that server..."
    // > *§5 "...(Reinitialized after election)..."
    this.nextIndex = {};

    for (const serverId in this.server.getServerIds()) {
      // *§5 "...(initialized to 0, increases monotonically)..."
      this.matchIndex[serverId] = 0;
      // *§5 "...(initialized to leader last log index + 1)..."
      this.nextIndex[serverId] = this.server.log.getLastIndex() + 1;
    }

    // > *§5 "...send initial empty AppendEntries RPCs (heartbeat) to each server..."*
    this.sendAppendEntries();

    // > *§5 "...repeat during idle periods to prevent election timeouts..."*
    this.sendAppendEntriesIntervalId = setInterval(this.sendAppendEntries, 10);
  }

  public exit(): void {
    clearInterval(this.sendAppendEntriesIntervalId);
  }

  private getMedianMatchIndex(): number {
    const matchIndexes = Object.values(this.matchIndex).sort();
    const medianPos = Math.floor(matchIndexes.length / 2);
    if (matchIndexes.length % 2 == 1) {
      return matchIndexes[medianPos];
    } else {
      return matchIndexes[medianPos - 1];
    }
  }

  public getLeaderId(): string {
    return this.server.id
  }

  public getType(): StateType {
    return 'leader';
  }

  public async handleAppendEntriesRpcResponse(endpoint: IEndpoint, message: IAppendEntriesRpcResponse): Promise<void> {
    if (message.results.success) {
      this.matchIndex[message.results.followerId] = message.results.followerCommit;
      this.nextIndex[message.results.followerId] = this.matchIndex[message.results.followerId] + 1;
    } else {
      this.nextIndex[message.results.followerId] = this.nextIndex[message.results.followerId] - 1;
    }

    // > *§5 "...If there exists an N such that N > commitIndex..."
    const commitIndex = this.server.getCommitIndex();
    // > *§5 "...a majority of matchIndex[i]>=N..."
    const medianMatchIndex = this.getMedianMatchIndex();
    for (let N = medianMatchIndex; N > commitIndex; N--) {
      // > *§5 "...and log[N].term==currentTerm..."
      if (this.server.log.getEntry(N).term == this.server.getCurrentTerm()) {
        // > *§5 "...set commitIndex = N..."
        this.server.setCommitIndex(N);
      }
    }
  }

  public async handleClientRequest(request: IClientRequest): Promise<IClientResponse> {
    // > *§5 "If command received from client: append entry to local log..."
    this.server.log.append({
      command: request.command,
      index: this.server.log.getNextIndex(),
      term: this.server.getCurrentTerm()
    });

    // > *§5 "...then issues AppendEntries RPCs in parallel to each of the other servers..."
    this.sendAppendEntries();

    // Once the command has been executed, return the result to the client.
    return new Promise((resolve, reject) => {
      this.server.stateMachine.onceExecuted(request.command, (result) => {
        resolve({
          result
	});
      });
    });
  }

  public async handleRpcMessage(endpoint: IEndpoint, message: IRpcMessage): Promise<void> {
    if (isAppendEntriesRpcResponse(message)) {
      this.handleAppendEntriesRpcResponse(endpoint, message);
    }
  }

  public isLeader(): boolean {
    return true;
  }

  private sendAppendEntries() {
    for (const serverId of this.server.getServerIds()) {
      let entries: ReadonlyArray<ILogEntry> = [];

      if (this.server.log.getLastIndex() >= this.nextIndex[serverId]) {
        entries = this.server.log.slice(this.nextIndex[serverId]);
      }

      const serverEndpoint = this.server.getCluster().servers[serverId];
      this.server.sendRpcMessage(
        serverEndpoint,
        createAppendEntriesRpcRequest({
          entries: this.server.log.slice(this.nextIndex[serverId]),
          leaderCommit: this.server.getCommitIndex(),
          leaderId: this.server.id,
          prevLogIndex: this.server.log.getLastIndex(),
          prevLogTerm: this.server.log.getLastTerm(),
          term: this.server.getCurrentTerm()
        })
      ).then(() => {}, (err) => {
        this.server.logger.warn(`Failed to send append-entries request to ${serverEndpoint}: ${err}`);
      });
    }
  }
}

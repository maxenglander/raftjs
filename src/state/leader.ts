import { IEndpoint } from '../net/endpoint';
import { IRequest, IResponse } from '../api/client';
import { IServer } from '../types';
import { IState, StateType } from './types';
import { IRpcMessage, createAppendEntriesRpcRequest } from '../rpc/message';

// Leaders:
// > *§5.2 "...send periodic heartbeats...to all followers...to maintain their authority"*
//
// Leaders are also responsible for accepting request from clients
// and replicating log entries to followers. At the present time, this
// implementation does not implement those requirements.
export class LeaderState implements IState {
  private matchIndex: { [id: string]: number };
  private nextIndex: { [id: string]: number };
  private sendHeartbeatsIntervalId: any; // eslint-disable-line typescript-eslint/no-explicit-any
  private readonly server: IServer;

  constructor(server: IServer) {
    this.server = server;
    this.sendHeartbeats = this.sendHeartbeats.bind(this);
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
    this.sendHeartbeats();
    // > *§5 "...repeat during idle periods to prevent election timeouts..."*
    this.sendHeartbeatsIntervalId = setInterval(this.sendHeartbeats, 50);
  }

  public exit(): void {
    clearInterval(this.sendHeartbeatsIntervalId);
  }

  public getLeaderEndpoint(): IEndpoint {
    return this.server.getCluster().servers[this.server.id]
  }

  public getType(): StateType {
    return 'leader';
  }

  public async handleRequest(request: IRequest): Promise<IResponse> {
    // > *§5 "If command received from client: append entry to local log..."
    await this.server.log.append({
      command: request.command,
      index: this.server.log.getNextIndex(),
      term: this.server.getCurrentTerm()
    });
    return {
      result: Buffer.alloc(0)
    };
  }

  public handleRpcMessage(endpoint: IEndpoint, message: IRpcMessage): void {}

  public isLeader(): boolean {
    return true;
  }

  private sendHeartbeats() {
    for (const serverEndpoint of this.server.getServerEndpoints()) {
      this.server.rpcService.send(
        serverEndpoint,
        createAppendEntriesRpcRequest({
          entries: [],
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

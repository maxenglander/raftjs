import { ILog, ILogEntry, ILogOptions } from './types';

export class Log implements ILog {
  private entries: Array<ILogEntry>;

  constructor(options?: ILogOptions) {
    // > *§5. "...each entry contains command for state machine and term when entry was received..."
    this.entries = [
      // > *§5. "...first index is 1..."*
      // To satisfy this requirement, we create an empty log entry on all servers.
      {
        command: Buffer.alloc(0),
        // The raft paper doesn't specify what value should be returned in request-vote requests
        // for the lastLogIndex and lastLogTerm arguments when the log is empty. This empty log
        // causes candidates to set those arguments to zero when the log is empty.
        index: 0,
        term: 0
      }
    ];
  }

  public async append(entry: ILogEntry): Promise<void> {
    this.entries.push(entry);
    return this.write();
  }

  public getEntry(index: number): ILogEntry {
    return this.entries[index];
  }

  public getLastEntry(): ILogEntry {
    return this.getEntry(this.getLastIndex());
  }

  public getLastIndex(): number {
    return this.entries.length - 1;
  }

  public getLastTerm(): number {
    return this.getLastEntry().term;
  }

  public getNextIndex(): number {
    return this.getLastIndex() + 1;
  }

  public write(): Promise<void> {
    return Promise.resolve();
  }
}

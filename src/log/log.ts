import { ILog, ILogEntry, ILogOptions } from './types';

export class Log implements ILog {
  private entries: Array<ILogEntry>;
  private path: string;

  constructor(options: ILogOptions) {
    // > *§5. "...each entry contains command for state machine and term when entry was received..."
    this.entries = [
      // > *§5. "...first index is 1..."*
      // To satisfy this requirement, we create an empty log entry on all servers.
      {
        command: Buffer.alloc(0),
        // The raft paper doesn't specify what value should be returned in request-vote requests
        // for the lastLogIndex and lastLogTerm arguments when the log is empty. This empty entry
        // causes candidates to set those arguments to zero when no entries have yet been appended.
        index: 0,
        term: 0
      }
    ];
    this.path = options.path;
  }

  public append(entry: ILogEntry): void {
    this.entries.push(entry);
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

  public hasEntry(index: number): boolean {
    return this.getLastIndex() >= index;
  }

  public slice(index: number): ReadonlyArray<ILogEntry> {
    return  this.entries.slice(index);
  }

  public truncateAt(index: number): void {
    this.entries = this.entries.slice(0, index);
  }

  public write(): Promise<void> {
    return Promise.resolve();
  }
}

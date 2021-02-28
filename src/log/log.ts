import { ILog, ILogEntry, ILogOptions } from './types';

// This is stub for for a persistent log of entries.
// Currently, `raftjs` does not implement handling of
// client requests or replication of log entries
// from leaders to followers.
//
// Until those features are implemented, no
// implementation of a persistent entry log is required.
export class Log implements ILog {
  private entries: Array<ILogEntry>;

  constructor(options?: ILogOptions) {
    this.entries = [
      {
        command: Buffer.alloc(0),
        index: 0,
        term: options ? options.term : 0
      }
    ];
  }

  public append(entry: ILogEntry): void {
    this.entries.push(entry);
  }

  public getEntry(index: number): ILogEntry {
    return this.entries[index];
  }

  public getLastEntry(): ILogEntry {
    return this.getEntry(this.entries.length - 1);
  }

  public getLastIndex(): number {
    return this.getLastEntry().index;
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

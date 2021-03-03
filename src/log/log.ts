import { ILog, ILogEntry, ILogOptions } from './types';

export class Log implements ILog {
  private entries: Array<ILogEntry>;

  constructor(options?: ILogOptions) {
    this.entries = [];
  }

  public async append(entry: ILogEntry): Promise<void> {
    this.entries.push(entry);
    return this.write();
  }

  public getEntry(index: number): ILogEntry {
    return this.entries[index];
  }

  public getLastEntry(): ILogEntry {
    return this.entries.length >= 0 ? this.getEntry(this.entries.length - 1) : null;
  }

  public getLastIndex(): number {
    return this.entries.length >= 0 ? this.getLastEntry().index : -1;
  }

  public getLastTerm(): number {
    return this.entries.length >= 0 ? this.getLastEntry().term : -1;
  }

  public getNextIndex(): number {
    return this.getLastIndex() + 1;
  }

  public write(): Promise<void> {
    return Promise.resolve();
  }
}

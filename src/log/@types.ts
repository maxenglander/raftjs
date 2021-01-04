export interface ILog {
  append(entry: ILogEntry): void;
  getEntry(index: number): ILogEntry;
  getLastEntry(): ILogEntry;
  getLastIndex(): number;
  getLastTerm(): number;
  getNextIndex(): number;
  write(): Promise<void>;
}

export interface ILogEntry {
  readonly command: Uint8Array;
  readonly index: number;
  readonly term: number;
}

export interface ILogOptions {
  term: number;
}

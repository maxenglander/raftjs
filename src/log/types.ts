export interface ILog {
  append(entry: ILogEntry): void;
  getEntry(index: number): ILogEntry;
  getLastEntry(): ILogEntry;
  getLastIndex(): number;
  getLastTerm(): number;
  getNextIndex(): number;
  hasEntry(index: number): boolean;
  slice(index: number): ReadonlyArray<ILogEntry>;
  truncateAt(index: number): void;
  write(): Promise<void>;
}

export interface ILogEntry {
  readonly command: Uint8Array;
  readonly index: number;
  readonly term: number;
}

export interface ILogOptions {
  path: string;
}

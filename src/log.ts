export interface ILog {
    getEntry(index: number): ILogEntry;
    getLastIndex(): number;
    write(): Promise<void>;
}

export interface ILogEntry {
    readonly term: number;
}

export interface ILogOptions {
    term: number;
}

// This is stub for for a persistent log of entries.
// Currently, `raftjs` does not implement handling of
// client requests or replication of log entries
// from leaders to followers. 
//
// Until those features are implemented, no
// implementation of a persistent entry log is required.
class Log implements ILog {
    private entries: Array<ILogEntry>;
    private lastIndex: number;

    constructor(options?: ILogOptions) {
        this.entries = [
            { term: options ? options.term : 0 }
        ];
        this.lastIndex = 0;
    }

    public getEntry(index: number): ILogEntry {
        return this.entries[index];
    }

    public getLastIndex(): number {
        return this.lastIndex;
    }

    public write(): Promise<void> {
        return Promise.resolve();
    }
}

export function createLog(options?: ILogOptions) {
    return new Log(options);
}

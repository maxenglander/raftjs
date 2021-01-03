import { ElectionTimeout, ElectionTimeoutInterval } from './election-timeout';

export interface IElectionTimeoutChooser {
    choose(): ElectionTimeout;
}

export interface IElectionTimeoutChooserOptions {
    readonly interval?: ElectionTimeoutInterval;
}

// Raft uses:
// > *§5.2 "...randomized election timeouts to ensure that split votes are rare..."
export class ElectionTimeoutChooser implements IElectionTimeoutChooser {
    private interval: ElectionTimeoutInterval;

    constructor(options: IElectionTimeoutChooserOptions = {}) {
        this.interval = options.interval;
    }

    /**
     * Get a random integer between the interval upper and lower bound.
     * See: https://mzl.la/2Vw9OmR
     */
    public choose(): ElectionTimeout {
        return Math.floor(Math.random() * (this.interval[1] - this.interval[0] + 1)) + this.interval[0];
    }
}

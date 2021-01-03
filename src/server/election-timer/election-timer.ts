import { Callback } from '../../util/callback';

export interface IElectionTimer {
    getTimeout: () => number;
    isRunning: () => boolean;
    on:  (events: ElectionTimerEvent | Array<ElectionTimerEvent>, listener: ElectionTimerListener) => void;
    off: (events: ElectionTimerEvent | Array<ElectionTimerEvent>, listener: ElectionTimerListener) => void;
    reset: () => void;
    start: () => void;
    stop:  () => void;
}

export type ElectionTimerListener = Callback<ElectionTimerEvent>;

export interface IElectionTimerOptions {
    readonly timeoutChooser?: IElectionTimeoutChooser;
}

export type ElectionTimerEvent = 'reset' | 'started' | 'stopped' | 'timeout';

export type ElectionTimeout = number;

export interface IElectionTimeoutChooser {
    choose(): ElectionTimeout;
}

export interface IElectionTimeoutChooserOptions {
    readonly interval?: ElectionTimeoutInterval;
}

export type ElectionTimeoutInterval = [number, number];

// The Raft paper recommends an election timeout
// interval of 150–300 milliseconds:
// > *§9.3 "...We recommend using a conservative election timeout such as 150–300ms..."
export const DEFAULT_ELECTION_TIMEOUT_INTERVAL: ElectionTimeoutInterval = [150, 300];

// Raft uses timers to trigger the conversion of followers
// to candidates, and candidates to restart elections.
export class ElectionTimer implements IElectionTimer {
    private listeners: { [E in ElectionTimerEvent]?: Set<Callback<ElectionTimerEvent>> };
    private running: boolean = false;
    private timeout: number;
    private timeoutChooser: IElectionTimeoutChooser;
    private timeoutId: any;

    constructor(options: IElectionTimerOptions = {}) {
        this.listeners  = {};
        this.running = false,
        this.timeoutChooser = options.timeoutChooser;
        this.timeout = this.timeoutChooser.choose();
        this.timeoutId = null;
    }

    public getTimeout(): number {
        return this.timeout;
    }

    public isRunning(): boolean {
        return this.running;
    }

    // Notify listeners about the event.
    private notifyListeners(event: ElectionTimerEvent) {
        if(this.listeners[event]) {
            for(let listener of this.listeners[event]) {
                listener(event);
            }
        }
    }

    // Register a listener for one or more events.
    public on(events: ElectionTimerEvent | Array<ElectionTimerEvent>, listener: ElectionTimerListener): void {
        if(!Array.isArray(events))
            events = [events];

        for(let event of events) {
            if(!this.listeners[event])
                this.listeners[event] = new Set();
            this.listeners[event].add(listener);
        }
    }

    // Deregister a listener from one or more events.
    public off(events: ElectionTimerEvent | Array<ElectionTimerEvent>, listener: ElectionTimerListener): void {
        if(!Array.isArray(events))
            events = [events];

        for(let event of events) {
            if(this.listeners[event])
                this.listeners[event].delete(listener);
        }
    }

    // Reset the timer.
    public reset() {
        this.stop();
        this.start();
        this.notifyListeners('reset');
    }

    // Start the timer.
    public start() {
        if(this.running) return;
        this.running = true;

        this.notifyListeners('started');

        this.timeoutId = setTimeout(() => {
            this.stop();
            this.notifyListeners('timeout');
        }, this.timeout);
    }

    // Stop the timer.
    public stop() {
        if(!this.running) return;
        this.running = false;
        clearTimeout(this.timeoutId);
        this.notifyListeners('stopped');
    }
}

// Raft uses:
// > *§5.2 "...randomized election timeouts to ensure that split votes are rare..."
export class ElectionTimeoutChooser implements IElectionTimeoutChooser {
    private interval: ElectionTimeoutInterval;

    constructor(options: IElectionTimeoutChooserOptions = {}) {
        this.interval = options.interval
            ? options.interval
            : DEFAULT_ELECTION_TIMEOUT_INTERVAL;
    }

    /**
     * Get a random integer between the interval upper and lower bound.
     * See: https://mzl.la/2Vw9OmR
     */
    public choose(): ElectionTimeout {
        return Math.floor(Math.random() * (this.interval[1] - this.interval[0] + 1)) + this.interval[0];
    }
}

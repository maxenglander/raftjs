import { Callback } from '../util/callback';

export interface ITimer {
    on:  (events: TimerEvent | Array<TimerEvent>, listener: TimerListener) => void;
    off: (events: TimerEvent | Array<TimerEvent>, listener: TimerListener) => void;
    reset: () => void;
    readonly running: boolean;
    start: () => void;
    stop:  () => void;
    readonly timeout: number;
}

export type TimerListener = Callback<TimerEvent>;

export interface ITimerOptions {
    readonly timeoutChooser?: ITimeoutChooser;
}

export type TimerEvent = 'reset' | 'started' | 'stopped' | 'timeout';

export type Timeout = number;

export interface ITimeoutChooser {
    choose(): Timeout;
}

export interface ITimeoutChooserOptions {
    readonly interval?: TimeoutInterval;
}

export type TimeoutInterval = [number, number];

// The Raft paper recommends an election timeout
// interval of 150–300 milliseconds:
// > *§9.3 "...We recommend using a conservative election timeout such as 150–300ms..."
export const DEFAULT_TIMEOUT_INTERVAL: TimeoutInterval = [150, 300];

// Raft uses timers to trigger the conversion of followers
// to candidates, and candidates to restart elections.
class Timer implements ITimer {
    private listeners: { [E in TimerEvent]?: Set<Callback<TimerEvent>> };
    private _running: boolean = false;
    private _timeout: number;
    private timeoutChooser: ITimeoutChooser;
    private timeoutId: any;

    constructor(options: ITimerOptions = {}) {
        this.listeners  = {};
        this._running = false,
        this.timeoutChooser = options.timeoutChooser
            ? options.timeoutChooser
            : createTimeoutChooser({});
        this._timeout = this.timeoutChooser.choose();
        this.timeoutId = null;
    }

    // Notify listeners about the event.
    private notifyListeners(event: TimerEvent) {
        if(this.listeners[event]) {
            for(let listener of this.listeners[event]) {
                listener(event);
            }
        }
    }

    // Register a listener for one or more events.
    public on(events: TimerEvent | Array<TimerEvent>, listener: TimerListener): void {
        if(!Array.isArray(events))
            events = [events];

        for(let event of events) {
            if(!this.listeners[event])
                this.listeners[event] = new Set();
            this.listeners[event].add(listener);
        }
    }

    // Deregister a listener from one or more events.
    public off(events: TimerEvent | Array<TimerEvent>, listener: TimerListener): void {
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

    public get running(): boolean {
        return this._running;
    }

    // Start the timer.
    public start() {
        if(this._running) return;
        this._running = true;

        this.notifyListeners('started');

        this.timeoutId = setTimeout((function() {
            this.stop();
            this.notifyListeners('timeout');
        }).bind(this), this._timeout);
    }

    // Stop the timer.
    public stop() {
        if(!this._running) return;
        this._running = false;
        clearTimeout(this.timeoutId);
        this.notifyListeners('stopped');
    }

    public get timeout(): number {
        return this._timeout;
    }
}

// Raft uses:
// > *§5.2 "...randomized election timeouts to ensure that split votes are rare..."
class TimeoutChooser implements ITimeoutChooser {
    private interval: TimeoutInterval;

    constructor(options: ITimeoutChooserOptions = {}) {
        this.interval = options.interval
            ? options.interval
            : DEFAULT_TIMEOUT_INTERVAL;
    }

    /**
     * Get a random integer between the interval upper and lower bound.
     * See: https://mzl.la/2Vw9OmR
     */
    public choose(): Timeout {
        return Math.floor(Math.random() * (this.interval[1] - this.interval[0] + 1)) + this.interval[0];
    }
}

export function createTimer(options: ITimerOptions = {}): ITimer {
    return new Timer(options);
}

export function createTimeoutChooser(options: ITimeoutChooserOptions = {}): ITimeoutChooser {
    return new TimeoutChooser(options);
}

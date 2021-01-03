import {
    ElectionTimer,
    IElectionTimerOptions,
    IElectionTimer
} from './election-timer';

import { DEFAULT_ELECTION_TIMEOUT_INTERVAL } from './election-timeout';

import {
    ElectionTimeoutChooser,
    IElectionTimeoutChooserOptions,
    IElectionTimeoutChooser
} from './election-timeout-chooser';

export function createElectionTimer(options: IElectionTimerOptions = {}): IElectionTimer {
    const timeoutChooser = options.timeoutChooser ? options.timeoutChooser : createElectionTimeoutChooser();
    return new ElectionTimer(Object.assign({}, options, { timeoutChooser }));
}

export function createElectionTimeoutChooser(options: IElectionTimeoutChooserOptions = {}): IElectionTimeoutChooser {
    const interval = options.interval ? options.interval : DEFAULT_ELECTION_TIMEOUT_INTERVAL;
    return new ElectionTimeoutChooser(Object.assign({}, options, { interval }));
}

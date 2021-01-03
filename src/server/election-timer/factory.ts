import {
    ElectionTimer,
    ElectionTimeoutChooser,
    IElectionTimerOptions,
    IElectionTimer,
    IElectionTimeoutChooserOptions,
    IElectionTimeoutChooser
} from './election-timer';

export function createElectionTimer(options: IElectionTimerOptions = {}): IElectionTimer {
    const timeoutChooser = options.timeoutChooser ? options.timeoutChooser : createElectionTimeoutChooser();
    return new ElectionTimer(Object.assign({}, options, { timeoutChooser }));
}

export function createElectionTimeoutChooser(options: IElectionTimeoutChooserOptions = {}): IElectionTimeoutChooser {
    return new ElectionTimeoutChooser(options);
}

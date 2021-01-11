import { Callback } from '../util/callback';

export interface IElectionTimer {
  getTimeout: () => number;
  isRunning: () => boolean;
  on: (
    events: ElectionTimerEvent | Array<ElectionTimerEvent>,
    listener: ElectionTimerListener
  ) => void;
  off: (
    events: ElectionTimerEvent | Array<ElectionTimerEvent>,
    listener: ElectionTimerListener
  ) => void;
  reset: () => void;
  start: () => void;
  stop: () => void;
}

export type ElectionTimerEvent = 'reset' | 'started' | 'stopped' | 'timeout';

export type ElectionTimerListener = Callback<ElectionTimerEvent>;

export interface IElectionTimerOptions {
  readonly timeoutChooser?: IElectionTimeoutChooser;
}

export type ElectionTimeout = number;

export type ElectionTimeoutInterval = [number, number];

export interface IElectionTimeoutChooser {
  choose(): ElectionTimeout;
}

export interface IElectionTimeoutChooserOptions {
  readonly interval?: ElectionTimeoutInterval;
}

import { IObservableStateMachine, IStateMachine } from './types';
import { ObservableStateMachine } from './observable-state-machine';

export function createObservableStateMachine(stateMachine: IStateMachine): IObservableStateMachine {
  return new ObservableStateMachine(stateMachine);
}

export function createNoopStateMachine(): IStateMachine {
  return {
    execute: (command: Uint8Array) => Promise.resolve(new Uint8Array(0))
  }
}

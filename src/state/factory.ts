import { CandidateState } from './candidate';
import { FollowerState } from './follower';
import { LeaderState } from './leader';
import { IServer } from '../@types';
import { IState, StateType } from './@types';
import { compilerError } from '../util/compiler-error';
import { noop } from '../util';

// The "no-op" state is not part of the Raft
// protocol. It is used by `Server` as a
// [null object](https://en.wikipedia.org/wiki/Null_object_pattern)
// to simplify guarding against null references.
function createNoopState(): IState {
  return {
    enter: noop,
    exit: noop,
    getLeaderEndpoint: () => null,
    getType: () => null,
    isLeader: () => false,
  };
}

// `createState` is a convenience function for creating `State`
// implementations by name.
export function createState(
  stateType: StateType | 'noop',
  server: IServer,
  lastState: IState
): IState {
  switch (stateType) {
    case 'candidate':
      return new CandidateState(server, lastState);
    case 'follower':
      return new FollowerState(server, lastState);
    case 'leader':
      return new LeaderState(server, lastState);
    case 'noop':
      return createNoopState();
    default:
      // Used by TypeScript for [exhaustiveness
      // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
      return compilerError(stateType);
  }
}

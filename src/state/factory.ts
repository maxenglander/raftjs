import { CandidateState } from './candidate';
import { FollowerState } from './follower';
import { IEndpoint} from '../net/endpoint';
import { IServerContext } from '../types';
import { IState, StateType } from './types';
import { LeaderState } from './leader';
import { compilerError } from '../util/compiler-error';
import { noop } from '../util';

// The "no-op" state is not part of the Raft
// protocol. It is used by `Server` as a
// [null object](https://en.wikipedia.org/wiki/Null_object_pattern)
// to simplify guarding against null references.
function createNoopState(): IState {
  return {
    enter: noop,
    execute: () => Promise.resolve({
      error: 'not-ready'
    }),
    exit: noop,
    getLeaderId: () => null,
    getType: () => null,
    handleRpcMessage: noop,
    isLeader: () => false
  };
}

// `createState` is a convenience function for creating `State`
// implementations by name.
export function createState(
  stateType: StateType | 'noop',
  serverContext: IServerContext,
  leaderId?: string
): IState {
  switch (stateType) {
    case 'candidate':
      return new CandidateState(serverContext);
    case 'follower':
      return new FollowerState(serverContext, leaderId);
    case 'leader':
      return new LeaderState(serverContext);
    case 'noop':
      return createNoopState();
    default:
      // Used by TypeScript for [exhaustiveness
      // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
      return compilerError(stateType);
  }
}

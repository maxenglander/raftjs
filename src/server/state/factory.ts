import { CandidateState } from './candidate';
import { FollowerState } from './follower';
import { LeaderState } from './leader';
import { IServer } from '../@types';
import { IState, StateType } from './@types';
import { compilerError } from '../../util/compiler-error';
import { noop } from '../../util';

// The "no-op" state is not part of the Raft
// protocol. It is used by `Server` as a
// [null object](https://en.wikipedia.org/wiki/Null_object_pattern)
// to simplify guarding against null references.
function createNoopState(): IState {
    return {
        enter: noop,
        exit: noop,
        type: null
    };
}

// `createState` is a convenience function for creating `State`
// implementations by name.
export function createState(stateType: StateType | 'noop', server: IServer): IState {
    switch(stateType) {
        case 'candidate':
            return new CandidateState(server);
        case 'follower':
            return new FollowerState(server);
        case 'leader':
            return new LeaderState(server);
        case 'noop':
            return createNoopState();
        default:
            // Used by TypeScript for [exhaustiveness
            // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
            return compilerError(stateType);
    }
}

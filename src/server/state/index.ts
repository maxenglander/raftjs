import { IServer } from '../';
import { compilerError } from '../../util/compiler-error';

import { createNoopState } from './noop';
import { createLeaderState } from './leader';
import { createCandidateState } from './candidate';
import { createFollowerState } from './follower';

export interface IState {
    enter: () => void;
    exit: () => void;
    readonly type: StateType;
}

export type StateFactory = (server: IServer) => IState;

export type StateTransition = (state: StateType | IState) => void;

export type StateType = 'candidate' | 'follower' | 'leader';

// `createState` is a convenience function for creating `State`
// implementations by name.
export function createState(stateType: StateType | 'noop', server: IServer): IState {
    switch(stateType) {
        case 'candidate':
            return createCandidateState(server);
        case 'follower':
            return createFollowerState(server);
        case 'leader':
            return createLeaderState(server);
        case 'noop':
            return createNoopState();
        default:
            // Used by TypeScript for [exhaustiveness
            // checks](https://www.typescriptlang.org/docs/handbook/advanced-types.html#exhaustiveness-checking).
            return compilerError(stateType);
    }
}

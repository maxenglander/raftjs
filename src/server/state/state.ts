import { IServer } from '../server';

export interface IState {
    enter: () => void;
    exit: () => void;
    readonly type: StateType;
}

export type StateFactory = (server: IServer) => IState;

export type StateTransition = (state: StateType | IState) => void;

export type StateType = 'candidate' | 'follower' | 'leader';

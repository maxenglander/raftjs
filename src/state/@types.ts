import { IEndpoint } from '../net/endpoint';
import { IServer } from '../@types';

export interface IState {
  enter: () => void;
  exit: () => void;
  getLeaderEndpoint: () => IEndpoint;
  getType: () => StateType
  isLeader: () => boolean;
}

export type StateFactory = (server: IServer, lastState: IState) => IState;

export type StateTransition = (nextState: StateType | IState) => void;

export type StateType = 'candidate' | 'follower' | 'leader';
